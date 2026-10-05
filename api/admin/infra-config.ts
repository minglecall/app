/**
 * Lightweight Vercel handler for Admin → Infrastructure Save.
 * Avoids booting the full Express + WebSocket + Vite server stack.
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

type Req = IncomingMessage & { body?: any; method?: string; headers: IncomingMessage['headers'] };
type Res = ServerResponse & { status?: (code: number) => Res; json?: (body: any) => void };

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
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

function extractBearer(req: IncomingMessage): string | null {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export default async function handler(req: Req, res: Res) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
      return sendJson(res, 405, { success: false, error: { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' } });
    }

    const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

    if (!supabaseUrl || !serviceKey) {
      return sendJson(res, 503, {
        success: false,
        error: {
          message:
            'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Vercel Environment Variables. Set them and Redeploy.',
          code: 'ENV_MISSING',
        },
      });
    }

    const token = extractBearer(req);
    if (!token) {
      return sendJson(res, 401, {
        success: false,
        error: { message: 'Missing Authorization Bearer token.', code: 'UNAUTHORIZED' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return sendJson(res, 401, {
        success: false,
        error: { message: 'Invalid or expired authentication token.', code: 'UNAUTHORIZED' },
      });
    }

    const authUser = userData.user;
    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, email')
      .or(`auth_id.eq.${authUser.id},id.eq.${authUser.id}`)
      .maybeSingle();

    const role = String(profile?.role || '').toLowerCase();
    const email = String(profile?.email || authUser.email || '').toLowerCase();
    const isAdmin = role === 'admin' || email === 'admin@livecall.app' || email === 'superadmin@minglecall.com';
    if (!isAdmin) {
      return sendJson(res, 403, {
        success: false,
        error: { message: 'Admin role required.', code: 'FORBIDDEN' },
      });
    }

    if (req.method === 'GET') {
      return sendJson(res, 200, {
        success: true,
        config: {
          supabaseUrl,
          supabaseAnonKey: anonKey ? '••••••••' : '',
          supabaseConfigured: Boolean(supabaseUrl && anonKey),
          r2Configured: Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID),
          vercel: true,
        },
      });
    }

    const body = await readJsonBody(req);
    const nextUrl =
      typeof body.supabaseUrl === 'string' && body.supabaseUrl.trim() && !body.supabaseUrl.includes('your-project')
        ? body.supabaseUrl.trim()
        : supabaseUrl;
    const nextAnon =
      typeof body.supabaseAnonKey === 'string' &&
      body.supabaseAnonKey.trim() &&
      !body.supabaseAnonKey.startsWith('••••')
        ? body.supabaseAnonKey.trim()
        : anonKey;

    // Runtime process.env update is ephemeral on Vercel — tell the client to also keep
    // Project Settings env vars in sync. Browser client is updated by the Admin UI.
    if (nextUrl) {
      process.env.VITE_SUPABASE_URL = nextUrl;
      process.env.SUPABASE_URL = nextUrl;
    }
    if (nextAnon) {
      process.env.VITE_SUPABASE_ANON_KEY = nextAnon;
      process.env.SUPABASE_ANON_KEY = nextAnon;
    }

    return sendJson(res, 200, {
      success: true,
      message:
        'Accepted. Browser client can use these public keys now. For a permanent deploy, set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in Vercel → Settings → Environment Variables, then Redeploy.',
      config: {
        supabaseConfigured: Boolean(nextUrl && nextAnon),
        vercel: true,
      },
    });
  } catch (err: any) {
    console.error('[api/admin/infra-config]', err);
    return sendJson(res, 500, {
      success: false,
      error: { message: err?.message || 'Infrastructure config handler failed', code: 'HANDLER_FAILED' },
    });
  }
}
