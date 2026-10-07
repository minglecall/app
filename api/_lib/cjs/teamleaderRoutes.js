/**
 * /api/teamleader/* — CommonJS for Vercel Hobby router.
 */
const {
  send,
  readJsonBody,
  createServiceClient,
  isValidEmail,
  getPasswordPolicyError,
  mapProfileRow,
  requireAuth,
  isTeamLeaderRole,
  isAdminRole,
} = require('./helpers');

const DISPOSABLE = ['@livecall.app', '@minglecall.local', '@example.com', '@test.local'];

function isFemaleHost(u) {
  return (
    (u && u.gender === 'female') ||
    (u && u.role === 'female_creator') ||
    (u && u.role === 'female_host')
  );
}

function ownsCreator(leaderId, u, leaderAuthId) {
  const tl = String((u && (u.teamLeaderId || u.team_leader_id)) || '');
  const created = String((u && (u.createdById || u.created_by_id)) || '');
  const ids = [leaderId, leaderAuthId].filter(Boolean).map(String);
  return ids.includes(tl) || ids.includes(created);
}

function parseQuery(url) {
  try {
    return new URL(String(url || ''), 'http://localhost').searchParams;
  } catch {
    return new URLSearchParams();
  }
}

function actionFromPath(path) {
  // path like teamleader/creators or teamleader/ban-creator
  const parts = String(path || '')
    .replace(/^teamleader\/?/, '')
    .split('/')
    .filter(Boolean);
  return parts[0] || '';
}

