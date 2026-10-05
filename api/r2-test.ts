/**
 * Dedicated R2 probe at /api/r2-test (avoids catch-all Express collisions).
 * Uses only R2_* from Vercel/server environment.
 */
import {
  sendJson,
  requireAdminFromBearer,
  getR2Env,
  type VercelReq,
  type VercelRes,
} from './_lib/vercelAuth';

export default async function handler(req: VercelReq, res: VercelRes) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'POST' && req.method !== 'GET') {
      return sendJson(res, 405, { success: false, message: 'Method not allowed' });
    }

    const auth = await requireAdminFromBearer(req);
    if (!auth.ok) {
      return sendJson(res, auth.status, {
        success: false,
        message: auth.error?.message || 'Unauthorized',
        error: auth.error,
      });
    }

    const env = getR2Env();
    const present = {
      R2_ACCOUNT_ID: Boolean(env.accountId),
      R2_ACCESS_KEY_ID: Boolean(env.accessKeyId),
      R2_SECRET_ACCESS_KEY: Boolean(env.secretAccessKey),
      R2_BUCKET_NAME: Boolean(env.bucketName),
    };

    if (!env.accountId || !env.accessKeyId || !env.secretAccessKey || !env.bucketName) {
      return sendJson(res, 503, {
        success: false,
        configured: false,
        present,
        message:
          'R2 env incomplete on this deployment. In Vercel → Settings → Environment Variables confirm R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME are set for Production, then Redeploy.',
      });
    }

    // Dynamic import so a cold-start SDK issue returns JSON instead of crashing the worker.
    const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const started = Date.now();
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.accessKeyId,
        secretAccessKey: env.secretAccessKey,
      },
      forcePathStyle: false,
    });

    await client.send(
      new ListObjectsV2Command({
        Bucket: env.bucketName,
        MaxKeys: 1,
      })
    );

    return sendJson(res, 200, {
      success: true,
      configured: true,
      present,
      bucket: env.bucketName,
      endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
      latencyMs: Date.now() - started,
      source: 'environment',
      message: `Cloudflare R2 bucket "${env.bucketName}" is reachable using Vercel environment credentials.`,
    });
  } catch (err: any) {
    console.error('[api/r2-test]', err);
    const code = err?.name || err?.Code || '';
    const status = err?.$metadata?.httpStatusCode;
    let message = err?.message || 'R2 connectivity test failed';

    if (code === 'NoSuchBucket' || status === 404) {
      message = `Bucket not found. Check R2_BUCKET_NAME matches a bucket in this Cloudflare account.`;
    } else if (code === 'InvalidAccessKeyId' || code === 'SignatureDoesNotMatch' || status === 403) {
      message =
        'R2 authentication failed (403). Check R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY in Vercel (no extra quotes), and that the token can list the bucket.';
    }

    return sendJson(res, 200, {
      success: false,
      configured: true,
      message,
      detail: String(code || ''),
      httpStatus: status || null,
    });
  }
}
