import { Router } from 'express';
import type { ServerRuntime } from '../runtimeTypes';
import { requireAuth } from '../middleware/auth';
import {
  upsertProfileAdmin,
  isSupabaseAdminConfigured,
  updateUserStatusAdmin,
  upsertCreatorMetricsAdmin,
} from '../supabaseAdmin';

export function createPresenceRouter(ctx: ServerRuntime): Router {
  const router = Router();
  const {
    presenceMap,
    userLastSeen,
    connectedSockets,
    serverUsers,
    getFormattedPresence,
    broadcastPresence,
    broadcastUsers,
  } = ctx;

  // Dedicated Presence REST Endpoint
  router.post('/', requireAuth, async (req, res) => {
    try {
      const userId = String((req as any).profileId || (req as any).user?.id || '');
      const { status } = req.body;
      if (!userId || !status) {
        return res.status(400).json({ success: false, error: 'userId and status required' });
      }

      if (status === 'offline') {
        userLastSeen.delete(userId);
        for (const c of connectedSockets) {
          if (c.userId === userId) {
            c.userId = '';
          }
        }
      } else {
        userLastSeen.set(userId, Date.now());
      }
      presenceMap.set(userId, status);
      const u = serverUsers.get(userId);
      if (u) u.onlineStatus = status;

      broadcastPresence();
      broadcastUsers();

      if (isSupabaseAdminConfigured()) {
        updateUserStatusAdmin(userId, status).catch(() => {});
      }

      return res.json({ success: true, presence: getFormattedPresence() });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Dedicated Presence Heartbeat REST Endpoint
  // Lightweight liveness ping — persists status to Supabase when provided
  router.post('/heartbeat', requireAuth, (req, res) => {
    try {
      const userId = String((req as any).profileId || (req as any).user?.id || '');
      const { status } = req.body;
      if (userId) {
        if (status === 'offline') {
          userLastSeen.delete(userId);
          presenceMap.set(userId, 'offline');
          for (const c of connectedSockets) {
            if (c.userId === userId) {
              c.userId = '';
            }
          }
          const u = serverUsers.get(userId);
          if (u) u.onlineStatus = 'offline';
          if (isSupabaseAdminConfigured()) {
            updateUserStatusAdmin(userId, 'offline').catch(() => {});
          }
        } else if (status) {
          userLastSeen.set(userId, Date.now());
          presenceMap.set(userId, status);
          const u = serverUsers.get(userId);
          if (u) u.onlineStatus = status;
          if (isSupabaseAdminConfigured()) {
            updateUserStatusAdmin(userId, status).catch(() => {});
          }
        } else {
          userLastSeen.set(userId, Date.now());
        }
      }
      return res.json({ success: true, presence: getFormattedPresence() });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Dedicated Presence GET Endpoint
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
  } = ctx;

  router.get('/metrics', requireAuth, async (req, res) => {
    try {
      const creatorId = req.query.creatorId as string | undefined;
      if (creatorId) {
        const metric = creatorMetricsMap.get(creatorId);
        return res.json({ success: true, metric: metric || null });
      }
      return res.json({ success: true, metrics: getFormattedCreatorMetrics() });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST Creator Heartbeat (Active Online Hours Tracking)
  router.post('/heartbeat', requireAuth, async (req, res) => {
    try {
      const creatorId = String((req as any).profileId || (req as any).user?.id || '');
      const { secondsIncrement, agencyLeaderId } = req.body;
      if (!creatorId) {
        return res.status(400).json({ success: false, error: 'creatorId is required' });
      }

      const inc = Number(secondsIncrement || 60);
      const existing = creatorMetricsMap.get(creatorId) || {
        creatorId,
        agencyLeaderId,
        activeOnlineSeconds: 0,
        activeOnlineHours: 0,
        coinsEarnedFromCalls: 0,
        coinsEarnedFromGifts: 0,
        totalTargetCoins: 0,
        currentStreakDays: 1,
        totalCallsOffered: 0,
        totalCallsAnswered: 0,
        totalCallsDeclined: 0,
        totalCallsMissed: 0,
        responseHealthScore: 100,
        performanceTier: 'bronze',
        isReadyNowActive: false,
        bonusEarnedCoins: 0,
        bonusEarnedUSD: 0,
        lastActiveDate: new Date().toISOString().split('T')[0],
      };

      const newSecs = (existing.activeOnlineSeconds || 0) + inc;
      const newHours = Number((newSecs / 3600).toFixed(2));
      const totalCoins = (existing.coinsEarnedFromCalls || 0) + (existing.coinsEarnedFromGifts || 0);

      // Dual-Metric Tier Calculation: Bronze (20h + 5k), Silver (40h + 20k), Gold (60h + 60k)
      let tier: 'bronze' | 'silver' | 'gold' = 'bronze';
      if (newHours >= 60 && totalCoins >= 60000) {
        tier = 'gold';
      } else if (newHours >= 40 && totalCoins >= 20000) {
        tier = 'silver';
      }

      const updatedMetrics = {
        ...existing,
        creatorId,
        agencyLeaderId: agencyLeaderId || existing.agencyLeaderId,
        activeOnlineSeconds: newSecs,
        activeOnlineHours: newHours,
        totalTargetCoins: totalCoins,
        performanceTier: tier,
        lastActiveDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString(),
      };

      creatorMetricsMap.set(creatorId, updatedMetrics);

      if (isSupabaseAdminConfigured()) {
        await upsertCreatorMetricsAdmin(updatedMetrics);
      }

      broadcastCreatorMetrics();

      return res.json({ success: true, metrics: updatedMetrics });
    } catch (err: any) {
      console.error('Error in POST /api/creator/heartbeat:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST Toggle Ready Now Boost
  router.post('/ready-now-toggle', async (req, res) => {
    try {
      const { creatorId, isReadyNow } = req.body;
      if (!creatorId) {
        return res.status(400).json({ success: false, error: 'creatorId is required' });
      }

      const existing = creatorMetricsMap.get(creatorId) || {
        creatorId,
        activeOnlineSeconds: 0,
        activeOnlineHours: 0,
        coinsEarnedFromCalls: 0,
        coinsEarnedFromGifts: 0,
        totalTargetCoins: 0,
        currentStreakDays: 1,
        totalCallsOffered: 0,
        totalCallsAnswered: 0,
        responseHealthScore: 100,
        performanceTier: 'bronze',
      };

      const updated = {
        ...existing,
        isReadyNowActive: Boolean(isReadyNow),
        readyNowToggledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      creatorMetricsMap.set(creatorId, updated);

      if (isSupabaseAdminConfigured()) {
        await upsertCreatorMetricsAdmin(updated);
      }

      broadcastCreatorMetrics();

      return res.json({ success: true, metrics: updated });
    } catch (err: any) {
      console.error('Error in POST /api/creator/ready-now-toggle:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST Record Call Offer / Answer / Decline / Miss Event
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

      const totalOff = Math.max(1, existing.totalCallsOffered || (existing.totalCallsAnswered + existing.totalCallsDeclined + existing.totalCallsMissed));
      existing.responseHealthScore = Number((( (existing.totalCallsAnswered || 0) / totalOff) * 100).toFixed(1));
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

  // POST Claim Daily First Call Bonus
  router.post('/first-call-bonus', requireAuth, async (req, res) => {
    try {
      const creatorId = String((req as any).profileId || (req as any).user?.id || '');
      if (!creatorId) {
        return res.status(400).json({ success: false, error: 'creatorId is required' });
      }
      const bonusCoins = 100;
      const bonusUSD = 1;

      const todayStr = new Date().toISOString().split('T')[0];
      const existing = creatorMetricsMap.get(creatorId) || {
        creatorId,
        activeOnlineSeconds: 0,
        bonusEarnedCoins: 0,
        bonusEarnedUSD: 0,
      };

      if (existing.firstCallBonusClaimedDate === todayStr) {
        return res.json({ success: false, message: 'Daily first call bonus already claimed today.', alreadyClaimed: true });
      }

      const coinsToAdd = Number(bonusCoins || 100);
      const usdToAdd = Number(bonusUSD || 1.00);

      existing.firstCallBonusClaimedDate = todayStr;
      existing.bonusEarnedCoins = (existing.bonusEarnedCoins || 0) + coinsToAdd;
      existing.bonusEarnedUSD = Number(((existing.bonusEarnedUSD || 0) + usdToAdd).toFixed(2));
      existing.updatedAt = new Date().toISOString();

      creatorMetricsMap.set(creatorId, existing);

      // Update creator profile earnings_coins so it is immediately withdrawable
      const user = serverUsers.get(creatorId);
      if (user) {
        user.earningsCoins = (user.earningsCoins || 0) + coinsToAdd;
        user.totalLifetimeEarnedUSD = Number(((user.totalLifetimeEarnedUSD || 0) + usdToAdd).toFixed(2));
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
