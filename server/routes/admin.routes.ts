import { Router } from 'express';
import type { ServerRuntime } from '../runtimeTypes';
import type { UserProfile } from '../../src/types';
import { loadAdminSchemaPayload } from '../schemaLoader';
import {
  getRawSmtpConfigForAdmin,
  updateSmtpRuntimeConfig,
} from '../emailService';
import {
  deleteProfileAdmin,
  isSupabaseAdminConfigured,
  granularResetSupabaseAdmin,
  isSupabaseServiceRoleConfigured,
} from '../supabaseAdmin';
import { isR2Configured, updateR2RuntimeConfig } from '../r2Storage';
import { requireAdmin } from '../middleware/auth';

export function createAdminRouter(ctx: ServerRuntime): Router {
  const router = Router();
  const {
    serverUsers,
    presenceMap,
    userLastSeen,
    activeCalls,
    infraConfig,
    getFormattedUsers,
    getFormattedActiveCalls,
    broadcastAll,
    broadcastPresence,
    broadcastUsers,
    broadcastActiveCalls,
  } = ctx;

  // Master PostgreSQL / Supabase Schema Fetch Endpoint
  // Single source of truth: /supabase_schema.sql (loaded from disk — no embedded SQL)
  router.get('/schema', requireAdmin, (req, res) => {
    try {
      const payload = loadAdminSchemaPayload();
      return res.json(payload);
    } catch (err: any) {
      console.error('Error reading canonical schema file:', err);
      return res.status(404).json({
        success: false,
        error: err.message || 'Canonical schema file not found on server',
      });
    }
  });

  // POST Admin Reset Data
  router.post('/reset-mock-data', requireAdmin, (req, res) => {
    try {
      const { mockIds } = req.body;
      const idsToRemove: string[] = Array.isArray(mockIds) ? mockIds : [];

      let count = 0;
      for (const id of idsToRemove) {
        if (serverUsers.has(id)) {
          serverUsers.delete(id);
          presenceMap.delete(id);
          userLastSeen.delete(id);
          count++;
        }
      }

      broadcastAll({
        type: 'users:all',
        users: getFormattedUsers(),
      });
      broadcastPresence();

      return res.json({
        success: true,
        removedCount: count,
        remainingCount: serverUsers.size,
        message: `Purged ${count} accounts. Server now holds ${serverUsers.size} live users.`,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Master Granular / Full Reset Endpoint (bypasses RLS via Supabase Admin service-role)
  router.post('/granular-reset', requireAdmin, async (req, res) => {
    try {
      const options = req.body || {};

      // 1. Reset in-memory presence and active calls if requested
      if (options.clearActiveCalls) {
        activeCalls.clear();
        broadcastActiveCalls();
      }
      if (options.clearPresence) {
        presenceMap.clear();
        userLastSeen.clear();
        broadcastPresence();
      }

      // 2. Reset in-memory users
      if (options.clearAllUsers) {
        const adminUser = Array.from(serverUsers.values()).find((u) => u.role === 'admin') || {
          id: 'admin_user',
          name: 'Super Admin',
          email: 'admin@livecall.app',
          gender: 'male',
          role: 'admin',
          coinBalance: 999999,
          isVerified: true,
          onlineStatus: 'online',
        } as UserProfile;
        serverUsers.clear();
        serverUsers.set(adminUser.id, adminUser);
        broadcastUsers();
      } else if (options.mockIds && Array.isArray(options.mockIds)) {
        for (const id of options.mockIds) {
          serverUsers.delete(id);
          presenceMap.delete(id);
          userLastSeen.delete(id);
        }
        broadcastUsers();
        broadcastPresence();
      }

      // 3. If Supabase Admin is configured, perform complete cascading database purge
      let supabaseResult: any = { success: true, clearedTables: [] };
      if (isSupabaseAdminConfigured()) {
        if (!isSupabaseServiceRoleConfigured()) {
          return res.status(503).json({
            success: false,
            error:
              'Database reset requires SUPABASE_SERVICE_ROLE_KEY. The anon key cannot bypass RLS, so tables would not actually be purged.',
          });
        }
        supabaseResult = await granularResetSupabaseAdmin({
          mockIds: options.mockIds,
          clearAllUsers: Boolean(options.clearAllUsers),
          clearMockUsers: Boolean(options.clearMockUsers),
          clearAdmin: Boolean(options.clearAdmin),
          chatMessages: Boolean(options.chatMessages),
          callLogs: Boolean(options.callLogs),
          friendRequests: Boolean(options.friendRequests),
          payoutRequests: Boolean(options.payoutRequests),
          moderationReports: Boolean(options.moderationReports),
          creatorAnalytics: Boolean(options.creatorAnalytics),
          dailyRewardsAndQuests: Boolean(options.dailyRewardsAndQuests),
          taxonomiesAndFlags: Boolean(options.taxonomiesAndFlags),
          purgeR2MediaStorage: Boolean(options.purgeR2MediaStorage),
          purgeAllR2Uploads: Boolean(options.purgeAllR2Uploads),
          homeBanners: Boolean(options.homeBanners),
          homeQuickLinks: Boolean(options.homeQuickLinks),
          cmsPolicies: Boolean(options.cmsPolicies),
          systemSettings: Boolean(options.systemSettings),
          coinPackages: Boolean(options.coinPackages),
          virtualGiftsCatalog: Boolean(options.virtualGiftsCatalog),
          feedPosts: Boolean(options.feedPosts),
          favorites: Boolean(options.favorites),
          blockedUsers: Boolean(options.blockedUsers),
          creatorGoals: Boolean(options.creatorGoals),
          resetBalances: options.resetBalances,
        });
        if (!supabaseResult?.success) {
          return res.status(500).json({
            success: false,
            error: supabaseResult?.error || 'Database reset failed.',
            clearedTables: supabaseResult?.clearedTables || [],
          });
        }
      }

      return res.json({
        success: true,
        message: 'Server and database state reset successfully.',
        clearedTables: supabaseResult.clearedTables || [],
      });
    } catch (err: any) {
      console.error('[API Reset] Error during granular reset:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/delete-user', requireAdmin, async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, error: 'User ID is required' });
      }

      const existing = serverUsers.get(userId);
      const userName = existing?.name || userId;

      serverUsers.delete(userId);
      presenceMap.delete(userId);

      if (isSupabaseAdminConfigured()) {
        await deleteProfileAdmin(userId);
      }

      broadcastAll({
        type: 'users:deleted',
        userId,
        users: getFormattedUsers(),
      });
      broadcastPresence();

      return res.json({
        success: true,
        message: `User ${userName} was permanently deleted from database and system.`,
      });
    } catch (err: any) {
      console.error('Error in POST /api/admin/delete-user:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET Full Unmasked SMTP Configuration for Admin Dashboard
  router.get('/email-config', requireAdmin, (req, res) => {
    const rawConfig = getRawSmtpConfigForAdmin();
    res.json({
      success: true,
      config: rawConfig,
    });
  });

  // POST Save SMTP Configuration dynamically
  router.post('/email-config', requireAdmin, (req, res) => {
    try {
      const { host, port, user, pass, from, secure, resendApiKey, showOtpInForm } = req.body;
      updateSmtpRuntimeConfig({
        host: host !== undefined ? String(host).trim() : undefined,
        port: port ? parseInt(String(port), 10) : undefined,
        user: user !== undefined ? String(user).trim() : undefined,
        pass: pass !== undefined ? String(pass).trim() : undefined,
        from: from !== undefined ? String(from).trim() : undefined,
        secure: typeof secure === 'boolean' ? secure : undefined,
        resendApiKey: resendApiKey !== undefined ? String(resendApiKey).trim() : undefined,
        showOtpInForm: typeof showOtpInForm === 'boolean' ? showOtpInForm : undefined,
      });

      const updatedRaw = getRawSmtpConfigForAdmin();
      return res.json({
        success: true,
        message: 'SMTP Email configuration saved and persisted successfully!',
        config: updatedRaw,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to update SMTP config' });
    }
  });

  // Real-time Active Calls for Admin Surveillance
  router.get('/active-calls', requireAdmin, (req, res) => {
    res.json({
      success: true,
      activeCalls: getFormattedActiveCalls(),
      timestamp: Date.now(),
    });
  });

  // GET Infrastructure & Storage Parameters
  router.get('/infra-config', requireAdmin, (req, res) => {
    const mask = (v?: string) => (v ? '••••••••' : '');
    res.json({
      success: true,
      config: {
        supabaseUrl: infraConfig.supabaseUrl,
        supabaseAnonKey: mask(infraConfig.supabaseAnonKey),
        r2AccountId: infraConfig.r2AccountId,
        r2AccessKeyId: infraConfig.r2AccessKeyId ? `${String(infraConfig.r2AccessKeyId).slice(0, 4)}…` : '',
        r2SecretAccessKey: mask(infraConfig.r2SecretAccessKey),
        r2BucketName: infraConfig.r2BucketName,
        r2PublicUrl: infraConfig.r2PublicUrl,
        supabaseConfigured: Boolean(
          infraConfig.supabaseUrl &&
          !infraConfig.supabaseUrl.includes('placeholder') &&
          !infraConfig.supabaseUrl.includes('your-project-ref')
        ),
        r2Configured: isR2Configured(),
      },
    });
  });

  // POST Update Infrastructure & Performance Parameters
  router.post('/infra-config', requireAdmin, (req, res) => {
    try {
      const updates = req.body;
      Object.assign(infraConfig, updates);

      if (updates.supabaseUrl !== undefined) process.env.VITE_SUPABASE_URL = updates.supabaseUrl;
      if (updates.supabaseAnonKey !== undefined) process.env.VITE_SUPABASE_ANON_KEY = updates.supabaseAnonKey;
      if (updates.r2AccountId !== undefined) process.env.R2_ACCOUNT_ID = updates.r2AccountId;
      if (updates.r2AccessKeyId !== undefined) process.env.R2_ACCESS_KEY_ID = updates.r2AccessKeyId;
      if (updates.r2SecretAccessKey !== undefined) process.env.R2_SECRET_ACCESS_KEY = updates.r2SecretAccessKey;
      if (updates.r2BucketName !== undefined) process.env.R2_BUCKET_NAME = updates.r2BucketName;
      if (updates.r2PublicUrl !== undefined) process.env.R2_PUBLIC_URL = updates.r2PublicUrl;

      // Dynamically update R2 active runtime config
      updateR2RuntimeConfig({
        accountId: infraConfig.r2AccountId,
        accessKeyId: infraConfig.r2AccessKeyId,
        secretAccessKey: infraConfig.r2SecretAccessKey,
        bucketName: infraConfig.r2BucketName,
        publicUrl: infraConfig.r2PublicUrl,
      });

      return res.json({
        success: true,
        message: 'Infrastructure parameters updated successfully.',
        config: {
          r2Configured: isR2Configured(),
          supabaseConfigured: Boolean(infraConfig.supabaseUrl),
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to update infrastructure parameters' });
    }
  });

  return router;
}

export function createUsersAdminRouter(ctx: ServerRuntime): Router {
  const router = Router();
  const {
    serverUsers,
    presenceMap,
    normalizeUserProfile,
    getFormattedUsers,
    broadcastAll,
    broadcastPresence,
    broadcastUsers,
  } = ctx;

  // Server-side Bulk Users Sync Endpoint
  router.post('/sync-all', requireAdmin, async (req, res) => {
    try {
      const { users: incomingUsers, overwrite } = req.body || {};
      if (Array.isArray(incomingUsers)) {
        if (overwrite) {
          serverUsers.clear();
        }
        for (const u of incomingUsers) {
          if (u && u.id) {
            serverUsers.set(u.id, normalizeUserProfile(u));
          }
        }
        broadcastUsers();
        return res.json({ success: true, count: serverUsers.size });
      }
      return res.status(400).json({ success: false, error: 'Invalid users array' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  router.delete('/:id', requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      if (!userId) {
        return res.status(400).json({ success: false, error: 'User ID is required' });
      }

      const existing = serverUsers.get(userId);
      const userName = existing?.name || userId;

      serverUsers.delete(userId);
      presenceMap.delete(userId);

      if (isSupabaseAdminConfigured()) {
        await deleteProfileAdmin(userId);
      }

      broadcastAll({
        type: 'users:deleted',
        userId,
        users: getFormattedUsers(),
      });
      broadcastPresence();

      return res.json({
        success: true,
        message: `User ${userName} (${userId}) was permanently deleted from database and system.`,
      });
    } catch (err: any) {
      console.error('Error in DELETE /api/users/:id:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
