/**
 * R2 connectivity test — uses R2_* from server env.
 * Optional body overrides are ignored when masked / empty.
 */
import {
  S3Client,
  HeadBucketCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import {
  sendJson,
  readJsonBody,
  requireAdminFromBearer,
  getR2Env,
  isMaskedSecret,
  type VercelReq,
  type VercelRes,
} from '../_lib/vercelAuth';

export default async function handler(req: VercelReq, res: VercelRes) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      return sendJson(res, 405, { success: false, message: 'Method not allowed' });
    }

    const auth = await requireAdminFromBearer(req);
    if (!auth.ok) {
      return sendJson(res, auth.status, { success: false, message: auth.error?.message, error: auth.error });
    }

    const env = getR2Env();
    const body = await readJsonBody(req);

    const accountId =
      typeof body.accountId === 'string' && body.accountId.trim() && !isMaskedSecret(body.accountId)
        ? body.accountId.trim()
        : env.accountId;
    const accessKeyId =
      typeof body.accessKeyId === 'string' && body.accessKeyId.trim() && !isMaskedSecret(body.accessKeyId)
        ? body.accessKeyId.trim()
        : env.accessKeyId;
    const secretAccessKey =
      typeof body.secretAccessKey === 'string' &&
      body.secretAccessKey.trim() &&
      !isMaskedSecret(body.secretAccessKey)
        ? body.secretAccessKey.trim()
        : env.secretAccessKey;
    const bucketName =
      typeof body.bucketName === 'string' && body.bucketName.trim()
        ? body.bucketName.trim()
        : env.bucketName;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      return sendJson(res, 503, {
        success: false,
        configured: false,
        message:
          'R2 is not configured on the server. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in Vercel Environment Variables, then Redeploy.',
      });
    }

    const started = Date.now();
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    await client.send(new HeadBucketCommand({ Bucket: bucketName }));
    await client.send(new ListObjectsV2Command({ Bucket: bucketName, MaxKeys: 1 }));

    return sendJson(res, 200, {
      success: true,
      configured: true,
      bucket: bucketName,
      latencyMs: Date.now() - started,
      source: 'environment',
      message: `Connected to R2 bucket "${bucketName}" using server environment credentials.`,
    });
  } catch (err: any) {
    console.error('[api/storage/test-connection]', err);
    return sendJson(res, 500, {
      success: false,
      message: err?.message || 'R2 connectivity test failed',
    });
  }
}
