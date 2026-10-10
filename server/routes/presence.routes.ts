import { Router } from 'express';
import type { ServerRuntime } from '../runtimeTypes';
import { requireAuth } from '../middleware/auth';
import {
  upsertProfileAdmin,
  isSupabaseAdminConfigured,
  upsertCreatorMetricsAdmin,
  assertActiveSessionAdmin,
} from '../supabaseAdmin';
import {
  isRedisConfigured,
  setPresence,
  deletePresence,
  mgetPresence,
} from '../../lib/redis';

function readClientSessionId(req: { headers: Record<string, unknown>; body?: any }): string | null {
  const header = req.headers['x-session-id'] || req.headers['X-Session-Id'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  if (Array.isArray(header) && typeof header[0] === 'string' && header[0].trim()) {
    return header[0].trim();
  }
  const fromBody = req.body?.sessionId || req.body?.activeSessionId;
  return typeof fromBody === 'string' && fromBody.trim() ? fromBody.trim() : null;
}

async function rejectIfSessionReplaced(req: any, res: any, profileId: string): Promise<boolean> {
  const clientSessionId = readClientSessionId(req);
  // Only reject when the client sends a session id that no longer matches
  if (!clientSessionId) return false;
  const check = await assertActiveSessionAdmin({
    profileId,
    clientSessionId,
    enforceMissing: false,
  });
  if (check.ok === false) {
    res.status(409).json({
      success: false,
      code: 'SESSION_REPLACED',
      error: {
        message: 'Your account was signed in on another device. Please sign in again.',
        code: 'SESSION_REPLACED',
      },
    });
    return true;
  }
  return false;
}

export function createPresenceRouter(ctx: ServerRuntime): Router {
  const router = Router();
  const {
    getFormattedPresence,
    broadcastPresence,
    broadcastUsers,
    applyPresenceHeartbeat,
    getAuthoritativeStatus,
  } = ctx;

  // Dedicated Presence REST Endpoint — online | busy | offline
  router.post('/', requireAuth, async (req, res) => {
    try {
      const userId = String((req as any).profileId || (req as any).user?.id || '');
      const { status } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId required' });
      }
      if (await rejectIfSessionReplaced(req, res, userId)) return;

      const requested =
        status === 'offline'
          ? 'offline'
          : status === 'busy' || status === 'in_call'
            ? 'busy'
            : status === 'online' || !status
              ? 'online'
              : null;
      if (!requested) {
        return res.status(400).json({
          success: false,
          error: 'status must be online, busy, or offline',
        });
      }

      const result = applyPresenceHeartbeat(userId, requested, {
        persistStatus: true,
        fromUnload: requested === 'offline',
      });

      if (result.changed) {
        broadcastPresence();
        broadcastUsers();
      }

      return res.json({
        success: true,
        status: result.status,
        presence: getFormattedPresence(),
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Lightweight liveness ping — Redis lease when configured; durable DB only on transitions
  router.post('/heartbeat', requireAuth, async (req, res) => {
    try {
      const userId = String((req as any).profileId || (req as any).user?.id || '');
      const { status, durable, peerIds } = req.body || {};
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId required' });
      }
      if (await rejectIfSessionReplaced(req, res, userId)) return;

      const requested =
        status === 'offline'
          ? 'offline'
          : status === 'busy' || status === 'in_call'
            ? 'busy'
            : status === 'online' || !status
              ? 'online'
              : null;
      if (status && !requested) {
        return res.status(400).json({
          success: false,
          error: 'status must be online, busy, or offline',
        });
      }

      const writeStatus = requested || 'online';
      const durableWrite = Boolean(durable) || writeStatus === 'offline';

      if (isRedisConfigured()) {
        if (writeStatus === 'offline') await deletePresence(userId);
        else await setPresence(userId, writeStatus);
      }

      const result = applyPresenceHeartbeat(userId, writeStatus, {
        // Skip Postgres on routine Redis heartbeats
        persistStatus: durableWrite || !isRedisConfigured(),
      });

      if (result.changed) {
        broadcastPresence();
        broadcastUsers();
      }

      let presence = getFormattedPresence();
      if (isRedisConfigured() && Array.isArray(peerIds) && peerIds.length) {
        const redisMap = await mgetPresence(peerIds.map(String));
        presence = { ...presence, ...redisMap, [userId]: writeStatus };
      }

      return res.json({
        success: true,
        status: result.status,
        presence,
        redis: isRedisConfigured(),
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/', requireAuth, (req, res) => {
    return res.json({ success: true, presence: getFormattedPresence() });
  });

  return router;
}

export function createCreatorRouter(ctx: ServerRuntime): Router {
  const router = Router();
  const {
    creatorMetricsMap,
    serverUsers,
    getFormattedCreatorMetrics,
    broadcastCreatorMetrics,
    broadcastUsers,
    accrueCreatorOnlineTime,
    toggleReadyNowForCreator,
    getFirstCallBonusAmounts,
  } = ctx;

  router.get('/metrics', requireAuth, async (req, res) => {
    try {
      const creatorId = req.query.creatorId as string | undefined;
      const selfId = String((req as any).profileId || (req as any).user?.id || '');
      if (creatorId) {
        // Non-admins may only fetch self (agency lists use full map from WS/admin)
        const role = (req as any).profile?.role;
        const allowed =
          creatorId === selfId || role === 'admin' || role === 'team_leader' || role === 'agency_manager';
        if (!allowed) {
          return res.status(403).json({ success: false, error: 'Forbidden' });
        }
        const metric = creatorMetricsMap.get(creatorId);
        return res.json({ success: true, metric: metric || null });
      }
      return res.json({ success: true, metrics: getFormattedCreatorMetrics() });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Server-owned accrual nudge — ignores body.secondsIncrement
  router.post('/heartbeat', requireAuth, async (req, res) => {
    try {
      const creatorId = String((req as any).profileId || (req as any).user?.id || '');
      if (!creatorId) {
        return res.status(400).json({ success: false, error: 'creatorId is required' });
      }

      const metrics = accrueCreatorOnlineTime(creatorId, { forcePersist: false });
      const result = metrics || creatorMetricsMap.get(creatorId) || null;

      return res.json({ success: true, metrics: result });
    } catch (err: any) {
      console.error('Error in POST /api/creator/heartbeat:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Ready Now — authenticated; creatorId always from session
  router.post('/ready-now-toggle', requireAuth, async (req, res) => {
    try {
      const creatorId = String((req as any).profileId || (req as any).user?.id || '');
      if (!creatorId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { isReadyNow } = req.body;
      const updated = toggleReadyNowForCreator(creatorId, Boolean(isReadyNow));
      broadcastCreatorMetrics();

      return res.json({ success: true, metrics: updated });
    } catch (err: any) {
      console.error('Error in POST /api/creator/ready-now-toggle:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Record Call Offer / Answer / Decline / Miss Event
  router.post('/call-offer', requireAuth, async (req, res) => {
    try {
      const creatorId = String((req as any).profileId || (req as any).user?.id || '');
      const { outcome } = req.body;
      if (!creatorId || !outcome) {
        return res.status(400).json({ success: false, error: 'creatorId and outcome are required' });
      }

      const existing = creatorMetricsMap.get(creatorId) || {
        creatorId,
        activeOnlineSeconds: 0,
        activeOnlineHours: 0,
        coinsEarnedFromCalls: 0,
        coinsEarnedFromGifts: 0,
        totalCallsOffered: 0,
        totalCallsAnswered: 0,
        totalCallsDeclined: 0,
        totalCallsMissed: 0,
        responseHealthScore: 100,
        performanceTier: 'bronze',
      };

      if (outcome === 'offered') {
        existing.totalCallsOffered = (existing.totalCallsOffered || 0) + 1;
      } else if (outcome === 'answered') {
        existing.totalCallsAnswered = (existing.totalCallsAnswered || 0) + 1;
      } else if (outcome === 'declined') {
        existing.totalCallsDeclined = (existing.totalCallsDeclined || 0) + 1;
      } else if (outcome === 'missed') {
        existing.totalCallsMissed = (existing.totalCallsMissed || 0) + 1;
      }

      const totalOff = Math.max(
        1,
        existing.totalCallsOffered ||
          existing.totalCallsAnswered + existing.totalCallsDeclined + existing.totalCallsMissed
      );
      existing.responseHealthScore = Number(
        (((existing.totalCallsAnswered || 0) / totalOff) * 100).toFixed(1)
      );
      existing.updatedAt = new Date().toISOString();

      creatorMetricsMap.set(creatorId, existing);

      if (isSupabaseAdminConfigured()) {
        await upsertCreatorMetricsAdmin(existing);
      }

      broadcastCreatorMetrics();

      return res.json({ success: true, metrics: existing });
    } catch (err: any) {
      console.error('Error in POST /api/creator/call-offer:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Claim Daily First Call Bonus — amounts from system_configs when available
  router.post('/first-call-bonus', requireAuth, async (req, res) => {
    try {
      const creatorId = String((req as any).profileId || (req as any).user?.id || '');
      if (!creatorId) {
        return res.status(400).json({ success: false, error: 'creatorId is required' });
      }

      const { coins: bonusCoins, usd: bonusUSD } = await getFirstCallBonusAmounts();

      const todayStr = new Date().toISOString().split('T')[0];
      const existing = creatorMetricsMap.get(creatorId) || {
        creatorId,
        activeOnlineSeconds: 0,
        bonusEarnedCoins: 0,
        bonusEarnedUSD: 0,
      };

      if (existing.firstCallBonusClaimedDate === todayStr) {
        return res.json({
          success: false,
          message: 'Daily first call bonus already claimed today.',
          alreadyClaimed: true,
        });
      }

      const coinsToAdd = Number(bonusCoins || 100);
      const usdToAdd = Number(bonusUSD || 1.0);

      existing.firstCallBonusClaimedDate = todayStr;
      existing.bonusEarnedCoins = (existing.bonusEarnedCoins || 0) + coinsToAdd;
      existing.bonusEarnedUSD = Number(((existing.bonusEarnedUSD || 0) + usdToAdd).toFixed(2));
      existing.updatedAt = new Date().toISOString();

      creatorMetricsMap.set(creatorId, existing);

      const user = serverUsers.get(creatorId);
      if (user) {
        user.earningsCoins = (user.earningsCoins || 0) + coinsToAdd;
        user.totalLifetimeEarnedUSD = Number(
          ((user.totalLifetimeEarnedUSD || 0) + usdToAdd).toFixed(2)
        );
        if (isSupabaseAdminConfigured()) {
          await upsertProfileAdmin(user);
        }
      }

      if (isSupabaseAdminConfigured()) {
        await upsertCreatorMetricsAdmin(existing);
      }

      broadcastCreatorMetrics();
      broadcastUsers();

      return res.json({
        success: true,
        bonusCoins: coinsToAdd,
        bonusUSD: usdToAdd,
        metrics: existing,
      });
    } catch (err: any) {
      console.error('Error in POST /api/creator/first-call-bonus:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}
