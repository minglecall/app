/**
 * Core app routes for Vercel CJS router:
 * presence, messages, calls, gifts, users extras, supabase profile/status.
 */
const { randomUUID } = require('crypto');
const {
  send,
  readJsonBody,
  createServiceClient,
  requireAuth,
  isAdminRole,
  mapProfileRow,
} = require('./helpers');

async function handlePresence(path, req, res) {
  if (path !== 'presence' && path !== 'presence/index' && path !== 'presence/heartbeat') {
    return null;
  }
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return send(res, 405, { success: false, error: 'Method not allowed' });
  }
  const auth = await requireAuth(req);
  if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
  const body = await readJsonBody(req);
  const status = String((body && body.status) || 'online').toLowerCase();
  const onlineStatus =
    status === 'online' || status === 'busy' || status === 'offline' ? status : 'online';
  await auth.client
    .from('profiles')
    .update({
      online_status: onlineStatus,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', auth.profileId);
  return send(res, 200, { success: true, userId: auth.profileId, status: onlineStatus });
}

async function handleMessages(path, req, res) {
  if (!String(path || '').startsWith('messages')) return null;
  const auth = await requireAuth(req);
  if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
  const client = auth.client;

  if ((path === 'messages' || path === 'messages/index') && req.method === 'POST') {
    const body = await readJsonBody(req);
    const receiverId = String((body && body.receiverId) || '');
    const text = String((body && body.text) || '').slice(0, 4000);
    const mediaUrl = body && body.mediaUrl ? String(body.mediaUrl).slice(0, 2048) : null;
    const type = String((body && body.type) || (mediaUrl ? 'image' : 'text'));
    const clientTempId = (body && body.clientTempId) || null;
    if (!receiverId) {
      return send(res, 400, {
        success: false,
        error: { message: 'receiverId required', code: 'BAD_REQUEST' },
      });
    }
    const { data: blocked } = await client
      .from('blocked_users')
      .select('user_id')
      .or(
        `and(user_id.eq.${auth.profileId},blocked_user_id.eq.${receiverId}),and(user_id.eq.${receiverId},blocked_user_id.eq.${auth.profileId})`
      )
      .limit(1);
    if (blocked && blocked.length) {
      return send(res, 403, { success: false, error: { message: 'Blocked', code: 'BLOCKED' } });
    }
    const row = {
      sender_id: auth.profileId,
      receiver_id: receiverId,
      text,
      type,
      media_url: mediaUrl,
      media_type: (body && body.mediaType) || undefined,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    const { data, error } = await client.from('messages').insert(row).select('*').maybeSingle();
    if (error) return send(res, 500, { success: false, error: { message: error.message } });
    return send(res, 200, {
      success: true,
      message: {
        id: data.id,
        senderId: data.sender_id,
        receiverId: data.receiver_id,
        text: data.text || '',
        mediaUrl: data.media_url || undefined,
        type: data.type,
        isRead: Boolean(data.is_read),
        createdAt: data.created_at,
        timestamp: data.created_at,
        clientTempId: clientTempId || undefined,
      },
    });
  }

  if (path === 'messages/read' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const otherUserId = String((body && (body.otherUserId || body.senderId)) || '');
    let q = client
      .from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('receiver_id', auth.profileId)
      .eq('is_read', false);
    if (otherUserId) q = q.eq('sender_id', otherUserId);
    await q;
    return send(res, 200, { success: true });
  }

  if (path.startsWith('messages/conversation/') && req.method === 'GET') {
    const otherUserId = decodeURIComponent(path.replace('messages/conversation/', ''));
    if (!otherUserId || otherUserId === 'conversation') {
      return send(res, 400, { success: false, error: { message: 'otherUserId required' } });
    }
    const { data, error } = await client
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${auth.profileId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${auth.profileId})`
      )
      .order('created_at', { ascending: true })
      .limit(200);
    if (error) return send(res, 500, { success: false, error: { message: error.message } });
    const messages = (data || []).map((row) => ({
      id: row.id,
      senderId: row.sender_id,
      receiverId: row.receiver_id,
      text: row.text || '',
      mediaUrl: row.media_url || undefined,
      type: row.type,
      isRead: Boolean(row.is_read),
      createdAt: row.created_at,
      timestamp: row.created_at,
    }));
    return send(res, 200, { success: true, messages });
  }

  if (path.startsWith('messages/conversation/') && req.method === 'DELETE') {
    const otherUserId = decodeURIComponent(path.replace('messages/conversation/', ''));
    await client
      .from('messages')
      .delete()
      .or(
        `and(sender_id.eq.${auth.profileId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${auth.profileId})`
      );
    return send(res, 200, { success: true });
  }

  return send(res, 405, { success: false, error: { message: 'Method not allowed' } });
}

async function handleCalls(path, req, res) {
  if (path !== 'calls/sync' && path !== 'calls/burn' && path !== 'calls/wallet-ledger') return null;
  const auth = await requireAuth(req);
  if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });

  if (path === 'calls/wallet-ledger' && req.method === 'GET') {
    const { data, error } = await auth.client
      .from('wallet_ledger')
      .select('*')
      .eq('user_id', auth.profileId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return send(res, 500, { success: false, error: error.message });
    return send(res, 200, { success: true, ledger: data || [] });
  }

  if (path === 'calls/sync' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const callId = String((body && (body.callId || body.id)) || randomUUID());
    const payload = {
      id: callId,
      caller_id: (body && body.callerId) || auth.profileId,
      receiver_id: body && body.receiverId,
      status: (body && body.status) || 'completed',
      duration_seconds: Number((body && (body.durationSeconds || body.duration)) || 0),
      coins_spent: Number((body && body.coinsSpent) || 0),
      coins_earned: Number((body && body.coinsEarned) || 0),
      started_at: (body && (body.startedAt || body.startTime)) || undefined,
      ended_at: (body && (body.endedAt || body.endTime)) || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    Object.keys(payload).forEach((k) => payload[k] == null && delete payload[k]);
    const { error } = await auth.client.from('call_logs').upsert(payload, { onConflict: 'id' });
    if (error) console.warn('[api/calls/sync]', error.message);
    return send(res, 200, { success: true, callId });
  }

  if (path === 'calls/burn' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      // Reject client-supplied money fields (parity with Express call.routes)
      if (
        body &&
        (body.coinsBurned != null ||
          body.hostCoinsEarned != null ||
          body.tlCoinsEarned != null ||
          body.coins != null ||
          body.amount != null)
      ) {
        return send(res, 400, {
          success: false,
          error: {
            message: 'Client must not supply coin amounts; rates are server-derived.',
            code: 'CLIENT_AMOUNTS_FORBIDDEN',
          },
        });
      }

      const callId = typeof body?.callId === 'string' ? body.callId.trim() : '';
      const billingMinute = Number(body?.billingMinute);
      if (!callId || !Number.isFinite(billingMinute) || billingMinute < 1) {
        return send(res, 400, {
          success: false,
          error: {
            message: 'callId and billingMinute (>=1) are required',
            code: 'INVALID_INPUT',
          },
        });
      }

      const callerId = auth.profileId;
      // Resolve call participants from call_logs (no in-memory activeCalls on Vercel)
      const { data: callRow, error: callErr } = await auth.client
        .from('call_logs')
        .select('id, caller_id, receiver_id, host_id, status, team_leader_id')
        .eq('id', callId)
        .maybeSingle();
      if (callErr) {
        console.error('[api/calls/burn] call_logs lookup failed', callErr.message);
        return send(res, 500, {
          success: false,
          error: { message: 'Call lookup failed', code: 'CALL_LOOKUP_FAILED' },
        });
      }
      if (!callRow) {
        return send(res, 404, {
          success: false,
          error: { message: 'Call not found', code: 'CALL_NOT_FOUND' },
        });
      }
      if (String(callRow.caller_id) !== String(callerId)) {
        return send(res, 403, {
          success: false,
          error: { message: 'Only the call caller may trigger billing', code: 'FORBIDDEN' },
        });
      }
      const receiverId = String(callRow.receiver_id || callRow.host_id || '');
      if (!receiverId) {
        return send(res, 404, {
          success: false,
          error: { message: 'Receiver profile not found', code: 'RECEIVER_NOT_FOUND' },
        });
      }

      const { data: cfg } = await auth.client
        .from('system_configs')
        .select(
          'coin_burn_rate_per_min, coin_burn_rate_friend_per_min, female_host_share_percent, team_leader_share_percent'
        )
        .eq('id', 'default')
        .maybeSingle();

      const standardRate = Math.max(1, Math.round(Number(cfg?.coin_burn_rate_per_min) || 120));
      const friendRate = Math.max(1, Math.round(Number(cfg?.coin_burn_rate_friend_per_min) || 80));
      const hostSharePercent = Math.min(
        100,
        Math.max(0, Math.round(Number(cfg?.female_host_share_percent) || 30))
      );
      const tlSharePercent = Math.min(
        100,
        Math.max(0, Math.round(Number(cfg?.team_leader_share_percent) || 10))
      );

      const { data: recvRow } = await auth.client
        .from('profiles')
        .select('id, role, team_leader_id, created_by_id, coin_earn_override_rate')
        .eq('id', receiverId)
        .maybeSingle();
      if (!recvRow) {
        return send(res, 404, {
          success: false,
          error: { message: 'Receiver profile not found', code: 'RECEIVER_NOT_FOUND' },
        });
      }

      let isFriendPair = false;
      const { data: frForward } = await auth.client
        .from('friend_requests')
        .select('id')
        .eq('status', 'accepted')
        .eq('sender_id', callerId)
        .eq('receiver_id', receiverId)
        .limit(1)
        .maybeSingle();
      if (frForward) {
        isFriendPair = true;
      } else {
        const { data: frReverse } = await auth.client
          .from('friend_requests')
          .select('id')
          .eq('status', 'accepted')
          .eq('sender_id', receiverId)
          .eq('receiver_id', callerId)
          .limit(1)
          .maybeSingle();
        isFriendPair = Boolean(frReverse);
      }

      const coinsBurned = isFriendPair ? friendRate : standardRate;
      const isCreator =
        recvRow.role === 'female_creator' || recvRow.role === 'female_host';
      const tlId = isCreator
        ? String(recvRow.team_leader_id || recvRow.created_by_id || callRow.team_leader_id || '') ||
          null
        : null;

      let hostCoinsEarned = 0;
      let tlCoinsEarned = 0;
      const override = Number(recvRow.coin_earn_override_rate);
      const usedOverride = Number.isFinite(override) && override > 0;
      if (isCreator && coinsBurned > 0) {
        if (usedOverride) {
          hostCoinsEarned = Math.min(coinsBurned, Math.round(override));
        } else {
          hostCoinsEarned = Math.round(coinsBurned * (hostSharePercent / 100));
        }
        if (tlId && tlSharePercent > 0) {
          tlCoinsEarned = Math.round(coinsBurned * (tlSharePercent / 100));
        }
        if (hostCoinsEarned + tlCoinsEarned > coinsBurned) {
          if (tlCoinsEarned > coinsBurned) {
            tlCoinsEarned = coinsBurned;
            hostCoinsEarned = 0;
          } else {
            hostCoinsEarned = coinsBurned - tlCoinsEarned;
          }
        }
      }

      const metadata = {
        billingMinute,
        isFriendPair,
        ratePerMin: coinsBurned,
        hostSharePercent,
        tlSharePercent,
        usedOverride,
        receiverId,
        receiverRole: recvRow.role,
        isFemaleCreator: isCreator,
        source: 'vercel-cjs',
      };

      const { data: rpcResult, error: rpcErr } = await auth.client.rpc('burn_call_coins_atomic', {
        p_caller_id: callerId,
        p_receiver_id: receiverId,
        p_tl_id: tlId,
        p_call_id: callId,
        p_billing_minute: billingMinute,
        p_coins_burned: coinsBurned,
        p_host_coins_earned: hostCoinsEarned,
        p_tl_coins_earned: tlCoinsEarned,
        p_metadata: metadata,
      });

      if (rpcErr) {
        console.error('[api/calls/burn] RPC error:', rpcErr.message);
        return send(res, 500, {
          success: false,
          error: { message: 'Billing RPC failed', code: 'BILLING_RPC_FAILED' },
        });
      }

      const result = rpcResult && typeof rpcResult === 'object' ? rpcResult : {};
      if (!result.success) {
        const code =
          result.code ||
          (String(result.error_message || '').includes('INSUFFICIENT')
            ? 'INSUFFICIENT_BALANCE'
            : 'BURN_FAILED');
        return send(res, code === 'INSUFFICIENT_BALANCE' ? 400 : 500, {
          success: false,
          error: {
            message: result.error_message || 'Burn failed',
            code,
          },
          coinBalance: result.new_caller_balance,
        });
      }

      return send(res, 200, {
        success: true,
        duplicate: Boolean(result.duplicate),
        coinBalance: Number(result.new_caller_balance) || 0,
        hostEarn: Number(result.host_coins_earned ?? hostCoinsEarned) || 0,
        tlEarn: Number(result.tl_coins_earned ?? tlCoinsEarned) || 0,
        coinsBurned,
        billingMinute,
        callId,
      });
    } catch (err) {
      console.error('[api/calls/burn]', err);
      return send(res, 500, {
        success: false,
        error: {
          message: (err && err.message) || 'Burn failed',
          code: 'BURN_EXCEPTION',
        },
      });
    }
  }

  return send(res, 405, { success: false, error: 'Method not allowed' });
}

async function handleGifts(path, req, res) {
  if (path !== 'gifts/send') return null;
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed' });
  try {
    const auth = await requireAuth(req);
    if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
    const body = await readJsonBody(req);
    const receiverId = String((body && body.receiverId) || '');
    const giftId = String((body && body.giftId) || '');
    if (!receiverId || !giftId) {
      return send(res, 400, { success: false, error: 'Invalid gift.' });
    }

    // Prefer server catalog cost; never trust client as sole authority
    let cost = 0;
    const { data: giftRow } = await auth.client
      .from('virtual_gifts')
      .select('id, coin_cost, cost')
      .or(`id.eq.${giftId},slug.eq.${giftId}`)
      .maybeSingle();
    if (giftRow) {
      cost = Math.max(1, Math.round(Number(giftRow.coin_cost || giftRow.cost) || 0));
    }
    if (!cost) {
      // Fallback when catalog table missing — clamp client hint
      const hinted = Math.round(Number((body && (body.coinCost || body.cost)) || 0));
      cost = hinted > 0 && hinted <= 50000 ? hinted : 10;
    }

    const { data: cfg } = await auth.client
      .from('system_configs')
      .select('female_host_share_percent')
      .eq('id', 'default')
      .maybeSingle();
    const hostSharePercent = Math.min(
      100,
      Math.max(0, Math.round(Number(cfg?.female_host_share_percent) || 30))
    );
    const hostShare = Math.floor(cost * (hostSharePercent / 100));

    // Conditional debit — fails if concurrent spend drops balance below cost
    const { data: sender, error: senderErr } = await auth.client
      .from('profiles')
      .select('id, coin_balance')
      .eq('id', auth.profileId)
      .maybeSingle();
    if (senderErr || !sender) {
      return send(res, 500, { success: false, error: 'Sender profile unavailable' });
    }
    if (Number(sender.coin_balance) < cost) {
      return send(res, 400, {
        success: false,
        error: 'Insufficient coins.',
        code: 'INSUFFICIENT',
      });
    }
    const newBal = Number(sender.coin_balance) - cost;
    const { data: debited, error: debitErr } = await auth.client
      .from('profiles')
      .update({ coin_balance: newBal, updated_at: new Date().toISOString() })
      .eq('id', auth.profileId)
      .gte('coin_balance', cost)
      .select('coin_balance')
      .maybeSingle();
    if (debitErr || !debited) {
      return send(res, 409, {
        success: false,
        error: 'Coin debit conflict — retry.',
        code: 'DEBIT_CONFLICT',
      });
    }

    const { data: receiver } = await auth.client
      .from('profiles')
      .select('id, earnings_coins, role, team_leader_id, created_by_id')
      .eq('id', receiverId)
      .maybeSingle();
    if (receiver) {
      await auth.client
        .from('profiles')
        .update({
          earnings_coins: Number(receiver.earnings_coins || 0) + hostShare,
          updated_at: new Date().toISOString(),
        })
        .eq('id', receiverId);
    }

    try {
      await auth.client.from('wallet_ledger').insert({
        user_id: auth.profileId,
        transaction_type: 'GIFT_DEBIT',
        amount: -cost,
        balance_after: Number(debited.coin_balance),
        metadata: { giftId, receiverId, kind: 'gift' },
      });
      if (receiver && hostShare > 0) {
        await auth.client.from('wallet_ledger').insert({
          user_id: receiverId,
          transaction_type: 'HOST_EARN',
          amount: hostShare,
          balance_after: Number(receiver.earnings_coins || 0) + hostShare,
          metadata: { giftId, kind: 'gift', senderId: auth.profileId },
        });
      }
    } catch (ledgerErr) {
      console.warn('[api/gifts/send] ledger write skipped', ledgerErr && ledgerErr.message);
    }

    return send(res, 200, {
      success: true,
      senderCoinBalance: Number(debited.coin_balance),
      receiverEarningsDelta: hostShare,
      giftId,
      cost,
    });
  } catch (err) {
    console.error('[api/gifts/send]', err);
    return send(res, 500, {
      success: false,
      error: (err && err.message) || 'Gift send failed',
    });
  }
}

async function handleUsersExtra(path, req, res) {
  if (path !== 'users/sync-all' && path !== 'users/me/delete') return null;

  if (path === 'users/sync-all' && req.method === 'POST') {
    const auth = await requireAuth(req);
    if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
    if (!isAdminRole(auth.role, auth.email)) {
      return send(res, 403, { success: false, error: { message: 'Admin role required.' } });
    }
    const body = await readJsonBody(req);
    const incoming = Array.isArray(body && body.users) ? body.users : [];
    let count = 0;
    for (const u of incoming) {
      if (!u || !u.id) continue;
      const payload = {
        id: u.id,
        auth_id: u.authId || u.auth_id || null,
        name: u.name,
        email: u.email,
        role: u.role,
        gender: u.gender,
        avatar_url: u.avatarUrl || u.avatar_url,
        online_status: u.onlineStatus || u.online_status || 'offline',
        updated_at: new Date().toISOString(),
      };
      Object.keys(payload).forEach((k) => payload[k] == null && delete payload[k]);
      const { error } = await auth.client.from('profiles').upsert(payload, { onConflict: 'id' });
      if (!error) count += 1;
    }
    const { data } = await auth.client.from('profiles').select('*').limit(500);
    return send(res, 200, {
      success: true,
      count: (data && data.length) || count,
      users: (data || []).map(mapProfileRow),
    });
  }

  if (path === 'users/me/delete' && req.method === 'POST') {
    const auth = await requireAuth(req);
    if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
    await readJsonBody(req);
    const warnings = [];
    await auth.client
      .from('profiles')
      .update({
        online_status: 'offline',
        is_banned: true,
        ban_reason: 'Account deleted by user',
        updated_at: new Date().toISOString(),
      })
      .eq('id', auth.profileId);
    const { error: delProf } = await auth.client.from('profiles').delete().eq('id', auth.profileId);
    if (delProf) {
      return send(res, 500, {
        success: false,
        error: { message: delProf.message, code: 'DELETE_FAILED' },
        warnings,
      });
    }
    if (auth.userId) {
      const { error: delAuth } = await auth.client.auth.admin.deleteUser(auth.userId);
      if (delAuth) warnings.push(delAuth.message);
    }
    return send(res, 200, {
      success: true,
      message: 'Account deleted',
      data: { profileDeleted: true, warnings },
    });
  }

  return send(res, 405, { success: false, error: 'Method not allowed' });
}

function profilePayloadFromBody(body, auth) {
  const raw = body || {};
  const isAdmin = isAdminRole(auth.role, auth.email);
  const id = String(raw.id || auth.profileId);
  const payload = {
    id,
    auth_id: raw.authId || raw.auth_id || (id === auth.userId ? auth.userId : undefined),
    name: raw.name,
    email: raw.email ? String(raw.email).toLowerCase().trim() : undefined,
    gender: raw.gender,
    gender_locked: raw.genderLocked ?? raw.gender_locked,
    role: isAdmin ? raw.role : undefined,
    age: raw.age != null ? Number(raw.age) : undefined,
    nationality: raw.nationality,
    country_code: raw.countryCode || raw.country_code,
    bio: raw.bio,
    interests: raw.interests,
    tags: raw.tags,
    spoken_languages: raw.spokenLanguages || raw.spoken_languages,
    avatar_url: raw.avatarUrl || raw.avatar_url,
    gallery: raw.gallery,
    is_verified: raw.isVerified ?? raw.is_verified,
    is_onboarded: raw.isOnboarded ?? raw.is_onboarded,
    online_status: raw.onlineStatus || raw.online_status,
    agency_name: raw.agencyName || raw.agency_name,
    team_leader_id: raw.teamLeaderId || raw.team_leader_id,
    created_by_id: raw.createdById || raw.created_by_id,
    has_password_set: raw.hasPasswordSet ?? raw.has_password_set,
    updated_at: new Date().toISOString(),
  };
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
  return payload;
}

async function handleSupabase(path, req, res) {
  if (!String(path || '').startsWith('supabase/')) return null;
  const auth = await requireAuth(req);
  if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });

  if (path === 'supabase/update-status' && (req.method === 'POST' || req.method === 'PUT')) {
    const body = await readJsonBody(req);
    const status = String((body && body.status) || 'online').toLowerCase();
    const onlineStatus =
      status === 'online' || status === 'busy' || status === 'offline' ? status : 'online';
    await auth.client
      .from('profiles')
      .update({
        online_status: onlineStatus,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', auth.profileId);
    return send(res, 200, { success: true, userId: auth.profileId, status: onlineStatus });
  }

  if (
    (path === 'supabase/update-profile' || path === 'supabase/upsert-profile') &&
    req.method === 'POST'
  ) {
    const body = await readJsonBody(req);
    const payload = profilePayloadFromBody(body, auth);
    if (!isAdminRole(auth.role, auth.email) && payload.id !== auth.profileId) {
      return send(res, 403, { success: false, error: { message: 'Forbidden' } });
    }
    const { data, error } = await auth.client
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .maybeSingle();
    if (error) return send(res, 500, { success: false, error: { message: error.message } });
    return send(res, 200, { success: true, user: mapProfileRow(data) });
  }

  if (path === 'supabase/user-statuses' && req.method === 'GET') {
    const { data, error } = await auth.client
      .from('profiles')
      .select('id, online_status, last_seen_at')
      .limit(1000);
    if (error) return send(res, 500, { success: false, error: error.message });
    const statuses = {};
    for (const row of data || []) {
      statuses[row.id] = {
        status: row.online_status || 'offline',
        lastSeenAt: row.last_seen_at,
      };
    }
    return send(res, 200, { success: true, statuses });
  }

  if (path === 'supabase/bulk-upsert-profiles' && req.method === 'POST') {
    if (!isAdminRole(auth.role, auth.email)) {
      return send(res, 403, { success: false, error: { message: 'Admin role required.' } });
    }
    const body = await readJsonBody(req);
    const users = Array.isArray(body && body.users) ? body.users : [];
    let count = 0;
    for (const u of users) {
      const payload = profilePayloadFromBody(u, auth);
      if (!payload.id) continue;
      const { error } = await auth.client.from('profiles').upsert(payload, { onConflict: 'id' });
      if (!error) count += 1;
    }
    return send(res, 200, { success: true, count });
  }

  return send(res, 501, {
    success: false,
    error: { message: `Unimplemented supabase path: ${path}`, code: 'VERCEL_ROUTE_NOT_IMPLEMENTED' },
  });
}

async function handleCore(path, req, res) {
  // Sub-handlers return null when path does not match; otherwise they already wrote the response.
  let r = await handlePresence(path, req, res);
  if (r !== null) return r;
  r = await handleMessages(path, req, res);
  if (r !== null) return r;
  r = await handleCalls(path, req, res);
  if (r !== null) return r;
  r = await handleGifts(path, req, res);
  if (r !== null) return r;
  r = await handleUsersExtra(path, req, res);
  if (r !== null) return r;
  r = await handleSupabase(path, req, res);
  if (r !== null) return r;
  return null;
}

module.exports = { handleCore };
