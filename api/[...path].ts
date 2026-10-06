/**
 * Single Vercel serverless entry for all /api/* routes (Hobby plan ≤12 functions).
 *
 * Handlers MUST be statically imported so Vercel bundles them into this function.
 * Dynamic import('./_lib/handlers/...') fails at runtime with:
 *   Cannot find module '/var/task/api/_lib/handlers/...'
 *
 * Heavy deps (AWS SDK via server/r2Storage) stay behind dynamic import() inside
 * those specific handlers — not at this file's top level.
 *
 * Do not import Express/server.ts here.
 */
import type { VercelReq, VercelRes } from './_lib/vercelAuth';

import health from './_lib/handlers/health';
import ping from './_lib/handlers/ping';
import r2Test from './_lib/handlers/r2Test';

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
import storageTestConnection from './_lib/handlers/storage/test-connection';

import livekitConfig from './_lib/handlers/livekit/config';
import livekitToken from './_lib/handlers/livekit/token';

import giftsSend from './_lib/handlers/gifts/send';
import supabaseUpdateStatus from './_lib/handlers/supabase/update-status';

import v1Router from './_lib/handlers/v1';
import teamleaderRouter from './_lib/handlers/teamleader';

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

function resolveHandler(path: string): Handler | null {
  if (path === 'health') return health;
  if (path === 'ping') return ping;
  if (path === 'r2-test') return r2Test;
  if (path === 'storage/test-connection') return storageTestConnection;

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
