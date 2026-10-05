import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import type { ServerRuntime } from '../runtimeTypes';
import type { UserProfile } from '../../src/types';
import { loadAdminSchemaPayload } from '../schemaLoader';
import {
  getRawSmtpConfigForAdmin,
  updateSmtpRuntimeConfig,
} from '../emailService';
import {
  isSupabaseAdminConfigured,
  granularResetSupabaseAdmin,
  isSupabaseServiceRoleConfigured,
  backfillMissingAuthIdsAdmin,
  authenticateUserWithPasswordAdmin,
} from '../supabaseAdmin';
import { hardDeleteUserCompletely, cleanupOrphanAuthUsersAdmin } from '../userHardDelete';
import { isR2Configured, updateR2RuntimeConfig } from '../r2Storage';
import { requireAdmin, requireAuth } from '../middleware/auth';

/** Read ALLOW_FACTORY_RESET from live .env (so edits apply without full restart) + process.env. */
function getAllowFactoryResetRaw(): string {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const parsed = dotenv.parse(fs.readFileSync(envPath));
      if (Object.prototype.hasOwnProperty.call(parsed, 'ALLOW_FACTORY_RESET')) {
        const fromFile = String(parsed.ALLOW_FACTORY_RESET ?? '').trim();
        process.env.ALLOW_FACTORY_RESET = fromFile;
        return fromFile;
      }
    }
  } catch {
    // fall through to process.env
  }
  return String(process.env.ALLOW_FACTORY_RESET ?? '').trim();
}

