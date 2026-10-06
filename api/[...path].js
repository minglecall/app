/**
 * Catch-all for unimplemented /api/* on Vercel.
 * Returns JSON 501 — never import Express/server.ts (that causes FUNCTION_INVOCATION_FAILED).
 */
module.exports = function handler(req, res) {
  const url = String(req.url || '');
  const available = [
    'GET /api/health',
    'GET /api/ping',
    'GET /api/admin/api-health',
    'GET|POST /api/r2-test',
    'GET|POST /api/admin/infra-config',
    'POST /api/admin/create-team-leader',
    'POST /api/auth/send-otp',
    'POST /api/auth/verify-otp',
    'POST /api/auth/login-password',
    'POST /api/auth/register-bootstrap',
    'POST /api/auth/reset-password',
    'POST /api/auth/update-password',
    'GET|POST /api/users',
    'POST /api/users/sync-all',
    'GET|POST /api/presence',
    'POST /api/presence/heartbeat',
    'POST /api/supabase/update-status',
    'GET|POST /api/messages',
    'GET /api/messages/conversation/:id',
    'POST /api/messages/read',
    'ALL /api/v1/* (matches, friends, blocks, favorites, feed)',
    'POST /api/gifts/send',
    'POST /api/calls/sync',
    'POST /api/calls/burn',
    'ALL /api/teamleader/*',
    'GET|POST /api/livekit/config',
    'POST /api/livekit/token',
    'GET /api/storage/config',
    'POST /api/storage/presigned-url',
    'POST /api/storage/test-connection',
  ];

  res.statusCode = 501;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(
    JSON.stringify({
      success: false,
      error: {
        message:
          'This API route is not implemented on the Vercel serverless deployment yet. Core auth, users, presence, messages, social (v1), gifts, calls, LiveKit, and storage are available. Signaling uses Supabase Realtime (not /ws).',
        code: 'VERCEL_ROUTE_NOT_IMPLEMENTED',
        path: url,
      },
      vercel: {
        availableRoutes: available,
        signaling: 'supabase-realtime',
        note: 'Leave VITE_API_BASE_URL unset. Point minglecall.com DNS to this Vercel project.',
      },
    })
  );
};
