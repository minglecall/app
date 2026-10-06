/**
 * /api/livekit/token — plain CommonJS (Hobby-safe).
 * Isolated from api/router.ts so a router boot failure cannot break LiveKit token minting.
 */
const { createClient } = require('@supabase/supabase-js');
const { AccessToken } = require('livekit-server-sdk');

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function clean(v) {
  return String(v || '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

function bearer(req) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (!h || typeof h !== 'string') return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function livekitEnv() {
  return {
    wsUrl: clean(process.env.LIVEKIT_URL),
    apiKey: clean(process.env.LIVEKIT_API_KEY),
    apiSecret: clean(process.env.LIVEKIT_API_SECRET),
  };
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function requireAuth(req) {
  const supabaseUrl = clean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
  const serviceKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseUrl || !serviceKey) {
    return {
      ok: false,
      status: 503,
      error: {
        message:
          'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server environment (Vercel Project Settings).',
        code: 'ENV_MISSING',
      },
    };
  }

  const token = bearer(req);
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: { message: 'Missing Authorization Bearer token.', code: 'UNAUTHORIZED' },
    };
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData || !userData.user) {
    return {
      ok: false,
      status: 401,
      error: { message: 'Invalid or expired authentication token.', code: 'UNAUTHORIZED' },
    };
  }

  const authUser = userData.user;
  const { data: profile } = await admin
    .from('profiles')
    .select('id, role, email')
    .or(`auth_id.eq.${authUser.id},id.eq.${authUser.id}`)
    .maybeSingle();

  const profileId = String((profile && profile.id) || authUser.id);
  const role = String((profile && profile.role) || '').toLowerCase();
  const email = String((profile && profile.email) || authUser.email || '').toLowerCase();

  return {
    ok: true,
    userId: authUser.id,
    profileId,
    role,
    email,
    user: authUser,
    client: admin,
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      return send(res, 405, { error: 'Method not allowed' });
    }

    const auth = await requireAuth(req);
    if (auth.ok === false) {
      return send(res, auth.status, {
        error: (auth.error && auth.error.message) || 'Unauthorized',
        ...auth.error,
      });
    }

    const body = await readJsonBody(req);
    const roomName = String(body.roomName || '').trim();
    const identity = auth.profileId;
    const isAdmin =
      auth.role === 'admin' ||
      auth.email === 'admin@livecall.app' ||
      auth.email === 'superadmin@minglecall.com';

    if (!roomName || !identity) {
      return send(res, 400, { error: 'roomName is required' });
    }

    const isAdminTestRoom = roomName.startsWith('admin_test_room_');
    if (isAdminTestRoom && !isAdmin) {
      return send(res, 403, { error: 'Admin test rooms require admin privileges.' });
    }

    if (!isAdminTestRoom && !isAdmin) {
      const memberHint =
        roomName.includes(identity) ||
        roomName.includes(auth.userId) ||
        roomName.startsWith('call_') ||
        roomName.startsWith('lk_');

      let dbMember = false;
      if (!memberHint && auth.client) {
        const { data: callRow } = await auth.client
          .from('call_logs')
          .select('caller_id, receiver_id, host_id')
          .eq('id', roomName)
          .maybeSingle();
        const ids = [
          callRow && callRow.caller_id,
          callRow && callRow.receiver_id,
          callRow && callRow.host_id,
        ].map((v) => String(v || ''));
        dbMember = ids.includes(identity) || ids.includes(auth.userId);
      }

      if (!memberHint && !dbMember) {
        return send(res, 403, {
          error:
            'Not authorized for this LiveKit room. Join only works for calls you participate in.',
        });
      }
    }

    const livekit = livekitEnv();
    if (
      !livekit.apiKey ||
      !livekit.apiSecret ||
      livekit.apiKey === 'devkey' ||
      livekit.apiSecret === 'secret'
    ) {
      return send(res, 200, {
        configured: false,
        token: null,
        wsUrl: livekit.wsUrl || null,
        message:
          'LiveKit credentials missing. Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET in Vercel env.',
      });
    }

    const displayName =
      (typeof body.name === 'string' && body.name.trim()) ||
      (auth.user && auth.user.user_metadata && auth.user.user_metadata.full_name) ||
      auth.email ||
      identity;

    const at = new AccessToken(livekit.apiKey, livekit.apiSecret, {
      identity,
      name: displayName,
      ttl: '1h',
    });
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      hidden: false,
    });

    const token = await at.toJwt();
    return send(res, 200, {
      configured: true,
      token,
      wsUrl: livekit.wsUrl,
      source: 'environment',
    });
  } catch (err) {
    console.error('[api/livekit/token]', err);
    return send(res, 500, {
      configured: false,
      token: null,
      error: 'Failed to generate token',
      message: (err && err.message) || 'Token signing failed',
    });
  }
};
