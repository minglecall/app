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

  const res = await fetch('/api/storage/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || 'image/jpeg',
      base64Data,
      userId: userId || 'user_client',
      category,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Server upload failed' }));
    throw new Error(err.error || 'Server storage upload failed');
  }

  const data = await res.json();
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

export async function uploadMediaDirectlyToR2(
  options: DirectUploadOptions
): Promise<DirectUploadResult> {
  const { file, userId, category = 'chat_media', onProgress } = options;
  const startTime = performance.now();

  try {
    // 1. Request presigned URL from server API
    const presignRes = await fetch('/api/storage/presigned-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        fileSize: file.size,
        userId,
        category,
      }),
    });

    if (!presignRes.ok) {
      // Fallback to direct server upload endpoint
      return await uploadMediaViaServerFallback(file, userId, category, onProgress);
    }

    const signData = await presignRes.json();
    const { presignedUrl, publicUrl, storageKey, headers } = signData;

    // 2. Direct PUT upload to Cloudflare R2 (or local mock upload) with progress tracking
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', presignedUrl, true);

        if (headers) {
          Object.entries(headers).forEach(([key, val]) => {
            xhr.setRequestHeader(key, val as string);
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
    console.warn('Direct presign flow failed, fallback to server upload:', err.message);
    return await uploadMediaViaServerFallback(file, userId, category, onProgress);
  }
}
