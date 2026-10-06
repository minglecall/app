/**
 * Catch-all for unimplemented /api/* on Vercel.
 * Returns JSON 501 — never import Express/server.ts (that causes FUNCTION_INVOCATION_FAILED).
 */
module.exports = function handler(req, res) {
  const url = String(req.url || '');
  const available = [
    'GET /api/health',
    'GET /api/ping',
    'GET|POST /api/r2-test',
    'GET|POST /api/admin/infra-config',
    'POST /api/admin/create-team-leader',
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
          'This API route is not implemented on the Vercel serverless deployment. Run the full Express server (npm run start / npm run dev) for complete /api + /ws coverage, or use a dedicated Node host for the API while Vercel serves the SPA.',
        code: 'VERCEL_ROUTE_NOT_IMPLEMENTED',
        path: url,
      },
      vercel: {
        availableRoutes: available,
        note: 'Call signaling (/ws), OTP auth, messaging, matching, gifts, finance, and most admin routes require the persistent Express process.',
      },
    })
  );
};
