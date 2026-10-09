/**
 * /api/storage/* — R2 config + SigV4 presigned PUT + server-side upload fallback (no AWS SDK).
 */
const { createHash, createHmac, randomUUID } = require('crypto');
const { send, clean, readJsonBody, requireAuth, isAdminRole } = require('./helpers');

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // keep under Vercel Hobby body limits

function hmac(key, data) {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}
function sha256Hex(data) {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}
function sha256HexBuffer(buf) {
  return createHash('sha256').update(buf).digest('hex');
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

function publicObjectUrl(r2, storageKey) {
  if (r2.publicUrl) return `${r2.publicUrl}/${storageKey}`;
  return `https://${r2.accountId}.r2.cloudflarestorage.com/${r2.bucketName}/${storageKey}`;
}

/**
 * Browser-friendly query-string presign.
 * SignedHeaders = host only + UNSIGNED-PAYLOAD so clients can send Content-Type freely.
 */
function signPutUrl({ accountId, accessKeyId, secretAccessKey, bucketName, key, expiresIn }) {
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';
  const method = 'PUT';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const keyPath = key
    .split('/')
    .map((p) => encodeURIComponent(p))
    .join('/');
  const canonicalUri = `/${bucketName}/${keyPath}`;
  const signedHeaders = 'host';
  const credential = `${accessKeyId}/${credentialScope}`;

  const queryParams = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': signedHeaders,
  };
  const canonicalQuerystring = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
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

  const url =
    `https://${host}${canonicalUri}?${canonicalQuerystring}` +
    `&X-Amz-Signature=${signature}`;

  return { url };
}

/** Server-side SigV4 PUT of a Buffer to R2 (Authorization header style). */
async function putObjectToR2({ r2, key, buffer, contentType }) {
  const host = `${r2.accountId}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';
  const method = 'PUT';
  const keyPath = key
    .split('/')
    .map((p) => encodeURIComponent(p))
    .join('/');
  const canonicalUri = `/${r2.bucketName}/${keyPath}`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256HexBuffer(buffer);
  const contentTypeHeader = contentType || 'application/octet-stream';
  const canonicalHeaders =
    `content-type:${contentTypeHeader}\n` +
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    method,
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const kDate = hmac('AWS4' + r2.secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${r2.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `https://${host}${canonicalUri}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentTypeHeader,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorization,
    },
    body: buffer,
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 400);
    const err = new Error(`R2 PUT failed (${response.status}): ${detail || response.statusText}`);
    err.status = response.status;
    throw err;
  }
}

function decodeBase64Payload(base64Data) {
  const raw = String(base64Data || '');
  const matches = raw.match(/^data:([A-Za-z0-9.+\/-]+);base64,(.+)$/);
  if (matches) {
    return {
      mimeFromDataUrl: matches[1],
      buffer: Buffer.from(matches[2], 'base64'),
    };
  }
  return {
    mimeFromDataUrl: '',
    buffer: Buffer.from(raw, 'base64'),
  };
}

const PUBLIC_MEDIA_CATEGORIES = new Set([
  'avatar',
  'gallery',
  'gallery_video',
  'moment',
  'intro_video',
  'chat_media',
  'media',
]);
const PRIVATE_MEDIA_CATEGORIES = new Set(['verification']);
const MEDIA_KEY_RE = /^uploads\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/.+/;

function sanitizeMediaObjectKey(rawKey) {
  const key = String(rawKey || '').trim();
  if (!key) {
    const err = new Error('Missing media key');
    err.status = 400;
    err.code = 'MISSING_KEY';
    throw err;
  }
  if (
    key.includes('..') ||
    key.includes('\\') ||
    key.includes('\0') ||
    key.startsWith('/') ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(key) ||
    key.includes('://')
  ) {
    const err = new Error('Invalid media key');
    err.status = 400;
    err.code = 'INVALID_KEY';
    throw err;
  }
  if (!key.startsWith('uploads/') || !MEDIA_KEY_RE.test(key)) {
    const err = new Error('Media key outside allowlisted uploads prefix');
    err.status = 400;
    err.code = 'KEY_NOT_ALLOWED';
    throw err;
  }
  return key;
}

function parseMediaKeyParts(key) {
  const safe = sanitizeMediaObjectKey(key);
  const parts = safe.split('/');
  return { category: parts[1] || '', ownerUserId: parts[2] || '' };
}

/** SigV4 GetObject — returns Buffer + metadata or null. */
async function getObjectFromR2({ r2, key }) {
  const host = `${r2.accountId}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';
  const method = 'GET';
  const keyPath = key
    .split('/')
    .map((p) => encodeURIComponent(p))
    .join('/');
  const canonicalUri = `/${r2.bucketName}/${keyPath}`;
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    method,
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const kDate = hmac('AWS4' + r2.secretAccessKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${r2.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `https://${host}${canonicalUri}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorization,
    },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 200);
    throw new Error(`R2 GET failed (${response.status}): ${detail || response.statusText}`);
  }
  const ab = await response.arrayBuffer();
  return {
    body: Buffer.from(ab),
    contentType: response.headers.get('content-type') || 'application/octet-stream',
    contentLength: Number(response.headers.get('content-length')) || ab.byteLength,
  };
}