/** Destructive factory/mock reset is refused unless explicitly allowlisted. */
function isFactoryResetAllowed(): boolean {
  const raw = getAllowFactoryResetRaw().replace(/^['"]|['"]$/g, '').trim();
  return /^(1|true|yes|on)$/i.test(raw);
}

function refuseFactoryReset(res: import('express').Response) {
  return res.status(403).json({
    success: false,
    error: {
      message:
        'Factory / destructive data reset is disabled. Set ALLOW_FACTORY_RESET=true in the server .env (then retry — no full restart required for this flag), run the wipe, and set it back to false.',
      code: 'FACTORY_RESET_DISABLED',
    },
  });
}

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
    purgeUserRuntimeState,
    resetVolatileRuntimeState,
    broadcastCreatorMetrics,
  } = ctx;

  // Status probe so admin UI can disable Factory Wipe before submit
  router.get('/factory-reset-status', requireAdmin, (_req, res) => {
    const raw = getAllowFactoryResetRaw();
    const allowed = isFactoryResetAllowed();
    return res.json({
      success: true,
      data: {
        allowed,
        envValue: raw,
        hint: allowed
          ? 'Factory reset is enabled. Type DELETE below to unlock Factory Wipe, then set ALLOW_FACTORY_RESET=false after the wipe.'
          : 'Set ALLOW_FACTORY_RESET=true in the server .env file (not .env.example), reopen this modal, run the wipe, then set it back to false.',
      },
    });
  });

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

  // POST Admin Reset Data (destructive — require allowlist)
  router.post('/reset-mock-data', requireAdmin, (req, res) => {
    try {
      if (!isFactoryResetAllowed()) {
        return refuseFactoryReset(res);
      }

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
      if (!isFactoryResetAllowed()) {
        return refuseFactoryReset(res);
      }

      const options = req.body || {};

      // 1. Reset volatile in-memory state (calls, presence, metrics, quick-match, users)
      const shouldClearUsers = Boolean(options.clearAllUsers);
      const adminUser =
        Array.from(serverUsers.values()).find((u) => u.role === 'admin') ||
        ({
          id: 'admin_user',
          name: 'Super Admin',
          email: 'admin@livecall.app',
          gender: 'male',
          role: 'admin',
          coinBalance: 0,
          isVerified: true,
          onlineStatus: 'online',
        } as UserProfile);

      resetVolatileRuntimeState({
        clearUsers: shouldClearUsers,
        adminUser: shouldClearUsers ? adminUser : null,
        clearActiveCalls: Boolean(options.clearActiveCalls || options.callLogs || options.clearAllUsers),
        clearPresence: options.clearPresence !== false,
      });

      if (!shouldClearUsers && options.mockIds && Array.isArray(options.mockIds)) {
        for (const id of options.mockIds) {
          purgeUserRuntimeState(String(id));
        }
      }

      broadcastActiveCalls();
      broadcastPresence();
      broadcastUsers();
      broadcastCreatorMetrics();

      // 2. If Supabase Admin is configured, perform complete cascading database purge
      let supabaseResult: any = { success: true, clearedTables: [], warnings: [] };
      if (isSupabaseAdminConfigured()) {
        if (!isSupabaseServiceRoleConfigured()) {
          return res.status(503).json({
            success: false,
            error: {
              message:
                'Database reset requires SUPABASE_SERVICE_ROLE_KEY. The anon key cannot bypass RLS, so tables would not actually be purged.',
              code: 'SERVICE_ROLE_REQUIRED',
            },
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
          creatorReviews: Boolean(options.creatorReviews),
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
          walletLedger: Boolean(options.walletLedger),
          resetBalances: options.resetBalances,
        });
        if (!supabaseResult?.success) {
          return res.status(500).json({
            success: false,
            error: supabaseResult?.error || 'Database reset failed.',
            clearedTables: supabaseResult?.clearedTables || [],
            warnings: supabaseResult?.warnings || [],
          });
        }
      }

      return res.json({
        success: true,
        message: 'Server and database state reset successfully.',
        clearedTables: supabaseResult.clearedTables || [],
        warnings: supabaseResult.warnings || [],
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
      if (existing?.role === 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin accounts cannot be deleted.',
          data: { authDeleted: false, profileDeleted: false },
        });
      }

      const userName = existing?.name || userId;

      let deleteResult = {
        userId: String(userId),
        authDeleted: false,
        profileDeleted: false,
        r2DeletedCount: 0,
        warnings: [] as string[],
      };

      if (isSupabaseAdminConfigured()) {
        const hard = await hardDeleteUserCompletely(String(userId));
        deleteResult = {
          userId: hard.userId,
          authDeleted: hard.authDeleted,
          profileDeleted: hard.profileDeleted,
          r2DeletedCount: hard.r2DeletedCount,
          warnings: hard.warnings,
        };
        if (!hard.success || !hard.profileDeleted || !hard.authDeleted) {
          return res.status(500).json({
            success: false,
            error:
              hard.error ||
              (!hard.authDeleted
                ? 'Auth user was not deleted — account may still be able to sign in. Retry delete.'
                : 'Failed to delete profile'),
            data: deleteResult,
          });
        }
      } else {
        deleteResult.warnings.push('Supabase admin not configured; deleted from server memory only.');
        deleteResult.profileDeleted = true;
        deleteResult.authDeleted = false;
        return res.status(503).json({
          success: false,
          error: 'Supabase admin is not configured; cannot safely delete Auth + profile.',
          data: deleteResult,
        });
      }

      purgeUserRuntimeState(String(userId));
      if (deleteResult.userId && deleteResult.userId !== String(userId)) {
        purgeUserRuntimeState(String(deleteResult.userId));
      }

      broadcastAll({
        type: 'users:deleted',
        userId,
        users: getFormattedUsers(),
      });
      broadcastPresence();
      broadcastUsers();

      return res.json({
        success: true,
        message: `User ${userName} was permanently deleted from database and system.`,
        data: deleteResult,
      });
    } catch (err: any) {
      console.error('Error in POST /api/admin/delete-user:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * Backfill profiles.auth_id from auth.users by email where auth_id IS NULL.
   * Admin-only; does not delete/recreate users.
   */
  router.post('/users/backfill-auth-ids', requireAdmin, async (_req, res) => {
    try {
      if (!isSupabaseAdminConfigured()) {
        return res.status(503).json({
          success: false,
          error: { message: 'Supabase admin is not configured', code: 'SUPABASE_NOT_CONFIGURED' },
        });
      }
      const result = await backfillMissingAuthIdsAdmin();
      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: { message: result.error || 'Backfill failed', code: 'BACKFILL_FAILED' },
          data: { linked: result.linked, skipped: result.skipped },
        });
      }

      try {
        const { fetchProfilesAdmin } = await import('../supabaseAdmin');
        const refreshed = await fetchProfilesAdmin();
        if (refreshed.success && refreshed.profiles) {
          for (const p of refreshed.profiles) {
            if (p?.id && p.auth_id) {
              const existing = serverUsers.get(p.id);
              if (existing) {
                serverUsers.set(p.id, { ...existing, authId: p.auth_id });
              }
            }
          }
          broadcastUsers();
        }
      } catch {
        // memory refresh is best-effort
      }

      return res.json({
        success: true,
        data: {
          linked: result.linked,
          skipped: result.skipped,
          skippedCount: result.skipped.length,
        },
        message: `Linked ${result.linked} profile(s); skipped ${result.skipped.length}.`,
      });
    } catch (err: any) {
      console.error('Error in POST /api/admin/users/backfill-auth-ids:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * Delete orphan auth.users with no matching profiles (by auth_id / id / email).
   * Does not delete any profile rows. Never deletes Auth marked admin in metadata.
   */
  router.post('/users/cleanup-orphan-auth', requireAdmin, async (_req, res) => {
    try {
      if (!isSupabaseAdminConfigured()) {
        return res.status(503).json({
          success: false,
          error: { message: 'Supabase admin is not configured', code: 'SUPABASE_NOT_CONFIGURED' },
        });
      }
      const result = await cleanupOrphanAuthUsersAdmin();
      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: { message: result.error || 'Cleanup failed', code: 'ORPHAN_CLEANUP_FAILED' },
          data: { deleted: result.deleted, skipped: result.skipped },
        });
      }
      return res.json({
        success: true,
        data: {
          deleted: result.deleted,
          skipped: result.skipped,
          skippedCount: result.skipped.length,
        },
        message: `Deleted ${result.deleted} orphan Auth user(s); skipped ${result.skipped.length}.`,
      });
    } catch (err: any) {
      console.error('Error in POST /api/admin/users/cleanup-orphan-auth:', err);
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
    purgeUserRuntimeState,
    isUserHardDeleted,
  } = ctx;

  /**
   * Self-delete account (non-admin only). Target always from JWT/session profileId.
   */
  router.post('/me/delete', requireAuth, async (req, res) => {
    try {
      const profile = (req as any).profile;
      const profileId = String((req as any).profileId || profile?.id || '').trim();
      const role = String(profile?.role || '').toLowerCase();

      if (!profileId) {
        return res.status(401).json({
          success: false,
          error: { message: 'Not authenticated', code: 'UNAUTHORIZED' },
        });
      }
      if (role === 'admin') {
        return res.status(403).json({
          success: false,
          error: { message: 'Admin accounts cannot be self-deleted.', code: 'ADMIN_DELETE_FORBIDDEN' },
        });
      }

      const confirmPhrase = String(req.body?.confirmPhrase || req.body?.confirmation || '')
        .trim()
        .toUpperCase();
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const email = String(profile?.email || '').trim().toLowerCase();

      if (confirmPhrase !== 'DELETE' && confirmPhrase !== email.toUpperCase()) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Type DELETE (or your email) to confirm permanent account deletion.',
            code: 'CONFIRMATION_REQUIRED',
          },
        });
      }

      if (!password || password.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'Password is required to delete your account.', code: 'PASSWORD_REQUIRED' },
        });
      }

      if (!email) {
        return res.status(400).json({
          success: false,
          error: { message: 'Account email is missing; cannot verify password.', code: 'EMAIL_REQUIRED' },
        });
      }

      const authCheck = await authenticateUserWithPasswordAdmin(email, password);
      if (!authCheck.success) {
        return res.status(401).json({
          success: false,
          error: {
            message: authCheck.error || 'Password verification failed.',
            code: 'PASSWORD_INVALID',
          },
        });
      }

      if (!isSupabaseAdminConfigured()) {
        return res.status(503).json({
          success: false,
          error: { message: 'Account deletion is temporarily unavailable.', code: 'SUPABASE_NOT_CONFIGURED' },
        });
      }

      const hard = await hardDeleteUserCompletely(profileId);
      if (!hard.success || !hard.profileDeleted || !hard.authDeleted) {
        return res.status(500).json({
          success: false,
          error: {
            message:
              hard.error ||
              'Could not fully delete your account (Auth or profile). Please contact support.',
            code: 'DELETE_INCOMPLETE',
          },
          data: {
            authDeleted: hard.authDeleted,
            profileDeleted: hard.profileDeleted,
            warnings: hard.warnings,
          },
        });
      }

      purgeUserRuntimeState(profileId);
      if (hard.userId && hard.userId !== profileId) {
        purgeUserRuntimeState(hard.userId);
      }

      broadcastAll({
        type: 'users:deleted',
        userId: profileId,
        users: getFormattedUsers(),
      });
      broadcastPresence();
      broadcastUsers();

      return res.json({
        success: true,
        message: 'Your account has been permanently deleted.',
        data: {
          userId: hard.userId,
          authDeleted: hard.authDeleted,
          profileDeleted: hard.profileDeleted,
          r2DeletedCount: hard.r2DeletedCount,
        },
      });
    } catch (err: any) {
      console.error('Error in POST /api/users/me/delete:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Server-side Bulk Users Sync Endpoint
  router.post('/sync-all', requireAdmin, async (req, res) => {
    try {
      const { users: incomingUsers, overwrite } = req.body || {};
      if (Array.isArray(incomingUsers)) {
        if (overwrite) {
          serverUsers.clear();
        }
        for (const u of incomingUsers) {
          if (u && u.id && !isUserHardDeleted(u.id)) {
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
      if (existing?.role === 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin accounts cannot be deleted.',
          data: { authDeleted: false, profileDeleted: false },
        });
      }

      const userName = existing?.name || userId;

      let deleteResult = {
        userId: String(userId),
        authDeleted: false,
        profileDeleted: false,
        r2DeletedCount: 0,
        warnings: [] as string[],
      };

      if (isSupabaseAdminConfigured()) {
        const hard = await hardDeleteUserCompletely(String(userId));
        deleteResult = {
          userId: hard.userId,
          authDeleted: hard.authDeleted,
          profileDeleted: hard.profileDeleted,
          r2DeletedCount: hard.r2DeletedCount,
          warnings: hard.warnings,
        };
        if (!hard.success || !hard.profileDeleted || !hard.authDeleted) {
          return res.status(500).json({
            success: false,
            error:
              hard.error ||
              (!hard.authDeleted
                ? 'Auth user was not deleted — account may still be able to sign in. Retry delete.'
                : 'Failed to delete profile'),
            data: deleteResult,
          });
        }
      } else {
        return res.status(503).json({
          success: false,
          error: 'Supabase admin is not configured; cannot safely delete Auth + profile.',
          data: deleteResult,
        });
      }

      purgeUserRuntimeState(String(userId));
      if (deleteResult.userId && deleteResult.userId !== String(userId)) {
        purgeUserRuntimeState(String(deleteResult.userId));
      }

      broadcastAll({
        type: 'users:deleted',
        userId,
        users: getFormattedUsers(),
      });
      broadcastPresence();
      broadcastUsers();

      return res.json({
        success: true,
        message: `User ${userName} (${userId}) was permanently deleted from database and system.`,
        data: deleteResult,
      });
    } catch (err: any) {
      console.error('Error in DELETE /api/users/:id:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
