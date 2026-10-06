import { getAccessToken } from './apiClient';
import { apiUrl } from './apiBase';

export interface DirectUploadOptions {
  file: File;
  userId?: string;
  category?: 'avatar' | 'gallery' | 'chat_media' | 'moment' | 'verification' | 'intro_video';
  onProgress?: (percent: number) => void;
}

export interface DirectUploadResult {
  publicUrl: string;
  storageKey: string;
  fileSize: number;
  contentType: string;
  durationMs: number;
}

/** Local-only preview URLs must never be persisted as the authoritative avatar/media URL. */
export function isEphemeralMediaUrl(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return trimmed.startsWith('blob:') || trimmed.startsWith('data:');
}

export function isPersistableMediaUrl(url?: string | null): boolean {
  return Boolean(url && !isEphemeralMediaUrl(url));
}

/** Build JSON request headers with the current Supabase access token when available. */
async function getAuthJsonHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = await getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    console.warn('[R2 Storage] Unable to read Supabase session for Authorization header:', err);
  }
  return headers;
}

function extractStorageErrorMessage(payload: any, fallback: string): string {
  if (!payload) return fallback;
  if (typeof payload.error === 'string') return payload.error;
  if (payload.error?.message) return String(payload.error.message);
  if (payload.message) return String(payload.message);
  return fallback;
}

function isStorageNotConfiguredResponse(status: number, payload: any): boolean {
  return (
    status === 503 ||
    payload?.configured === false ||
    payload?.code === 'STORAGE_NOT_CONFIGURED'
  );
}

// Normalize any media URL to ensure raw authenticated S3 endpoints are routed via proxy
export function normalizeMediaUrl(url: string | undefined | null, storageKey?: string): string {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  if (url.includes('.r2.cloudflarestorage.com')) {
    const parts = url.split('.r2.cloudflarestorage.com/');
    if (parts[1]) {
      const rawPath = parts[1];
      const match = rawPath.match(/uploads\/.+$/);
      const key = storageKey || (match ? match[0] : rawPath);
      return `/api/storage/media?key=${encodeURIComponent(key)}`;
    }
  }
  return url;
}

// Fallback helper to upload via server API if direct PUT has CORS or signature issues
async function uploadMediaViaServerFallback(
  file: File,
  userId?: string,
  category: string = 'avatar',
  onProgress?: (p: number) => void
): Promise<DirectUploadResult> {
  const startTime = performance.now();
  if (onProgress) onProgress(30);

  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file from device'));
    reader.readAsDataURL(file);
  });

  if (onProgress) onProgress(70);

  const res = await fetch(apiUrl('/api/storage/upload'), {
    method: 'POST',
    headers: await getAuthJsonHeaders(),
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || 'image/jpeg',
      base64Data,
      // Informational only — server derives owner from the auth session
      userId: userId || undefined,
      category,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (isStorageNotConfiguredResponse(res.status, data)) {
      throw new Error('Storage not configured');
    }
    throw new Error(extractStorageErrorMessage(data, 'Server storage upload failed'));
  }

  if (onProgress) onProgress(100);

  const safePublicUrl = normalizeMediaUrl(data.publicUrl, data.storageKey);

  return {
    publicUrl: safePublicUrl,
    storageKey: data.storageKey,
    fileSize: data.fileSize || file.size,
    contentType: data.contentType || file.type,
    durationMs: Math.round(performance.now() - startTime),
  };
}

async function putFileWithProgress(
  url: string,
  file: File,
  headers: Record<string, string> | undefined,
  onProgress?: (percent: number) => void,
  extraHeaders?: Record<string, string>
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);

    if (headers) {
      Object.entries(headers).forEach(([key, val]) => {
        xhr.setRequestHeader(key, val as string);
      });
    }
    if (extraHeaders) {
      Object.entries(extraHeaders).forEach(([key, val]) => {
        xhr.setRequestHeader(key, val);
      });
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(100);
        resolve();
      } else {
        reject(new Error(`Storage PUT status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Direct upload network/CORS error'));
    };

    xhr.send(file);
  });
}

export async function uploadMediaDirectlyToR2(
  options: DirectUploadOptions
): Promise<DirectUploadResult> {
  const { file, userId, category = 'chat_media', onProgress } = options;
  const startTime = performance.now();

  try {
    // 1. Request presigned URL from server API (authenticated)
    const presignRes = await fetch(apiUrl('/api/storage/presigned-url'), {
      method: 'POST',
      headers: await getAuthJsonHeaders(),
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || 'image/jpeg',
        fileSize: file.size,
        // Informational only — server always overrides with auth profile id
        userId,
        category,
      }),
    });

    const signData = await presignRes.json().catch(() => ({}));

    if (!presignRes.ok) {
      if (isStorageNotConfiguredResponse(presignRes.status, signData)) {
        throw new Error('Storage not configured');
      }
      const authMessage = extractStorageErrorMessage(
        signData,
        `Presigned URL request failed (${presignRes.status})`
      );
      // Auth / validation failures: do not silently fall through to mock
      if (presignRes.status === 401 || presignRes.status === 403 || presignRes.status === 400) {
        throw new Error(authMessage);
      }
      console.warn('[R2 Storage] Presigned URL request failed, using server upload fallback:', authMessage);
      return await uploadMediaViaServerFallback(file, userId, category, onProgress);
    }

    if (isStorageNotConfiguredResponse(presignRes.status, signData) && !signData?.presignedUrl) {
      throw new Error('Storage not configured');
    }

    const { presignedUrl, publicUrl, storageKey, headers, isMock } = signData;
    if (!presignedUrl) {
      throw new Error('Storage not configured');
    }

    // Mock uploads require Bearer auth on PUT /mock-upload
    const extraHeaders: Record<string, string> = {};
    const needsAuthOnPut =
      Boolean(isMock) ||
      (typeof presignedUrl === 'string' &&
        (presignedUrl.startsWith('/') || presignedUrl.includes('/api/storage/mock-upload')));
    if (needsAuthOnPut) {
      const token = await getAccessToken();
      if (token) {
        extraHeaders.Authorization = `Bearer ${token}`;
      }
    }

    // 2. Direct PUT upload to Cloudflare R2 (or auth-gated local mock) with progress tracking
    try {
      await putFileWithProgress(presignedUrl, file, headers, onProgress, extraHeaders);

      const durationMs = Math.round(performance.now() - startTime);

      return {
        publicUrl: normalizeMediaUrl(publicUrl, storageKey),
        storageKey,
        fileSize: file.size,
        contentType: file.type,
        durationMs,
      };
    } catch (putErr) {
      console.warn('Direct PUT failed, seamlessly using server upload fallback:', putErr);
      return await uploadMediaViaServerFallback(file, userId, category, onProgress);
    }
  } catch (err: any) {
    if (String(err?.message || '').includes('Storage not configured')) {
      throw err;
    }
    console.warn('Direct presign flow failed, fallback to server upload:', err.message);
    return await uploadMediaViaServerFallback(file, userId, category, onProgress);
  }
}
