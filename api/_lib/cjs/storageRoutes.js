/**
 * /api/storage/* — R2 config + SigV4 presigned PUT (no AWS SDK).
 */
const { createHash, createHmac, randomUUID } = require('crypto');
const { send, clean, readJsonBody, requireAuth, isAdminRole } = require('./helpers');

function hmac(key, data) {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}
function sha256Hex(data) {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

function r2Env() {
  return {
    accountId: clean(process.env.R2_ACCOUNT_ID),
    accessKeyId: clean(process.env.R2_ACCESS_KEY_ID),
    secretAccessKey: clean(process.env.R2_SECRET_ACCESS_KEY),
    bucketName: clean(process.env.R2_BUCKET_NAME) || 'datingappbucket',
    publicUrl: clean(process.env.R2_PUBLIC_URL).replace(/\/$/, ''),
  };
}

function sanitizeFilename(filename) {
  const raw = String(filename || 'upload.bin').trim();
  const base = raw.split(/[/\\]/).pop() || 'upload.bin';
  return base.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 180) || 'upload.bin';
}

function buildStorageKey(userId, category, filename) {
  const safeUser = String(userId || 'anon').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cat = String(category || 'chat_media').replace(/[^a-zA-Z0-9_-]/g, '_') || 'chat_media';
  const name = sanitizeFilename(filename);
  return `uploads/${cat}/${safeUser}/${randomUUID()}-${name}`;
}

function signPutUrl({ accountId, accessKeyId, secretAccessKey, bucketName, key, contentType, expiresIn }) {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';
  const method = 'PUT';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalUri = `/${encodeURIComponent(bucketName).replace(/%2F/g, '/')}/${key
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
  // Simpler: encode each path segment
  const keyPath = key
    .split('/')
    .map((p) => encodeURIComponent(p))
    .join('/');
  const uri = `/${bucketName}/${keyPath}`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const canonicalQuery = [
    `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
    `X-Amz-Credential=${encodeURIComponent(`${accessKeyId}/${credentialScope}`)}`,
    `X-Amz-Date=${amzDate}`,
    `X-Amz-Expires=${expiresIn}`,
    `X-Amz-SignedHeaders=${encodeURIComponent(signedHeaders)}`,
  ].join('&');

  // Use query-string style presign
  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    method,
    `/${bucketName}/${keyPath}`,
    [
      `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
      `X-Amz-Credential=${encodeURIComponent(`${accessKeyId}/${credentialScope}`)}`,
      `X-Amz-Date=${amzDate}`,
      `X-Amz-Expires=${expiresIn}`,
      `X-Amz-SignedHeaders=${signedHeaders}`,
    ]
      .sort()
      .join('&'),
    `host:${host}\n`,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const kDate = hmac('AWS4' + secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');
  const query =
    `X-Amz-Algorithm=AWS4-HMAC-SHA256` +
    `&X-Amz-Credential=${encodeURIComponent(`${accessKeyId}/${credentialScope}`)}` +
    `&X-Amz-Date=${amzDate}` +
    `&X-Amz-Expires=${expiresIn}` +
    `&X-Amz-SignedHeaders=${encodeURIComponent(signedHeaders)}` +
    `&X-Amz-Signature=${signature}`;
  return {
    url: `https://${host}/${bucketName}/${keyPath}?${query}`,
    headers: contentType ? { 'Content-Type': contentType } : {},
  };
}

async function handleStorage(path, req, res) {
  if (!String(path || '').startsWith('storage/')) return null;
  if (path === 'storage/test-connection') return null; // standalone

  if (path === 'storage/config' && req.method === 'GET') {
    const auth = await requireAuth(req);
    if (auth.ok === false) return send(res, auth.status, { success: false, error: auth.error });
    if (!isAdminRole(auth.role, auth.email)) {
      return send(res, 403, { success: false, error: { message: 'Admin role required.' } });
    }
    const r2 = r2Env();
    const configured = Boolean(
      r2.accountId && r2.accessKeyId && r2.secretAccessKey && r2.bucketName
    );
    return send(res, 200, {
      success: true,
      configured,
      source: 'environment',
      config: {
        accountId: r2.accountId ? `${r2.accountId.slice(0, 4)}…` : '',
        accessKeyId: r2.accessKeyId ? `${r2.accessKeyId.slice(0, 4)}…` : '',
        secretAccessKey: r2.secretAccessKey ? '••••••••' : '',
        bucketName: r2.bucketName,
        publicUrl: r2.publicUrl,
      },
      message: configured
        ? 'R2 credentials are loaded from server environment variables.'
        : 'Set R2_* in Vercel Environment Variables.',
    });
  }

  if (path === 'storage/presigned-url' && req.method === 'POST') {
    const auth = await requireAuth(req);
    if (auth.ok === false) {
      return send(res, auth.status, {
        success: false,
        error: (auth.error && auth.error.message) || 'Unauthorized',
      });
    }
    const r2 = r2Env();
    if (!r2.accountId || !r2.accessKeyId || !r2.secretAccessKey) {
      return send(res, 503, {
        success: false,
        configured: false,
        error:
          'R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME in Vercel Environment Variables.',
        code: 'STORAGE_NOT_CONFIGURED',
      });
    }
    const body = await readJsonBody(req);
    const filename = String((body && body.filename) || '').trim();
    if (!filename) return send(res, 400, { success: false, error: 'Filename is required' });
    const contentType = String((body && body.contentType) || 'application/octet-stream');
    const category = (body && body.category) || 'chat_media';
    const storageKey = buildStorageKey(auth.profileId, category, filename);
    const expiresInSeconds = 900;
    const signed = signPutUrl({
      accountId: r2.accountId,
      accessKeyId: r2.accessKeyId,
      secretAccessKey: r2.secretAccessKey,
      bucketName: r2.bucketName,
      key: storageKey,
      contentType,
      expiresIn: expiresInSeconds,
    });
    const publicUrl = r2.publicUrl
      ? `${r2.publicUrl}/${storageKey}`
      : `https://${r2.accountId}.r2.cloudflarestorage.com/${r2.bucketName}/${storageKey}`;
    return send(res, 200, {
      success: true,
      configured: true,
      source: 'environment',
      presignedUrl: signed.url,
      publicUrl,
      storageKey,
      expiresInSeconds,
      bucket: r2.bucketName,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      isMock: false,
    });
  }

  return send(res, 501, {
    success: false,
    error: { message: `Unimplemented storage path: ${path}`, code: 'VERCEL_ROUTE_NOT_IMPLEMENTED' },
  });
}

module.exports = { handleStorage };
