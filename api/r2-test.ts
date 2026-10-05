/**
 * /api/r2-test — fully self-contained (no local imports) so Vercel cold-start
 * cannot crash via Express/server.ts or shared helpers.
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function clean(v: string | undefined): string {
  return String(v || '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

function bearer(req: IncomingMessage): string | null {
  const h = req.headers.authorization || (req.headers as any).Authorization;
  if (!h || typeof h !== 'string') return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'POST' && req.method !== 'GET') {
      return send(res, 405, { success: false, message: 'Method not allowed' });
    }

    const supabaseUrl = clean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
    const serviceKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const accountId = clean(process.env.R2_ACCOUNT_ID);
    const accessKeyId = clean(process.env.R2_ACCESS_KEY_ID);
    const secretAccessKey = clean(process.env.R2_SECRET_ACCESS_KEY);
    const bucketName = clean(process.env.R2_BUCKET_NAME) || 'datingappbucket';

    const present = {
      VITE_SUPABASE_URL: Boolean(supabaseUrl),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(serviceKey),
      R2_ACCOUNT_ID: Boolean(accountId),
      R2_ACCESS_KEY_ID: Boolean(accessKeyId),
      R2_SECRET_ACCESS_KEY: Boolean(secretAccessKey),
      R2_BUCKET_NAME: Boolean(bucketName),
    };

    if (!supabaseUrl || !serviceKey) {
      return send(res, 503, {
        success: false,
        present,
        message:
          'Missing Supabase server env on this deployment (VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).',
      });
    }

    const token = bearer(req);
    if (!token) {
      return send(res, 401, { success: false, message: 'Missing Authorization Bearer token.' });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return send(res, 401, { success: false, message: 'Invalid or expired admin session. Sign in again.' });
    }

    const authUser = userData.user;
    const { data: profile } = await admin
      .from('profiles')
      .select('id, role, email')
      .or(`auth_id.eq.${authUser.id},id.eq.${authUser.id}`)
      .maybeSingle();

    const role = String(profile?.role || '').toLowerCase();
    const email = String(profile?.email || authUser.email || '').toLowerCase();
    const isAdmin =
      role === 'admin' || email === 'admin@livecall.app' || email === 'superadmin@minglecall.com';
    if (!isAdmin) {
      return send(res, 403, { success: false, message: 'Admin role required.' });
    }

    if (!accountId || !accessKeyId || !secretAccessKey) {
      return send(res, 503, {
        success: false,
        configured: false,
        present,
        message:
          'R2 env incomplete for this Production deployment. Confirm R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME exist for Production (not only Preview/Development), with no quotes, then Redeploy.',
      });
    }

    const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const started = Date.now();
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 1,
      })
    );

    return send(res, 200, {
      success: true,
      configured: true,
      present,
      bucket: bucketName,
      latencyMs: Date.now() - started,
      message: `Cloudflare R2 bucket "${bucketName}" is reachable using Vercel environment credentials.`,
    });
  } catch (err: any) {
    console.error('[api/r2-test]', err);
    const code = err?.name || err?.Code || '';
    const httpStatus = err?.$metadata?.httpStatusCode;
    let message = err?.message || 'R2 connectivity test failed';
    if (code === 'NoSuchBucket' || httpStatus === 404) {
      message = `Bucket not found for R2_BUCKET_NAME. Create it in Cloudflare R2 or fix the env value.`;
    } else if (code === 'InvalidAccessKeyId' || code === 'SignatureDoesNotMatch' || httpStatus === 403) {
      message =
        'R2 authentication failed (403). Recreate the R2 API token and update R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY in Vercel Production env (no quotes), then Redeploy.';
    }
    // Always 200 with success:false so the Admin UI never sees a blank Vercel FUNCTION_INVOCATION_FAILED page
    return send(res, 200, {
      success: false,
      message,
      detail: String(code || ''),
      httpStatus: httpStatus || null,
    });
  }
}