async function handleTeamleader(path, req, res) {
  if (!String(path || '').startsWith('teamleader')) return null;

  const client = createServiceClient();
  if (!client) {
    return send(res, 503, {
      success: false,
      error: { message: 'Supabase not configured', code: 'ENV' },
    });
  }

  const auth = await requireAuth(req);
  if (auth.ok === false) {
    return send(res, auth.status, { success: false, error: auth.error });
  }
  if (!isTeamLeaderRole(auth.role, auth.email)) {
    return send(res, 403, {
      success: false,
      error: { message: 'Team leader role required.', code: 'FORBIDDEN' },
    });
  }

  const leader = auth.profile || {};
  const leaderId = String(leader.id || auth.profileId);
  const leaderAuthId = String(leader.auth_id || auth.userId || '');
  const isAdmin = isAdminRole(auth.role, auth.email);
  const action = actionFromPath(path);
  const q = parseQuery(req.url);
  const allMode =
    isAdmin &&
    (q.get('all') === '1' || q.get('all') === 'true' || (!q.get('leaderId') && action === 'creators'));
  const scopeLeaderId = allMode ? '' : String(q.get('leaderId') || leaderId);

  try {
    if (action === 'creators' && req.method === 'GET') {
      const { data, error } = await client.from('profiles').select('*').limit(2000);
      if (error) return send(res, 500, { success: false, error: error.message });
      const listAllMode = allMode || (isAdmin && !q.get('leaderId'));
      const creators = (data || [])
        .map(mapProfileRow)
        .filter((u) => {
          if (!u || !isFemaleHost(u)) return false;
          if (u.role === 'team_leader' || u.role === 'agency_manager' || u.role === 'admin') {
            return false;
          }
          if (listAllMode) return true;
          if (u.id === scopeLeaderId || u.id === leaderId) return false;
          return ownsCreator(scopeLeaderId || leaderId, u, leaderAuthId);
        });
      return send(res, 200, {
        success: true,
        creators,
        count: creators.length,
        leaderId: scopeLeaderId || leaderId,
        agencyName: leader.agency_name || leader.agencyName,
        allMode: listAllMode,
      });
    }

    if (action === 'creators' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const name = String((body && body.name) || '').trim();
      const email = String((body && body.email) || '')
        .trim()
        .toLowerCase();
      const password = String((body && body.password) || '');
      if (!name) return send(res, 400, { success: false, error: 'Creator name is required' });
      if (!isValidEmail(email)) {
        return send(res, 400, { success: false, error: 'A valid email address is required' });
      }
      if (DISPOSABLE.some((s) => email.endsWith(s))) {
        return send(res, 400, {
          success: false,
          error: 'Disposable or placeholder emails are not allowed. Use a real email address.',
        });
      }
      const pwErr = getPasswordPolicyError(password);
      if (pwErr) return send(res, 400, { success: false, error: pwErr });

      const { data: existing } = await client
        .from('profiles')
        .select('id')
        .ilike('email', email)
        .maybeSingle();
      if (existing) {
        return send(res, 409, {
          success: false,
          error: 'An account with this email already exists',
        });
      }

      const { data: authUser, error: authErr } = await client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: 'female_creator',
          name,
          full_name: name,
          gender: 'female',
        },
      });
      if (authErr || !authUser || !authUser.user) {
        return send(res, 500, {
          success: false,
          error: (authErr && authErr.message) || 'Failed to create auth user',
        });
      }

      // MUST use auth user id — handle_new_auth_user trigger already inserts profiles.id = auth.users.id.
      // Upserting a different id leaves an orphan host with null team_leader_id (empty TL roster).
      const authUserId = authUser.user.id;
      const agencyName = leader.agency_name || leader.agencyName || null;
      const avatarUrl =
        body.avatarUrl ||
        body.avatar_url ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400';
      const row = {
        id: authUserId,
        auth_id: authUserId,
        name,
        email,
        gender: 'female',
        gender_locked: true,
        role: 'female_creator',
        is_onboarded: true,
        is_verified: true,
        has_password_set: true,
        team_leader_id: leaderId,
        created_by_id: leaderId,
        agency_name: agencyName,
        age: body.age != null ? Number(body.age) : 24,
        nationality: body.nationality || 'United States',
        country_code: String(body.countryCode || body.country_code || 'US').toUpperCase(),
        bio: body.bio || '',
        avatar_url: avatarUrl,
        gallery: Array.isArray(body.gallery) && body.gallery.length ? body.gallery : [avatarUrl],
        online_status: 'offline',
        updated_at: new Date().toISOString(),
      };

      const { data: inserted, error: insErr } = await client
        .from('profiles')
        .upsert(row, { onConflict: 'id' })
        .select('*')
        .single();
      if (insErr) {
        await client.auth.admin.deleteUser(authUserId).catch(() => {});
        return send(res, 500, { success: false, error: insErr.message });
      }

      // Belt-and-suspenders: re-assert ownership in case a concurrent trigger write raced
      await client
        .from('profiles')
        .update({
          team_leader_id: leaderId,
          created_by_id: leaderId,
          agency_name: agencyName,
          role: 'female_creator',
          gender: 'female',
          gender_locked: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', authUserId);

      const { data: finalRow } = await client.from('profiles').select('*').eq('id', authUserId).maybeSingle();

      return send(res, 200, {
        success: true,
        creator: mapProfileRow(finalRow || inserted),
        message: `Successfully created and persisted creator ${name}`,
      });
    }

    if (action === 'stats' && req.method === 'GET') {
      const { data: profiles } = await client.from('profiles').select('*').limit(2000);
      const managed = (profiles || [])
        .map(mapProfileRow)
        .filter((u) => {
          if (!u || !isFemaleHost(u)) return false;
          if (u.role === 'team_leader' || u.role === 'agency_manager' || u.role === 'admin') {
            return false;
          }
          if (allMode && isAdmin) return true;
          return ownsCreator(scopeLeaderId || leaderId, u, leaderAuthId);
        });
      const managedIds = new Set(managed.map((c) => c.id));
      let totalCalls = 0;
      let totalMinutes = 0;
      let hostEarningsCoins = 0;
      let teamLeaderEarnedCoins = 0;
      let totalCoinsSpent = 0;
      let statsSource = 'empty';
      let femalePayoutRatioUSD = 0.003;
      let teamLeaderSharePercent =
        Number(leader.commission_percent || leader.commissionPercent) || 10;

      const { data: cfg } = await client
        .from('system_configs')
        .select('coin_usd_peg, female_payout_ratio_usd, team_leader_share_percent')
        .eq('id', 'default')
        .maybeSingle();
      if (cfg) {
        femalePayoutRatioUSD =
          Number(cfg.coin_usd_peg) || Number(cfg.female_payout_ratio_usd) || femalePayoutRatioUSD;
        teamLeaderSharePercent =
          Number(cfg.team_leader_share_percent) || teamLeaderSharePercent;
      }

      let logs = [];
      if (allMode && isAdmin) {
        const { data } = await client
          .from('call_logs')
          .select(
            'id, receiver_id, host_id, team_leader_id, team_leader_earned_coins, coins_earned, coins_spent, duration_seconds'
          )
          .limit(20000);
        if (Array.isArray(data)) logs = data;
      } else if (scopeLeaderId || leaderId) {
        const sid = scopeLeaderId || leaderId;
        const { data: byTl } = await client
          .from('call_logs')
          .select(
            'id, receiver_id, host_id, team_leader_id, team_leader_earned_coins, coins_earned, coins_spent, duration_seconds'
          )
          .eq('team_leader_id', sid)
          .limit(20000);
        if (Array.isArray(byTl)) logs.push(...byTl);
        const managedIdList = [...managedIds];
        if (managedIdList.length > 0) {
          const { data: byRx } = await client
            .from('call_logs')
            .select(
              'id, receiver_id, host_id, team_leader_id, team_leader_earned_coins, coins_earned, coins_spent, duration_seconds'
            )
            .in('receiver_id', managedIdList)
            .limit(20000);
          if (Array.isArray(byRx)) logs.push(...byRx);
        }
      }

      if (logs.length > 0) {
        statsSource = 'call_logs';
        const seen = new Set();
        const sid = scopeLeaderId || leaderId;
        for (const row of logs) {
          const id = String(row.id || '');
          if (id && seen.has(id)) continue;
          if (id) seen.add(id);
          const hostId = String(row.receiver_id || row.host_id || '');
          const logTlId = row.team_leader_id ? String(row.team_leader_id) : '';
          const belongs =
            (allMode && isAdmin) || logTlId === sid || (hostId && managedIds.has(hostId));
          if (!belongs) continue;
          totalCalls += 1;
          totalMinutes += Math.round((Number(row.duration_seconds) || 0) / 60);
          hostEarningsCoins += Math.max(0, Number(row.coins_earned) || 0);
          totalCoinsSpent += Math.max(0, Number(row.coins_spent) || 0);
          if ((allMode && isAdmin) || logTlId === sid) {
            teamLeaderEarnedCoins += Math.max(0, Number(row.team_leader_earned_coins) || 0);
          }
        }
      }

      if (hostEarningsCoins <= 0) {
        hostEarningsCoins = managed.reduce(
          (acc, c) => acc + Math.max(0, Number(c.earningsCoins) || 0),
          0
        );
      }

      return send(res, 200, {
        success: true,
        data: {
          totalCalls,
          totalMinutes,
          hostEarningsCoins,
          hostEarningsUSD: hostEarningsCoins * femalePayoutRatioUSD,
          teamLeaderEarnedCoins,
          teamLeaderEarnedUSD: teamLeaderEarnedCoins * femalePayoutRatioUSD,
          totalCoinsSpent,
          femalePayoutRatioUSD,
          teamLeaderSharePercent,
          managedCreatorCount: managed.length,
          statsSource,
          leaderId: scopeLeaderId || leaderId,
          allMode: Boolean(allMode && isAdmin),
        },
      });
    }

    if (
      (action === 'ban-creator' || action === 'unban-creator' || action === 'delete-creator') &&
      req.method === 'POST'
    ) {
      const body = await readJsonBody(req);
      const creatorId = String((body && body.creatorId) || '').trim();
      if (!creatorId) return send(res, 400, { success: false, error: 'Creator ID is required' });

      const { data: targetRow } = await client
        .from('profiles')
        .select('*')
        .eq('id', creatorId)
        .maybeSingle();
      if (!targetRow) return send(res, 404, { success: false, error: 'Creator not found' });
      const target = mapProfileRow(targetRow);
      if (!isAdmin && !ownsCreator(leaderId, target, leaderAuthId)) {
        return send(res, 403, {
          success: false,
          error: 'Not authorized for this creator.',
        });
      }

      if (action === 'ban-creator') {
        const banDays = Number(body.days) || 7;
        const banReason = body.reason || 'Suspended by Team Leader for policy review';
        const bannedUntil = new Date(Date.now() + banDays * 24 * 60 * 60 * 1000).toISOString();
        const { data: updated, error } = await client
          .from('profiles')
          .update({
            is_banned: true,
            ban_reason: banReason,
            banned_until: bannedUntil,
            banned_by_id: leaderId,
            banned_by_role: 'team_leader',
            online_status: 'offline',
            updated_at: new Date().toISOString(),
          })
          .eq('id', creatorId)
          .select('*')
          .single();
        if (error) return send(res, 500, { success: false, error: error.message });
        return send(res, 200, {
          success: true,
          message: 'Creator banned',
          bannedUntil,
          banReason,
          user: mapProfileRow(updated),
        });
      }

      if (action === 'unban-creator') {
        const { data: updated, error } = await client
          .from('profiles')
          .update({
            is_banned: false,
            ban_reason: null,
            banned_until: null,
            banned_by_id: null,
            banned_by_role: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', creatorId)
          .select('*')
          .single();
        if (error) return send(res, 500, { success: false, error: error.message });
        return send(res, 200, {
          success: true,
          message: 'Creator unbanned',
          user: mapProfileRow(updated),
        });
      }

      const authId = targetRow.auth_id || null;
      const warnings = [];
      let authDeleted = false;
      if (authId) {
        const { error: delAuthErr } = await client.auth.admin.deleteUser(authId);
        if (delAuthErr) warnings.push(delAuthErr.message);
        else authDeleted = true;
      }
      await client
        .from('profiles')
        .update({ team_leader_id: null, created_by_id: null })
        .or(`team_leader_id.eq.${creatorId},created_by_id.eq.${creatorId}`);
      const { error: delErr } = await client.from('profiles').delete().eq('id', creatorId);
      if (delErr) return send(res, 500, { success: false, error: delErr.message });
      return send(res, 200, {
        success: true,
        message: 'Creator deleted',
        data: { authDeleted, profileDeleted: true, r2DeletedCount: 0, warnings },
      });
    }

    if (action === 'override-rate') {
      return send(res, 403, {
        success: false,
        error:
          'Team Leaders cannot override earning rates. Only administrators may set individual overrides.',
      });
    }

    return send(res, 404, {
      success: false,
      error: { message: `Unknown teamleader route: ${action}`, code: 'NOT_FOUND' },
    });
  } catch (e) {
    return send(res, 500, {
      success: false,
      error: {
        message: (e && e.message) || 'Team leader API failed',
        code: 'TEAMLEADER_ERROR',
      },
    });
  }
}

module.exports = { handleTeamleader };
