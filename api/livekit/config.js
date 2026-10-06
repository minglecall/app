/**
 * /api/livekit/config — plain CommonJS (Hobby-safe).
 * Isolated from api/router.ts so a router boot failure cannot break LiveKit status.
 */
const { createClient } = require('@supabase/supabase-js');

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

async function requireAdmin(req) {
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

  const role = String((profile && profile.role) || '').toLowerCase();
  const email = String((profile && profile.email) || authUser.email || '').toLowerCase();
  const isAdmin =
    role === 'admin' || email === 'admin@livecall.app' || email === 'superadmin@minglecall.com';
  if (!isAdmin) {
    return {
      ok: false,
      status: 403,
      error: { message: 'Admin role required.', code: 'FORBIDDEN' },
    };
  }

  return { ok: true, userId: String((profile && profile.id) || authUser.id), email };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const auth = await requireAdmin(req);
    if (auth.ok === false) {
      return send(res, auth.status, { success: false, error: auth.error });
    }

    const livekit = livekitEnv();
    const configured = Boolean(
      livekit.wsUrl &&
        livekit.apiKey &&
        livekit.apiSecret &&
        livekit.apiKey !== 'devkey' &&
        livekit.apiSecret !== 'secret'
    );

    if (req.method === 'GET') {
      return send(res, 200, {
        success: true,
        configured,
        source: 'environment',
        wsUrl: livekit.wsUrl,
        apiKey: livekit.apiKey ? '••••••••' : '',
        message: configured
          ? 'LiveKit credentials are loaded from server environment variables.'
          : 'Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in Vercel Environment Variables.',
      });
    }

    if (req.method === 'POST') {
      return send(res, 200, {
        success: true,
        configured,
        wsUrl: livekit.wsUrl,
        message:
          'LiveKit secrets are not updated from the browser on Vercel. Set LIVEKIT_* in Project Environment Variables and Redeploy.',
      });
    }

    return send(res, 405, { success: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('[api/livekit/config]', err);
    return send(res, 500, {
      success: false,
      error: (err && err.message) || 'LiveKit config failed',
    });
  }
};
