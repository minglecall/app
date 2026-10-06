/**
 * Single Vercel serverless entry for all /api/* routes (Hobby plan ≤12 functions).
 *
 * Handlers are loaded via dynamic import() so a heavy dependency (AWS SDK / LiveKit /
 * server/r2Storage+dotenv) cannot crash the whole function at cold-start. That was
 * causing FUNCTION_INVOCATION_FAILED even for /api/health and /api/r2-test.
 *
 * Do not import Express/server.ts here.
 */
import type { VercelReq, VercelRes } from './_lib/vercelAuth';

type Handler = (req: VercelReq, res: VercelRes) => unknown | Promise<unknown>;

const AVAILABLE_ROUTES = [
  'GET /api/health',
  'GET /api/ping',
  'GET /api/admin/api-health',
  'GET|POST /api/r2-test',
  'GET|POST /api/admin/infra-config',
  'POST /api/admin/create-team-leader',
  'POST /api/admin/cms/seed-defaults',
  'POST /api/auth/send-otp',
  'POST /api/auth/verify-otp',
  'POST /api/auth/login-password',
  'POST /api/auth/register-bootstrap',
  'POST /api/auth/reset-password',
  'POST /api/auth/update-password',
  'GET|POST /api/users',
  'POST /api/users/sync-all',
  'POST /api/users/me/delete',
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

function pathAfterApi(req: VercelReq): string {
  // Vercel Node catch-all may expose segments on query.path (string | string[]).
  const q = (req as any).query?.path;
  if (typeof q === 'string' && q.trim()) {
    return q.replace(/^\/+/, '').replace(/\/+$/, '');
  }
  if (Array.isArray(q) && q.length > 0) {
    return q.map(String).join('/').replace(/^\/+/, '').replace(/\/+$/, '');
  }

  try {
    const pathname = new URL(req.url || '', 'http://localhost').pathname;
    return pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
  } catch {
    return String(req.url || '')
      .split('?')[0]
      .replace(/^\/api\/?/, '')
      .replace(/\/+$/, '');
  }
}

function notImplemented(req: VercelReq, res: VercelRes) {
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
        path: String(req.url || ''),
      },
      vercel: {
        availableRoutes: AVAILABLE_ROUTES,
        signaling: 'supabase-realtime',
        note: 'Leave VITE_API_BASE_URL unset. Point minglecall.com DNS to this Vercel project. All /api/* routes share one Hobby-safe serverless function.',
      },
    })
  );
}

async function loadHandler(path: string): Promise<Handler | null> {
  // Lightweight probes first — no AWS/LiveKit/dotenv.
  if (path === 'health') return (await import('./_lib/handlers/health')).default;
  if (path === 'ping') return (await import('./_lib/handlers/ping')).default;
  if (path === 'r2-test') return (await import('./_lib/handlers/r2Test')).default;
  if (path === 'storage/test-connection') {
    return (await import('./_lib/handlers/storage/test-connection')).default;
  }

  if (path === 'auth/send-otp') return (await import('./_lib/handlers/auth/send-otp')).default;
  if (path === 'auth/verify-otp') return (await import('./_lib/handlers/auth/verify-otp')).default;
  if (path === 'auth/login-password') {
    return (await import('./_lib/handlers/auth/login-password')).default;
  }
  if (path === 'auth/register-bootstrap') {
    return (await import('./_lib/handlers/auth/register-bootstrap')).default;
  }
  if (path === 'auth/reset-password') {
    return (await import('./_lib/handlers/auth/reset-password')).default;
  }
  if (path === 'auth/update-password') {
    return (await import('./_lib/handlers/auth/update-password')).default;
  }

  if (path === 'admin/api-health') return (await import('./_lib/handlers/admin/api-health')).default;
  if (path === 'admin/infra-config') {
    return (await import('./_lib/handlers/admin/infra-config')).default;
  }
  if (path === 'admin/create-team-leader') {
    return (await import('./_lib/handlers/admin/create-team-leader')).default;
  }
  if (path === 'admin/cms/seed-defaults') {
    return (await import('./_lib/handlers/admin/cms-seed-defaults')).default;
  }

  if (path === 'users' || path === 'users/index') {
    return (await import('./_lib/handlers/users/index')).default;
  }
  if (path === 'users/sync-all') return (await import('./_lib/handlers/users/sync-all')).default;
  if (path === 'users/me/delete') return (await import('./_lib/handlers/users/me-delete')).default;

  if (path === 'messages' || path === 'messages/index') {
    return (await import('./_lib/handlers/messages/index')).default;
  }
  if (path === 'messages/read') return (await import('./_lib/handlers/messages/read')).default;
  if (path.startsWith('messages/conversation/')) {
    return (await import('./_lib/handlers/messages/conversation')).default;
  }

  if (path === 'presence' || path === 'presence/index') {
    return (await import('./_lib/handlers/presence/index')).default;
  }
  if (path === 'presence/heartbeat') {
    return (await import('./_lib/handlers/presence/heartbeat')).default;
  }

  if (path === 'calls/sync') return (await import('./_lib/handlers/calls/sync')).default;
  if (path === 'calls/burn') return (await import('./_lib/handlers/calls/burn')).default;

  if (path === 'storage/config') return (await import('./_lib/handlers/storage/config')).default;
  if (path === 'storage/presigned-url') {
    return (await import('./_lib/handlers/storage/presigned-url')).default;
  }

  if (path === 'livekit/config') return (await import('./_lib/handlers/livekit/config')).default;
  if (path === 'livekit/token') return (await import('./_lib/handlers/livekit/token')).default;

  if (path === 'gifts/send') return (await import('./_lib/handlers/gifts/send')).default;
  if (path === 'supabase/update-status') {
    return (await import('./_lib/handlers/supabase/update-status')).default;
  }

  if (path === 'v1' || path.startsWith('v1/')) return (await import('./_lib/handlers/v1')).default;
  if (path === 'teamleader' || path.startsWith('teamleader/')) {
    return (await import('./_lib/handlers/teamleader')).default;
  }

  return null;
}

export default async function handler(req: VercelReq, res: VercelRes) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    const path = pathAfterApi(req);
    let matched: Handler | null = null;
    try {
      matched = await loadHandler(path);
    } catch (loadErr: any) {
      console.error('[api/[...path]] load failed', path, loadErr);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(
          JSON.stringify({
            success: false,
            error: {
              message: loadErr?.message || 'Failed to load API route handler',
              code: 'VERCEL_HANDLER_LOAD_FAILED',
              path,
            },
          })
        );
      }
      return;
    }

    if (!matched) {
      return notImplemented(req, res);
    }

    return await matched(req, res);
  } catch (err: any) {
    console.error('[api/[...path]]', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(
        JSON.stringify({
          success: false,
          error: {
            message: err?.message || 'Internal server error',
            code: 'VERCEL_API_ERROR',
          },
        })
      );
    }
  }
}
