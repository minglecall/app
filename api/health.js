/**
 * Deployment readiness probe — lists which API surfaces exist on this Vercel build.
 */
module.exports = function handler(_req, res) {
  const available = {
    health: true,
    ping: true,
    r2Test: true,
    adminInfraConfig: true,
    adminCreateTeamLeader: true,
    livekitConfig: true,
    livekitToken: true,
    storageConfig: true,
    storagePresignedUrl: true,
    storageTestConnection: true,
  };

  const missingCritical = [
    '/api/auth/* (OTP, login-password, register-bootstrap, reset-password)',
    '/api/users (GET/POST profile sync)',
    '/api/messages/*',
    '/api/v1/matches|favorites|friends|blocks|feed|reviews|reports|finance',
    '/api/calls/*',
    '/api/gifts/send',
    '/api/presence|/ws (WebSocket signaling)',
    '/api/teamleader/*',
    '/api/rewards/*',
    '/api/creator/*',
    '/api/admin/* (except infra-config + create-team-leader)',
    '/api/setup/*',
    '/api/supabase/*',
  ];

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(
    JSON.stringify({
      success: true,
      ok: true,
      vercel: Boolean(process.env.VERCEL),
      node: process.version,
      time: new Date().toISOString(),
      env: {
        supabase: Boolean(
          (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) &&
            process.env.SUPABASE_SERVICE_ROLE_KEY
        ),
        supabaseAnon: Boolean(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY),
        r2: Boolean(
          process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY
        ),
        livekit: Boolean(
          process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET
        ),
      },
      api: {
        mode: 'vercel-partial',
        available,
        missingCritical,
        recommendation:
          'For full product (calls, chat, matching, OTP, presence): host Express+ws on a Node VPS/Railway and point api.minglecall.com there; keep the SPA on Vercel (minglecall.com).',
      },
    })
  );
};
