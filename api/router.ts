/**
 * Vercel API router — all nested /api/* routes rewrite here (see vercel.json).
 * Standalone probes stay as api/health.js, api/ping.js, api/r2-test.js.
 */
import type { VercelReq, VercelRes } from './_lib/vercelAuth';

import authSendOtp from './_lib/handlers/auth/send-otp';
import authVerifyOtp from './_lib/handlers/auth/verify-otp';
import authLoginPassword from './_lib/handlers/auth/login-password';
import authRegisterBootstrap from './_lib/handlers/auth/register-bootstrap';
import authResetPassword from './_lib/handlers/auth/reset-password';
import authUpdatePassword from './_lib/handlers/auth/update-password';

import adminApiHealth from './_lib/handlers/admin/api-health';
import adminInfraConfig from './_lib/handlers/admin/infra-config';
import adminCreateTeamLeader from './_lib/handlers/admin/create-team-leader';
import adminCmsSeedDefaults from './_lib/handlers/admin/cms-seed-defaults';

import users from './_lib/handlers/users/index';
import usersSyncAll from './_lib/handlers/users/sync-all';
import usersMeDelete from './_lib/handlers/users/me-delete';

import messages from './_lib/handlers/messages/index';
import messagesRead from './_lib/handlers/messages/read';
import messagesConversation from './_lib/handlers/messages/conversation';

import presence from './_lib/handlers/presence/index';
import presenceHeartbeat from './_lib/handlers/presence/heartbeat';

import callsSync from './_lib/handlers/calls/sync';
import callsBurn from './_lib/handlers/calls/burn';

import storageConfig from './_lib/handlers/storage/config';
import storagePresignedUrl from './_lib/handlers/storage/presigned-url';

import livekitConfig from './_lib/handlers/livekit/config';
import livekitToken from './_lib/handlers/livekit/token';

import giftsSend from './_lib/handlers/gifts/send';
import supabaseUpdateStatus from './_lib/handlers/supabase/update-status';

import v1Router from './_lib/handlers/v1';
import teamleaderRouter from './_lib/handlers/teamleader';

type Handler = (req: VercelReq, res: VercelRes) => unknown | Promise<unknown>;

const AVAILABLE_ROUTES = [
  'GET /api/health (standalone)',
  'GET /api/ping (standalone)',
  'GET|POST /api/r2-test (standalone)',
  'GET /api/admin/api-health',
  'GET|POST /api/admin/infra-config',
  'POST /api/auth/*',
  'GET|POST /api/users',
  'GET /api/storage/config',
  'GET|POST /api/livekit/config',
  'POST /api/livekit/token',
  'ALL /api/v1/*',
  'ALL /api/teamleader/*',
];

function pathAfterApi(req: VercelReq): string {
  // Prefer rewrite query (?path=admin/api-health) so nested routes survive rewrite → /api/router
  const q = (req as any).query?.path ?? (req as any).query?.__p;
  if (typeof q === 'string' && q.trim()) {
    return q.replace(/^\/+/, '').replace(/\/+$/, '');
  }
  if (Array.isArray(q) && q.length > 0) {
    return q.map(String).join('/').replace(/^\/+/, '').replace(/\/+$/, '');
  }

  try {
    const pathname = new URL(req.url || '', 'http://localhost').pathname;
    // Ignore /api/router itself when rewrite destination is used without query
    if (pathname === '/api/router' || pathname === '/api/router/') {
      return '';
    }
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
        message: 'This API route is not implemented on the Vercel serverless deployment yet.',
        code: 'VERCEL_ROUTE_NOT_IMPLEMENTED',
        path: String(req.url || ''),
      },
      vercel: { availableRoutes: AVAILABLE_ROUTES, signaling: 'supabase-realtime' },
    })
  );
}

function resolveHandler(path: string): Handler | null {
  if (
    !path ||
    path === 'health' ||
    path === 'ping' ||
    path === 'r2-test' ||
    path === 'storage/test-connection' ||
    path === 'router'
  ) {
    return null;
  }

  if (path === 'auth/send-otp') return authSendOtp;
  if (path === 'auth/verify-otp') return authVerifyOtp;
  if (path === 'auth/login-password') return authLoginPassword;
  if (path === 'auth/register-bootstrap') return authRegisterBootstrap;
  if (path === 'auth/reset-password') return authResetPassword;
  if (path === 'auth/update-password') return authUpdatePassword;

  if (path === 'admin/api-health') return adminApiHealth;
  if (path === 'admin/infra-config') return adminInfraConfig;
  if (path === 'admin/create-team-leader') return adminCreateTeamLeader;
  if (path === 'admin/cms/seed-defaults') return adminCmsSeedDefaults;

  if (path === 'users' || path === 'users/index') return users;
  if (path === 'users/sync-all') return usersSyncAll;
  if (path === 'users/me/delete') return usersMeDelete;

  if (path === 'messages' || path === 'messages/index') return messages;
  if (path === 'messages/read') return messagesRead;
  if (path.startsWith('messages/conversation/')) return messagesConversation;

  if (path === 'presence' || path === 'presence/index') return presence;
  if (path === 'presence/heartbeat') return presenceHeartbeat;

  if (path === 'calls/sync') return callsSync;
  if (path === 'calls/burn') return callsBurn;

  if (path === 'storage/config') return storageConfig;
  if (path === 'storage/presigned-url') return storagePresignedUrl;

  if (path === 'livekit/config') return livekitConfig;
  if (path === 'livekit/token') return livekitToken;

  if (path === 'gifts/send') return giftsSend;
  if (path === 'supabase/update-status') return supabaseUpdateStatus;

  if (path === 'v1' || path.startsWith('v1/')) return v1Router;
  if (path === 'teamleader' || path.startsWith('teamleader/')) return teamleaderRouter;

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
    const matched = resolveHandler(path);
    if (!matched) {
      return notImplemented(req, res);
    }

    return await matched(req, res);
  } catch (err: any) {
    console.error('[api/router]', pathAfterApi(req), err);
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