function sendBinary(res, status, buffer, headers) {
  res.statusCode = status;
  for (const [k, v] of Object.entries(headers || {})) {
    if (v != null) res.setHeader(k, String(v));
  }
  res.end(buffer);
}

async function handleStorage(path, req, res) {
  if (!String(path || '').startsWith('storage/')) return null;
  if (path === 'storage/test-connection') return null; // standalone

  if (path === 'storage/media' && req.method === 'GET') {
    try {
      let key;
      try {
        const q = req.query || {};
        key = sanitizeMediaObjectKey(q.key);
      } catch (err) {
        res.statusCode = err.status || 400;
        res.setHeader('Content-Type', 'text/plain');
        res.end(err.message || 'Invalid media key');
        return true;
      }
      const { category, ownerUserId } = parseMediaKeyParts(key);
      if (PRIVATE_MEDIA_CATEGORIES.has(category)) {
        const auth = await requireAuth(req);
        if (auth.ok === false) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Authentication required for private media.');
          return true;
        }
        const admin = isAdminRole(auth.role, auth.email);
        if (!admin && String(auth.profileId) !== String(ownerUserId)) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'text/plain');
          res.end('Not authorized to access this media object.');
          return true;
        }
      } else if (!PUBLIC_MEDIA_CATEGORIES.has(category)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Media category not allowed');
        return true;
      }

      const r2 = r2Env();
      if (!r2.accountId || !r2.accessKeyId || !r2.secretAccessKey) {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'text/plain');
        res.end('R2 storage is not configured');
        return true;
      }
      const streamData = await getObjectFromR2({ r2, key });
      if (!streamData) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Media object not found in storage');
        return true;
      }
      sendBinary(res, 200, streamData.body, {
        'Content-Type': streamData.contentType || 'image/jpeg',
        'Content-Length': String(streamData.contentLength || streamData.body.length),
        'Cache-Control': PRIVATE_MEDIA_CATEGORIES.has(category)
          ? 'private, max-age=3600'
          : 'public, max-age=31536000, immutable',
      });
      return true;
    } catch (err) {
      console.error('[Storage Media Proxy] Error streaming key:', err && err.message);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Internal media streaming error');
      return true;
    }
  }

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
      expiresIn: expiresInSeconds,
    });
    return send(res, 200, {
      success: true,
      configured: true,
      source: 'environment',
      presignedUrl: signed.url,
      publicUrl: publicObjectUrl(r2, storageKey),
      storageKey,
      expiresInSeconds,
      bucket: r2.bucketName,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      isMock: false,
    });
  }

  // Server-side base64 upload fallback (used when browser PUT/CORS fails)
  if (path === 'storage/upload' && req.method === 'POST') {
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
    const base64Data = body && body.base64Data;
    if (!base64Data) {
      return send(res, 400, { success: false, error: 'base64Data is required' });
    }

    // Reject oversized base64 before allocating a large buffer (~4/3 inflation)
    if (String(base64Data).length > MAX_UPLOAD_BYTES * 2 + 512) {
      return send(res, 400, {
        success: false,
        error: `File exceeds max upload size (${MAX_UPLOAD_BYTES} bytes)`,
        code: 'FILE_TOO_LARGE',
      });
    }

    const { mimeFromDataUrl, buffer } = decodeBase64Payload(base64Data);
    if (!buffer.length) {
      return send(res, 400, { success: false, error: 'Uploaded file payload is empty' });
    }
    if (buffer.length > MAX_UPLOAD_BYTES) {
      return send(res, 400, {
        success: false,
        error: `File exceeds max upload size (${MAX_UPLOAD_BYTES} bytes)`,
        code: 'FILE_TOO_LARGE',
      });
    }

    const filename = String((body && body.filename) || 'upload.jpg').trim() || 'upload.jpg';
    const contentType =
      String((body && body.contentType) || mimeFromDataUrl || 'image/jpeg') || 'image/jpeg';
    const category = (body && body.category) || 'chat_media';
    const storageKey = buildStorageKey(auth.profileId, category, filename);

    try {
      await putObjectToR2({
        r2,
        key: storageKey,
        buffer,
        contentType,
      });
    } catch (err) {
      console.error('[api/storage/upload] R2 PUT failed:', err && err.message);
      return send(res, 502, {
        success: false,
        error: (err && err.message) || 'Failed to upload to Cloudflare R2',
      });
    }

    return send(res, 200, {
      success: true,
      publicUrl: publicObjectUrl(r2, storageKey),
      storageKey,
      fileSize: buffer.length,
      contentType,
      isMock: false,
    });
  }

  return send(res, 501, {
    success: false,
    error: { message: `Unimplemented storage path: ${path}`, code: 'VERCEL_ROUTE_NOT_IMPLEMENTED' },
  });
}

module.exports = { handleStorage };
