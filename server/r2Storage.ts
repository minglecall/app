import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import dotenv from 'dotenv';
dotenv.config();

export interface R2CredentialsConfig {
  accountId?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucketName?: string;
  publicUrl?: string;
}

// Global active credentials cache
let activeConfig: R2CredentialsConfig = {};

// In-memory media cache for instant, persistent uploads and fallback serving
const localMediaCache = new Map<string, { buffer: Buffer; contentType: string; lastModified: Date }>();

export function saveLocalMediaBuffer(key: string, buffer: Buffer, contentType: string) {
  localMediaCache.set(key, {
    buffer,
    contentType: contentType || 'image/jpeg',
    lastModified: new Date(),
  });
}

export function getLocalMediaBuffer(key: string): { buffer: Buffer; contentType: string; lastModified: Date } | null {
  return localMediaCache.get(key) || null;
}

// Helper to resolve public CDN URL or fallback to backend proxy streaming
export function resolvePublicMediaUrl(publicUrlConfig: string | undefined, key: string): string {
  const clean = (publicUrlConfig || '').trim().replace(/\/$/, '');
  // .r2.cloudflarestorage.com is the S3 API endpoint requiring authentication, NOT a public CDN domain.
  const isRawS3Endpoint = clean.includes('.r2.cloudflarestorage.com');
  const isPublicDomain = Boolean(clean && (clean.startsWith('http://') || clean.startsWith('https://')) && !isRawS3Endpoint);

  if (isPublicDomain) {
    return `${clean}/${key}`;
  }
  return `/api/storage/media?key=${encodeURIComponent(key)}`;
}

// Upload buffer directly to Cloudflare R2 from backend server
export async function uploadBufferToR2ServerSide(
  key: string,
  buffer: Buffer,
  contentType: string,
  metadata?: Record<string, string>,
  customConfig?: R2CredentialsConfig
): Promise<string> {
  const cfg = customConfig || getR2RuntimeConfig();
  const bucketName = cfg.bucketName || 'livecall-media-storage';

  // Always cache locally so it can be served instantly
  saveLocalMediaBuffer(key, buffer, contentType);

  if (isR2Configured(cfg)) {
    const client = getR2Client(cfg);
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: metadata,
    });
    await client.send(command);
  }

  return resolvePublicMediaUrl(cfg.publicUrl, key);
}

export function updateR2RuntimeConfig(newConfig: Partial<R2CredentialsConfig>) {
  activeConfig = {
    ...activeConfig,
    ...newConfig,
  };
  s3Client = null; // Invalidate cached S3 client instance
}

export function getR2RuntimeConfig(): R2CredentialsConfig {
  return {
    accountId: activeConfig.accountId || process.env.R2_ACCOUNT_ID || '',
    accessKeyId: activeConfig.accessKeyId || process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: activeConfig.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY || '',
    bucketName: activeConfig.bucketName || process.env.R2_BUCKET_NAME || 'livecall-media-storage',
    publicUrl: (activeConfig.publicUrl || process.env.R2_PUBLIC_URL || '').replace(/\/$/, ''),
  };
}

let s3Client: S3Client | null = null;

export function isR2Configured(configOverride?: R2CredentialsConfig): boolean {
  const cfg = { ...getR2RuntimeConfig(), ...(configOverride || {}) };
  const acc = (cfg.accountId || '').trim();
  const key = (cfg.accessKeyId || '').trim();
  const sec = (cfg.secretAccessKey || '').trim();
  return Boolean(
    acc &&
    key &&
    sec &&
    !acc.includes('your-') &&
    !key.includes('your-')
  );
}

export function getR2Client(configOverride?: R2CredentialsConfig): S3Client {
  const cfg = { ...getR2RuntimeConfig(), ...(configOverride || {}) };
  const acc = (cfg.accountId || '').trim();
  const key = (cfg.accessKeyId || '').trim();
  const sec = (cfg.secretAccessKey || '').trim();

  if (!acc || !key || !sec) {
    throw new Error('Cloudflare R2 credentials (Account ID, Access Key ID, and Secret Access Key) are not fully configured.');
  }

  // If using overrides or no cached client, instantiate
  return new S3Client({
    region: 'auto',
    endpoint: `https://${acc}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: key,
      secretAccessKey: sec,
    },
  });
}

// Test live R2 connectivity by pinging the bucket
export async function testR2Connectivity(customConfig?: R2CredentialsConfig): Promise<{
  success: boolean;
  message: string;
  bucket: string;
  endpoint: string;
  latencyMs: number;
  corsHelp?: string;
}> {
  const startTime = performance.now();
  const cfg = { ...getR2RuntimeConfig(), ...(customConfig || {}) };
  const bucket = cfg.bucketName || 'livecall-media-storage';
  const accountId = cfg.accountId || '';

  if (!isR2Configured(cfg)) {
    return {
      success: false,
      message: 'Cloudflare R2 credentials are incomplete. Please provide Account ID, Access Key ID, and Secret Access Key.',
      bucket,
      endpoint: `https://${accountId || 'unknown'}.r2.cloudflarestorage.com`,
      latencyMs: 0,
    };
  }

  try {
    const client = getR2Client(cfg);
    // Ping bucket using ListObjectsV2Command with MaxKeys=1 to check bucket access & auth
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      MaxKeys: 1,
    });
    await client.send(command);

    const latencyMs = Math.round(performance.now() - startTime);
    return {
      success: true,
      message: `Cloudflare R2 Bucket "${bucket}" is connected and fully reachable via S3 API.`,
      bucket,
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    let errMsg = err.message || 'Unknown R2 connection error';
    
    if (err.name === 'NoSuchBucket' || errMsg.includes('NoSuchBucket') || err.$metadata?.httpStatusCode === 404) {
      errMsg = `Bucket "${bucket}" was not found in Cloudflare R2 account "${accountId}". Please ensure you have created this bucket in Cloudflare Dashboard.`;
    } else if (err.name === 'InvalidAccessKeyId' || err.$metadata?.httpStatusCode === 403) {
      errMsg = `Authentication failed (403 Forbidden). Please check that your R2 Access Key ID and Secret Access Key have Admin/Read/Write permissions on bucket "${bucket}".`;
    }

    return {
      success: false,
      message: errMsg,
      bucket,
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      latencyMs,
      corsHelp: 'Make sure CORS is enabled on your R2 bucket for direct browser uploads (AllowedOrigins: ["*"], AllowedMethods: ["GET", "PUT", "HEAD"], AllowedHeaders: ["*"]).',
    };
  }
}

