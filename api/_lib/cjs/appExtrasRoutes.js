/**
 * Creator + rewards routes for Vercel CJS router (minimal production-safe).
 */
const { send, readJsonBody, requireAuth } = require('./helpers');

async function handleCreator(path, req, res) {
  if (!String(path || '').startsWith('creator/')) return null;
  const auth = await requireAuth(req);
  if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });

  if (path === 'creator/metrics' && req.method === 'GET') {
    const { data } = await auth.client
      .from('profiles')
      .select(
        'id, earnings_coins, total_calls_hosted, total_call_minutes, is_ready_now_active, ready_now_toggled_at, coin_earn_override_rate, hourly_coin_rate'
      )
      .eq('id', auth.profileId)
      .maybeSingle();
    return send(res, 200, {
      success: true,
      data: {
        earningsCoins: Number((data && data.earnings_coins) || 0),
        totalCallsHosted: Number((data && data.total_calls_hosted) || 0),
        totalCallMinutes: Number((data && data.total_call_minutes) || 0),
        isReadyNowActive: Boolean(data && data.is_ready_now_active),
        readyNowToggledAt: data && data.ready_now_toggled_at,
        coinEarnOverrideRate:
          data && data.coin_earn_override_rate != null
            ? Number(data.coin_earn_override_rate)
            : null,
        hourlyCoinRate: Number((data && data.hourly_coin_rate) || 0),
      },
    });
  }

  if (path === 'creator/heartbeat' && req.method === 'POST') {
    await readJsonBody(req);
    await auth.client
      .from('profiles')
      .update({
        last_seen_at: new Date().toISOString(),
        online_status: 'online',
        updated_at: new Date().toISOString(),
      })
      .eq('id', auth.profileId);
    return send(res, 200, { success: true });
  }

  if (path === 'creator/ready-now-toggle' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const { data: current } = await auth.client
      .from('profiles')
      .select('is_ready_now_active')
      .eq('id', auth.profileId)
      .maybeSingle();
    const next =
      body && typeof body.active === 'boolean'
        ? body.active
        : !Boolean(current && current.is_ready_now_active);
    const { data, error } = await auth.client
      .from('profiles')
      .update({
        is_ready_now_active: next,
        ready_now_toggled_at: new Date().toISOString(),
        online_status: next ? 'online' : 'offline',
        updated_at: new Date().toISOString(),
      })
      .eq('id', auth.profileId)
      .select('is_ready_now_active, ready_now_toggled_at')
      .maybeSingle();
    if (error) return send(res, 500, { success: false, error: error.message });
    return send(res, 200, {
      success: true,
      isReadyNowActive: Boolean(data && data.is_ready_now_active),
      readyNowToggledAt: data && data.ready_now_toggled_at,
    });
  }

  if (path === 'creator/first-call-bonus' && req.method === 'POST') {
    await readJsonBody(req);
    return send(res, 200, { success: true, awarded: false, message: 'No bonus available' });
  }

  return send(res, 501, {
    success: false,
    error: { message: `Unimplemented creator path: ${path}`, code: 'VERCEL_ROUTE_NOT_IMPLEMENTED' },
  });
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

async function handleRewards(path, req, res) {
  if (!String(path || '').startsWith('rewards/')) return null;
  const auth = await requireAuth(req);
  if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });

  const rewardDay = (() => {
    try {
      // may be in body for POST
      return todayYmd();
    } catch {
      return todayYmd();
    }
  })();

  if ((path === 'rewards/get' || path === 'rewards/progress' || path === 'rewards/update') &&
      (req.method === 'GET' || req.method === 'POST')) {
    const body = req.method === 'POST' ? await readJsonBody(req) : {};
    const day = String((body && body.rewardDay) || rewardDay);
    // Prefer user_daily_rewards table when present
    try {
      const { data, error } = await auth.client
        .from('user_daily_rewards')
        .select('*')
        .eq('user_id', auth.profileId)
        .eq('reward_day', day)
        .maybeSingle();
      if (!error && data) {
        return send(res, 200, {
          success: true,
          data: { record: data, rewardDay: day },
        });
      }
      if (!error && !data && path === 'rewards/get') {
        const empty = {
          user_id: auth.profileId,
          reward_day: day,
          streak_day: 1,
          claimed_streak: false,
          missions: {},
        };
        await auth.client.from('user_daily_rewards').upsert(empty, {
          onConflict: 'user_id,reward_day',
        });
        return send(res, 200, { success: true, data: { record: empty, rewardDay: day } });
      }
    } catch (e) {
      console.warn('[rewards]', e && e.message);
    }
    // Soft success so UI does not hard-crash when table missing
    return send(res, 200, {
      success: true,
      data: {
        record: {
          userId: auth.profileId,
          rewardDay: day,
          streakDay: 1,
          claimedStreak: false,
          missions: {},
        },
        rewardDay: day,
      },
    });
  }

  if (
    (path === 'rewards/claim-streak' ||
      path === 'rewards/claim-mission' ||
      path === 'rewards/claim-master-chest') &&
    req.method === 'POST'
  ) {
    await readJsonBody(req);
    return send(res, 200, {
      success: false,
      error: {
        message:
          'Daily rewards claims require the full rewards backend. Table user_daily_rewards may be missing or incomplete on this deployment.',
        code: 'REWARDS_LIMITED',
      },
    });
  }

  return send(res, 501, {
    success: false,
    error: { message: `Unimplemented rewards path: ${path}`, code: 'VERCEL_ROUTE_NOT_IMPLEMENTED' },
  });
}

async function handleAppExtras(path, req, res) {
  let r = await handleCreator(path, req, res);
  if (r !== null) return r;
  r = await handleRewards(path, req, res);
  if (r !== null) return r;
  return null;
}

module.exports = { handleAppExtras };
