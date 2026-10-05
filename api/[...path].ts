/**
 * Catch-all stub — do NOT import server.ts / Express here.
 * Booting the full Node app on Vercel causes FUNCTION_INVOCATION_FAILED.
 * Use dedicated lightweight routes under /api/* instead.
 */
import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url || '';
  res.statusCode = 501;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(
    JSON.stringify({
      success: false,
      error: {
        message:
          'This API path is not available on the Vercel serverless stub. Use dedicated routes (/api/r2-test, /api/admin/infra-config, /api/storage/presigned-url, /api/livekit/token, /api/health) or run the full Express server (npm run start) for complete /api coverage including WebSockets.',
        code: 'VERCEL_ROUTE_NOT_IMPLEMENTED',
        path: url,
      },
    })
  );
}