export interface PresignedUrlRequest {
  filename: string;
  contentType: string;
  fileSize: number;
  userId?: string;
  category?: 'avatar' | 'gallery' | 'chat_media' | 'moment' | 'verification';
  credentialsOverride?: R2CredentialsConfig;
}

export interface PresignedUrlResponse {
  presignedUrl: string;
  publicUrl: string;
  storageKey: string;
  expiresInSeconds: number;
  bucket: string;
  method: 'PUT';
  headers: Record<string, string>;
  isMock?: boolean;
}

// Generate secure pre-signed PUT URL for client-direct media uploads
export async function generateR2PresignedUploadUrl(
  params: PresignedUrlRequest
): Promise<PresignedUrlResponse> {
  const { filename, contentType, fileSize, userId = 'anonymous', category = 'chat_media', credentialsOverride } = params;
  const cfg = credentialsOverride || getR2RuntimeConfig();
  const bucketName = cfg.bucketName || 'livecall-media-storage';
  const accountId = cfg.accountId || '';
  const publicUrl = cfg.publicUrl || '';

  // Sanitized key path: uploads/{category}/{userId}/{timestamp}_{random}_{filename}
  const cleanName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const uniquePrefix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const storageKey = `uploads/${category}/${userId}/${uniquePrefix}_${cleanName}`;

  const expiresInSeconds = 900; // 15 minutes upload window

  // If R2 is not fully configured, return mock/simulated direct presigned structure for local preview
  if (!isR2Configured(cfg)) {
    const localMediaUrl = `/api/storage/media?key=${encodeURIComponent(storageKey)}`;
    return {
      presignedUrl: `/api/storage/mock-upload?key=${encodeURIComponent(storageKey)}`,
      publicUrl: localMediaUrl,
      storageKey,
      expiresInSeconds,
      bucket: bucketName,
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      isMock: true,
    };
  }

  const client = getR2Client(cfg);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: storageKey,
    ContentType: contentType,
    ContentLength: fileSize,
    CacheControl: 'public, max-age=31536000, immutable',
    Metadata: {
      'uploader-user-id': userId,
      'media-category': category,
      'original-filename': encodeURIComponent(filename),
    },
  });

  const presignedUrl = await getSignedUrl(client, command, {
    expiresIn: expiresInSeconds,
  });

  const finalPublicUrl = resolvePublicMediaUrl(cfg.publicUrl, storageKey);

  return {
    presignedUrl,
    publicUrl: finalPublicUrl,
    storageKey,
    expiresInSeconds,
    bucket: bucketName,
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    isMock: false,
  };
}

// Stream media object directly from Cloudflare R2 or local cache
export async function getR2ObjectStream(key: string, credentialsOverride?: R2CredentialsConfig) {
  // 1. Check local media buffer first (for local uploads, mock mode, or immediate preview)
  const local = getLocalMediaBuffer(key);
  if (local) {
    return {
      body: local.buffer,
      contentType: local.contentType || 'image/jpeg',
      contentLength: local.buffer.length,
      etag: `"${Date.now()}"`,
      lastModified: local.lastModified,
    };
  }

  const cfg = credentialsOverride || getR2RuntimeConfig();
  const bucketName = cfg.bucketName || 'livecall-media-storage';

  if (!isR2Configured(cfg)) {
    return null;
  }

  try {
    const client = getR2Client(cfg);
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await client.send(command);
    return {
      body: response.Body,
      contentType: response.ContentType || 'image/jpeg',
      contentLength: response.ContentLength,
      etag: response.ETag,
      lastModified: response.LastModified,
    };
  } catch (err: any) {
    console.warn(`[R2 Storage] getObject error for key ${key}:`, err.message);
    return null;
  }
}
