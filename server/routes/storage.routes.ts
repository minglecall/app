import express, { Router } from 'express';
import type { ServerRuntime } from '../runtimeTypes';
import {
  generateR2PresignedUploadUrl,
  uploadBufferToR2ServerSide,
  getR2ObjectStream,
  testR2Connectivity,
  getR2RuntimeConfig,
  updateR2RuntimeConfig,
  saveLocalMediaBuffer,
  isR2Configured,
} from '../r2Storage';
import { requireAuth, requireAdmin } from '../middleware/auth';

function resolveUploadOwnerUserId(req: express.Request): string | null {
  const profileId = String((req as any).profileId || (req as any).profile?.id || '').trim();
  if (profileId) return profileId;
  const authId = String((req as any).user?.id || '').trim();
  return authId || null;
}

export function createStorageRouter(_ctx: ServerRuntime): Router {
  const router = Router();

  // Generate S3 Presigned PUT URL for direct browser uploads
  router.post('/presigned-url', requireAuth, async (req, res) => {
    try {
      const { filename, contentType, fileSize, category } = req.body || {};
      if (!filename) return res.status(400).json({ error: 'Filename is required' });

      const ownerUserId = resolveUploadOwnerUserId(req);
      if (!ownerUserId) {
        return res.status(400).json({ error: 'A valid userId is required for storage uploads' });
      }

      const data = await generateR2PresignedUploadUrl({
        filename,
        contentType: contentType || 'application/octet-stream',
        fileSize: Number(fileSize) || 0,
        userId: ownerUserId,
        category: category || 'chat_media',
      });
      return res.json(data);
    } catch (err: any) {
      console.error('[Storage API] Presigned URL error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // Fallback Base64 / Binary server upload directly to R2 and memory cache
  router.post('/upload', requireAuth, async (req, res) => {
    try {
      const { filename, contentType, base64Data, category } = req.body || {};
      if (!base64Data) return res.status(400).json({ error: 'base64Data is required' });

      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer: Buffer;
      let mime = contentType || 'image/jpeg';
      if (matches) {
        mime = matches[1];
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(base64Data, 'base64');
      }

      if (!buffer.length) {
        return res.status(400).json({ error: 'Uploaded file payload is empty' });
      }

      const cleanName = (filename || 'upload.jpg').replace(/[^a-zA-Z0-9.-]/g, '_');
      const uniquePrefix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const ownerUserId = resolveUploadOwnerUserId(req);
      if (!ownerUserId) {
        return res.status(401).json({ error: 'Authenticated user is required for storage uploads' });
      }
      const storageKey = `uploads/${category || 'media'}/${ownerUserId}/${uniquePrefix}_${cleanName}`;

      const publicUrl = await uploadBufferToR2ServerSide(storageKey, buffer, mime, {
        'uploader-user-id': ownerUserId,
        'media-category': category || 'media',
      });

      return res.json({
        success: true,
        publicUrl,
        storageKey,
        fileSize: buffer.length,
        contentType: mime,
      });
    } catch (err: any) {
      console.error('[Storage API] Server upload error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // Proxy media streaming route for instant, CORS-free image loading
  router.get('/media', async (req, res) => {
    try {
      const key = req.query.key as string;
      if (!key) return res.status(400).send('Missing media key');

      const streamData = await getR2ObjectStream(key);
      if (!streamData) {
        return res.status(404).send('Media object not found in storage');
      }

      res.setHeader('Content-Type', streamData.contentType || 'image/jpeg');
      if (streamData.contentLength) {
        res.setHeader('Content-Length', streamData.contentLength.toString());
      }
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      if (Buffer.isBuffer(streamData.body)) {
        return res.send(streamData.body);
      } else if (streamData.body && typeof (streamData.body as any).pipe === 'function') {
        return (streamData.body as any).pipe(res);
      } else {
        return res.send(streamData.body);
      }
    } catch (err: any) {
      console.error('[Storage Media Proxy] Error streaming key:', err);
      return res.status(500).send('Internal media streaming error');
    }
  });

  // Mock / Simulated binary PUT handler for dev mode
  router.put('/mock-upload', express.raw({ type: '*/*', limit: '50mb' }), (req, res) => {
    try {
      const key = req.query.key as string;
      if (!key) return res.status(400).json({ error: 'Missing key parameter' });
      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
      const contentType = (req.headers['content-type'] as string) || 'image/jpeg';
      saveLocalMediaBuffer(key, buffer, contentType);
      return res.status(200).json({ success: true, key });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Fetch R2 credentials & status (masked for security)
  router.get('/config', requireAdmin, (req, res) => {
    const cfg = getR2RuntimeConfig();
    return res.json({
      configured: isR2Configured(),
      accountId: cfg.accountId ? `${cfg.accountId.slice(0, 4)}...${cfg.accountId.slice(-4)}` : '',
      accessKeyId: cfg.accessKeyId ? `${cfg.accessKeyId.slice(0, 4)}...${cfg.accessKeyId.slice(-4)}` : '',
      bucketName: cfg.bucketName,
      publicUrl: cfg.publicUrl,
    });
  });

  // Update R2 credentials at runtime
  router.post('/config', requireAdmin, (req, res) => {
    try {
      const { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl } = req.body || {};
      updateR2RuntimeConfig({
        accountId,
        accessKeyId,
        secretAccessKey,
        bucketName,
        publicUrl,
      });
      return res.json({ success: true, message: 'Cloudflare R2 runtime credentials updated.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Test Cloudflare R2 live connectivity
  router.post('/test', requireAdmin, async (req, res) => {
    try {
      const result = await testR2Connectivity(req.body);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST Test Cloudflare R2 Bucket Connection
  router.post('/test-connection', requireAdmin, async (req, res) => {
    try {
      const { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl } = req.body || {};
      const overrideConfig = (accountId || accessKeyId || secretAccessKey || bucketName)
        ? { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl }
        : undefined;

      const result = await testR2Connectivity(overrideConfig);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err.message || 'Error testing Cloudflare R2 connectivity',
      });
    }
  });

  return router;
}
