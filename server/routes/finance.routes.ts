/**
 * Financial Module HTTP routes (Phase 4 REST + Phase 3 job + Phase 5 funding gateway stubs).
 * Mounted at /api/v1/finance
 *
 * Funding: admin-credit + checkout-intent + webhook/provider all post via completeCoinPurchase
 * (ADMIN_MANUAL | GATEWAY → wallet_ledger PURCHASE). No live PSP in Phase 5.
 *
 * Auth: JWT profile id/role from session — never trust client-submitted user_id/role.
 * Host salary-status DTO strips all amounts.
 * Agency hosts → paid on tl_confirmed; direct hosts → paid on admin_paid
 * (enforced in statusTransition helpers).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import type { ServerRuntime } from '../runtimeTypes';
import {
  requireAdmin,
  requireAuth,
  requireTeamLeader,
  TEAM_LEADER_ROLES,
} from '../middleware/auth';
import { sensitiveActionLimiter } from '../middleware/rateLimit';
import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../supabaseAdmin';
import {
  closeDuePeriods,
  ensureOpenPeriod,
  loadFinanceSystemConfig,
  updateFinanceSystemConfig,
  markBatchAdminPaid,
  markBatchTlConfirmed,
  cancelSettlementBatch,
  getNextCloseAt,
  getCurrentPeriodBounds,
  checkManualPayoutAllowed,
  PAYOUT_PERIOD_END_ONLY,
  appendReversalEntry,
  completeCoinPurchase,
  createCheckoutIntent,
  failCheckoutIntent,
  getCoinUsdPeg,
  coinsToUsd,
} from '../finance';
import { PAYABLE_MODEL_NOTES, PAYABLE_SOURCE_OF_TRUTH } from '../finance/payableModel';
import { summarizeHostSettlementLines } from '../../shared/finance/hostEarningsBreakdown';

function authProfileId(req: any): string {
  return String(req.profileId || req.profile?.id || req.user?.id || '').trim();
}

function authRole(req: any): string {
  return String(req.profile?.role || '').trim();
}

function sendError(res: Response, status: number, message: string, code: string) {
  return res.status(status).json({ success: false, error: { message, code } });
}

function sendOk(res: Response, data: unknown, status = 200) {
  return res.status(status).json({ success: true, data });
}

function mapPeriod(row: any) {
  return {
    id: row.id,
    cycleType: row.cycle_type,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    closeScheduledAt: row.close_scheduled_at,
    closedAt: row.closed_at ?? null,
    status: row.status,
    configSnapshot: row.config_snapshot || {},
    closeError: row.close_error ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBatch(row: any) {
  return {
    id: row.id,
    periodId: row.period_id,
    batchKind: row.batch_kind,
    teamLeaderId: row.team_leader_id ?? null,
    payeeUserId: row.payee_user_id,
    status: row.status,
    totalHostSalaryUsd: Number(row.total_host_salary_usd) || 0,
    totalTlCommissionUsd: Number(row.total_tl_commission_usd) || 0,
    totalDueUsd: Number(row.total_due_usd) || 0,
    totalHostSalaryCoins: Number(row.total_host_salary_coins) || 0,
    totalTlCommissionCoins: Number(row.total_tl_commission_coins) || 0,
    currency: row.currency || 'USD',
    paymentReference: row.payment_reference ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLineItem(row: any) {
  return {
    id: row.id,
    batchId: row.batch_id,
    payeeUserId: row.payee_user_id,
    payeeRole: row.payee_role,
    amountCoins: Number(row.amount_coins) || 0,
    amountUsd: Number(row.amount_usd) || 0,
    component: row.component,
    breakdown: row.breakdown || {},
    hostSalaryStatus: row.host_salary_status,
    createdAt: row.created_at,
  };
}

function mapLedgerEntry(row: any) {
  return {
    id: row.id,
    createdAt: row.created_at,
    periodId: row.period_id ?? null,
    entryType: row.entry_type,
    userId: row.user_id ?? null,
    teamLeaderId: row.team_leader_id ?? null,
    counterpartyRole: row.counterparty_role ?? null,
    amountCoins: Number(row.amount_coins) || 0,
    amountUsd: Number(row.amount_usd) || 0,
    fxRatio: Number(row.fx_ratio) || 0,
    sourceRefType: row.source_ref_type ?? null,
    sourceRefId: row.source_ref_id ?? null,
    metadata: row.metadata || {},
  };
}

function mapLiveWalletLedgerRow(
  row: any,
  profile?: { id?: string; name?: string; email?: string } | null
) {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  return {
    id: row.id,
    userId: row.user_id,
    userName: profile?.name ?? null,
    userEmail: profile?.email ?? null,
    callId: row.call_id ?? null,
    transactionType: row.transaction_type,
    amountCoins: Number(row.amount) || 0,
    balanceAfter: Number(row.balance_after) || 0,
    billingMinute: Number(row.billing_minute) || 0,
    metadata,
    createdAt: row.created_at,
  };
}

function mapEvent(row: any) {
  return {
    id: row.id,
    batchId: row.batch_id ?? null,
    periodId: row.period_id ?? null,
    eventType: row.event_type,
    actorUserId: row.actor_user_id,
    note: row.note ?? null,
    payload: row.payload || {},
    createdAt: row.created_at,
  };
}

function mapCoinPurchase(row: any, profile?: { id?: string; name?: string; email?: string } | null) {
  return {
    id: row.id,
    userId: row.user_id,
    userName: profile?.name ?? null,
    userEmail: profile?.email ?? null,
    channel: row.channel,
    status: row.status,
    amountCoins: Number(row.amount_coins) || 0,
    amountUsd: row.amount_usd != null ? Number(row.amount_usd) : null,
    coinUsdPegAtPurchase:
      row.coin_usd_peg_at_purchase != null ? Number(row.coin_usd_peg_at_purchase) : null,
    pegValueUsd: row.peg_value_usd != null ? Number(row.peg_value_usd) : null,
    loadMarginUsd: row.load_margin_usd != null ? Number(row.load_margin_usd) : null,
    packageId: row.package_id ?? null,
    paymentProvider: row.payment_provider ?? null,
    externalRef: row.external_ref ?? null,
    actorAdminId: row.actor_admin_id ?? null,
    reason: row.reason ?? null,
    walletLedgerId: row.wallet_ledger_id ?? null,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
  };
}

function getConfiguredJobSecret(): string {
  return (
    process.env.FINANCE_JOB_SECRET ||
    process.env.CRON_SECRET ||
    process.env.FINANCE_CRON_SECRET ||
    ''
  ).trim();
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function extractJobSecret(req: Request): string {
  const header =
    (req.headers['x-finance-job-secret'] as string | undefined) ||
    (req.headers['x-cron-secret'] as string | undefined) ||
    '';
  if (header && String(header).trim()) return String(header).trim();
  // Do not treat Authorization Bearer as job secret (JWT collision risk).
  const bodySecret = (req.body as any)?.jobSecret || (req.body as any)?.secret;
  if (typeof bodySecret === 'string' && bodySecret.trim()) return bodySecret.trim();
  return '';
}

export async function requireFinanceJobAuth(req: Request, res: Response, next: NextFunction) {
  const configured = getConfiguredJobSecret();
  const provided = extractJobSecret(req);
  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

  // Phase 10: production requires an explicit job secret (admin JWT alone is insufficient).
  if (isProd && !configured) {
    return sendError(
      res,
      503,
      'FINANCE_JOB_SECRET (or CRON_SECRET) must be configured in production',
      'JOB_SECRET_REQUIRED'
    );
  }

  if (configured && provided && timingSafeEqualString(provided, configured)) {
    (req as any).financeJobAuth = 'secret';
    return next();
  }

  if (isProd && configured) {
    // In production, only the job secret may invoke cron endpoints (not admin JWT).
    return sendError(res, 401, 'Invalid or missing finance job secret', 'JOB_AUTH_FAILED');
  }

  return requireAdmin(req, res, () => {
    (req as any).financeJobAuth = 'admin';
    return next();
  });
}

function requireDb(res: Response): boolean {
  if (!isSupabaseAdminConfigured() || !getSupabaseAdmin()) {
    sendError(res, 503, 'Finance backend unavailable', 'NO_ADMIN');
    return false;
  }
  return true;
}

export function createFinanceRouter(runtime: ServerRuntime): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    return sendOk(res, {
      module: 'finance',
      phase: 4,
      payableSourceOfTruth: PAYABLE_SOURCE_OF_TRUTH,
      payableModelNotes: PAYABLE_MODEL_NOTES,
    });
  });

  /**
   * Authenticated read-only period clock (hosts/TL/admin).
   * Used for target countdown UI — no amounts, no admin required.
   */
  router.get('/period-clock', requireAuth, async (_req, res) => {
    try {
      if (!requireDb(res)) return;
      const config = await loadFinanceSystemConfig();
      const ensured = await ensureOpenPeriod({ at: new Date(), config });
      const nextCloseAt = await getNextCloseAt({ at: new Date(), config });
      const bounds = getCurrentPeriodBounds(config.creatorTargetCycle, new Date());
      return sendOk(res, {
        cycleType: config.creatorTargetCycle,
        periodCloseUtcTime: config.periodCloseUtcTime,
        settlementEnabled: config.settlementEnabled,
        periodStart: bounds.periodStart.toISOString(),
        periodEnd: bounds.periodEnd.toISOString(),
        nextCloseAt: nextCloseAt.toISOString(),
        periodId: ensured.period?.id ?? null,
        periodStatus: ensured.period?.status ?? null,
      });
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'Failed to load period clock', 'PERIOD_CLOCK_FAILED');
    }
  });

  // =========================================================================
  // ADMIN — periods
  // =========================================================================

  router.get('/periods', requireAdmin, async (req, res) => {
    try {
      if (!requireDb(res)) return;
      const client = getSupabaseAdmin()!;
      const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
      const cycleType = typeof req.query.cycleType === 'string' ? req.query.cycleType.trim() : '';
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const offset = Math.max(Number(req.query.offset) || 0, 0);

      let q = client
        .from('settlement_periods')
        .select('*')
        .order('period_start', { ascending: false })
        .range(offset, offset + limit - 1);
      if (status) q = q.eq('status', status);
      if (cycleType) q = q.eq('cycle_type', cycleType);

      const { data, error } = await q;
      if (error) return sendError(res, 500, error.message, 'PERIODS_LOAD_FAILED');
      return sendOk(res, {
        periods: (data || []).map(mapPeriod),
        pagination: { limit, offset, count: (data || []).length },
      });
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'Failed to load periods', 'PERIODS_LOAD_FAILED');
    }
  });

  router.get('/periods/current', requireAdmin, async (_req, res) => {
    try {
      if (!requireDb(res)) return;
      const config = await loadFinanceSystemConfig();
      const ensured = await ensureOpenPeriod({ at: new Date(), config });
      const nextCloseAt = await getNextCloseAt({ at: new Date(), config });
      const bounds = getCurrentPeriodBounds(config.creatorTargetCycle, new Date());
      return sendOk(res, {
        period: ensured.period,
        created: ensured.created,
        bounds: {
          cycleType: bounds.cycleType,
          periodStart: bounds.periodStart.toISOString(),
          periodEnd: bounds.periodEnd.toISOString(),
        },
        nextCloseAt: nextCloseAt.toISOString(),
        config: {
          creatorTargetCycle: config.creatorTargetCycle,
          periodCloseUtcTime: config.periodCloseUtcTime,
          settlementEnabled: config.settlementEnabled,
        },
      });
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'Failed to load current period', 'CURRENT_PERIOD_FAILED');
    }
  });

  router.get('/periods/:id', requireAdmin, async (req, res) => {
    try {
      if (!requireDb(res)) return;
      const id = String(req.params.id || '').trim();
      if (!id) return sendError(res, 400, 'Period id required', 'INVALID_ID');
      const { data, error } = await getSupabaseAdmin()!
        .from('settlement_periods')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) return sendError(res, 500, error.message, 'PERIOD_LOAD_FAILED');
      if (!data) return sendError(res, 404, 'Period not found', 'NOT_FOUND');
      return sendOk(res, { period: mapPeriod(data) });
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'Failed to load period', 'PERIOD_LOAD_FAILED');
    }
  });

  // =========================================================================
  // ADMIN — config
  // =========================================================================

  router.patch('/config', requireAdmin, sensitiveActionLimiter, async (req, res) => {
    try {
      if (!requireDb(res)) return;
      const body = req.body || {};
      const patch = {
        creatorTargetCycle:
          body.creatorTargetCycle ?? body.creator_target_cycle ?? undefined,
        periodCloseUtcTime:
          body.periodCloseUtcTime ?? body.period_close_utc_time ?? undefined,
        settlementEnabled:
          body.settlementEnabled ?? body.settlement_enabled ?? undefined,
      };

      const updated = await updateFinanceSystemConfig(patch);
      if (!updated.success || !updated.config) {
        return sendError(res, 400, updated.error || 'Config update failed', 'CONFIG_UPDATE_FAILED');
      }

      // Keep open period close_scheduled_at in sync when clock/cycle changes
      await ensureOpenPeriod({ at: new Date(), config: updated.config });

      return sendOk(res, {
        config: {
          creatorTargetCycle: updated.config.creatorTargetCycle,
          periodCloseUtcTime: updated.config.periodCloseUtcTime,
          settlementEnabled: updated.config.settlementEnabled,
          coinUsdPeg: updated.config.coinUsdPeg,
          femalePayoutRatioUsd: updated.config.femalePayoutRatioUsd,
          coinToUsdRatio: updated.config.coinToUsdRatio,
          thresholds: updated.config.thresholds,
        },
      });
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'Config update failed', 'CONFIG_UPDATE_FAILED');
    }
  });

  // =========================================================================
  // JOBS (cron secret or admin) — keep Phase 3 entrypoints
  // =========================================================================

  router.post('/jobs/close-due-periods', requireFinanceJobAuth, sensitiveActionLimiter, async (req, res) => {
    try {
      const body = req.body || {};
      const actorFromAdmin = authProfileId(req) || null;
      const actorUserId =
        (typeof body.actorUserId === 'string' && body.actorUserId.trim()) ||
        actorFromAdmin ||
        process.env.FINANCE_JOB_ACTOR_USER_ID ||
        null;

      await ensureOpenPeriod({ at: new Date() });
      await loadFinanceSystemConfig({ force: true });

      const result = await closeDuePeriods({
        actorUserId,
        includeFailedRetries: body.includeFailedRetries !== false,
        creatorMetricsMap: runtime.creatorMetricsMap,
        onMetricsReset: () => {
          try {
            runtime.broadcastCreatorMetrics();
          } catch {
            /* non-fatal */
          }
        },
      });

      const httpStatus = result.success ? 200 : 500;
      return res.status(httpStatus).json({
        success: result.success,
        data: {
          ensuredOpenPeriodId: result.ensuredOpenPeriodId,
          results: result.results,
          payableSourceOfTruth: PAYABLE_SOURCE_OF_TRUTH,
          payableModelNotes: PAYABLE_MODEL_NOTES,
          authMode: (req as any).financeJobAuth,
        },
        error: result.error
          ? { message: result.error, code: 'CLOSE_DUE_PERIODS_FAILED' }
          : undefined,
      });
    } catch (err: any) {
      console.error('[finance] close-due-periods error:', err?.message || err);
      return sendError(res, 500, err?.message || 'Close job failed', 'CLOSE_DUE_PERIODS_FAILED');
    }
  });

  router.post('/jobs/ensure-open-period', requireFinanceJobAuth, sensitiveActionLimiter, async (_req, res) => {
    try {
      const ensured = await ensureOpenPeriod({ at: new Date() });
      return res.status(ensured.success ? 200 : 500).json({
        success: ensured.success,
        data: {
          period: ensured.period,
          bounds: {
            cycleType: ensured.bounds.cycleType,
            periodStart: ensured.bounds.periodStart.toISOString(),
            periodEnd: ensured.bounds.periodEnd.toISOString(),
          },
          created: ensured.created,
        },
        error: ensured.error
          ? { message: ensured.error, code: 'ENSURE_OPEN_PERIOD_FAILED' }
          : undefined,
      });
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'ensureOpenPeriod failed', 'ENSURE_OPEN_PERIOD_FAILED');
    }
  });

  // =========================================================================
  // ADMIN — ledger
  // =========================================================================

  router.get('/ledger', requireAdmin, async (req, res) => {
    try {
      if (!requireDb(res)) return;
      const client = getSupabaseAdmin()!;
      const periodId = typeof req.query.periodId === 'string' ? req.query.periodId.trim() : '';
      const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
      const entryType = typeof req.query.entryType === 'string' ? req.query.entryType.trim() : '';
      const teamLeaderId =
        typeof req.query.teamLeaderId === 'string' ? req.query.teamLeaderId.trim() : '';
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
      const offset = Math.max(Number(req.query.offset) || 0, 0);

      let q = client
        .from('financial_ledger')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (periodId) q = q.eq('period_id', periodId);
      if (userId) q = q.eq('user_id', userId);
      if (entryType) q = q.eq('entry_type', entryType);
      if (teamLeaderId) q = q.eq('team_leader_id', teamLeaderId);

      const { data, error } = await q;
      if (error) return sendError(res, 500, error.message, 'LEDGER_LOAD_FAILED');
      return sendOk(res, {
        entries: (data || []).map(mapLedgerEntry),
        pagination: { limit, offset, count: (data || []).length },
      });
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'Failed to load ledger', 'LEDGER_LOAD_FAILED');
    }
  });

  router.get('/ledger/live', requireAdmin, async (req, res) => {
    try {
      if (!requireDb(res)) return;
      const client = getSupabaseAdmin()!;

      const transactionType =
        typeof req.query.transactionType === 'string' ? req.query.transactionType.trim() : '';
      const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
      const callId = typeof req.query.callId === 'string' ? req.query.callId.trim() : '';
      const from = typeof req.query.from === 'string' ? req.query.from.trim() : '';
      const to = typeof req.query.to === 'string' ? req.query.to.trim() : '';
      const limit = Math.min(Math.max(Number(req.query.limit) || 300, 1), 1000);
      const offset = Math.max(Number(req.query.offset) || 0, 0);

      let q = client
        .from('wallet_ledger')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (transactionType) q = q.eq('transaction_type', transactionType);
      if (userId) q = q.eq('user_id', userId);
      if (callId) q = q.eq('call_id', callId);
      if (from) q = q.gte('created_at', from);
      if (to) q = q.lte('created_at', to);

      const { data, error } = await q;
      if (error) return sendError(res, 500, error.message, 'LIVE_LEDGER_LOAD_FAILED');

      const rows = data || [];
      const userIds = Array.from(new Set(rows.map((r: any) => String(r.user_id || '')).filter(Boolean)));
      const { data: profiles } = userIds.length
        ? await client.from('profiles').select('id, name, email').in('id', userIds)
        : { data: [] as any[] };
      const profileById = new Map(
        (profiles || []).map((p: any) => [String(p.id), { id: p.id, name: p.name, email: p.email }])
      );

      let callDebitCoins = 0;
      let giftDebitCoins = 0;
      let hostEarnCoins = 0;
      let targetShareTrueUpCoins = 0;
      let tlEarnCoins = 0;
      let purchaseCoins = 0;
      let rewardCoins = 0;
      for (const row of rows) {
        const t = String(row.transaction_type || '');
        const amount = Number(row.amount) || 0;
        if (t === 'CALL_DEBIT') callDebitCoins += Math.abs(amount);
        else if (t === 'GIFT_DEBIT') giftDebitCoins += Math.abs(amount);
        else if (t === 'HOST_EARN') hostEarnCoins += Math.max(0, amount);
        else if (t === 'TARGET_SHARE_TRUEUP') targetShareTrueUpCoins += Math.max(0, amount);
        else if (t === 'TL_EARN') tlEarnCoins += Math.max(0, amount);
        else if (t === 'PURCHASE') purchaseCoins += Math.max(0, amount);
        else if (t.startsWith('REWARD_')) rewardCoins += Math.max(0, amount);
      }

      const cfg = await loadFinanceSystemConfig();
      // Phase 5 Fixed Peg: one rate for call/gift debit, host/TL payables, platform retained.
      const peg = Number(cfg.coinUsdPeg) || getCoinUsdPeg(cfg);
      const burnDebitCoins = callDebitCoins + giftDebitCoins;
      const platformRetainedCoins =
        burnDebitCoins - hostEarnCoins - targetShareTrueUpCoins - tlEarnCoins;
      const aggregates = {
        callDebitCoins,
        giftDebitCoins,
        hostEarnCoins,
        targetShareTrueUpCoins,
        tlEarnCoins,
        platformRetainedCoins,
        purchaseCoins,
        rewardCoins,
        callDebitUsd: coinsToUsd(callDebitCoins, peg),
        giftDebitUsd: coinsToUsd(giftDebitCoins, peg),
        hostPayableUsd: coinsToUsd(hostEarnCoins, peg),
        tlPayableUsd: coinsToUsd(tlEarnCoins, peg),
        platformRetainedUsd: coinsToUsd(platformRetainedCoins, peg),
        coinUsdPeg: peg,
      };

      return sendOk(res, {
        entries: rows.map((row: any) =>
          mapLiveWalletLedgerRow(row, profileById.get(String(row.user_id)) || null)
        ),
        aggregates,
        pagination: { limit, offset, count: rows.length },
      });
    } catch (err: any) {
      return sendError(
        res,
        500,
        err?.message || 'Failed to load live wallet ledger',
        'LIVE_LEDGER_LOAD_FAILED'
      );
    }
  });

  // =========================================================================
  // ADMIN — batches
  // =========================================================================

  router.get('/batches', requireAdmin, async (req, res) => {
    try {
      if (!requireDb(res)) return;
      const client = getSupabaseAdmin()!;
      const periodId = typeof req.query.periodId === 'string' ? req.query.periodId.trim() : '';
      const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
      const batchKind = typeof req.query.batchKind === 'string' ? req.query.batchKind.trim() : '';
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
      const offset = Math.max(Number(req.query.offset) || 0, 0);

      let q = client
        .from('settlement_batches')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (periodId) q = q.eq('period_id', periodId);
      if (status) q = q.eq('status', status);
      if (batchKind) q = q.eq('batch_kind', batchKind);

      const { data, error } = await q;
      if (error) return sendError(res, 500, error.message, 'BATCHES_LOAD_FAILED');
      return sendOk(res, {
        batches: (data || []).map(mapBatch),
        pagination: { limit, offset, count: (data || []).length },
      });
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'Failed to load batches', 'BATCHES_LOAD_FAILED');
    }
  });

  router.get('/batches/:id', requireAdmin, async (req, res) => {
    try {
      if (!requireDb(res)) return;
      const id = String(req.params.id || '').trim();
      if (!id) return sendError(res, 400, 'Batch id required', 'INVALID_ID');
      const client = getSupabaseAdmin()!;

      const { data: batch, error } = await client
        .from('settlement_batches')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) return sendError(res, 500, error.message, 'BATCH_LOAD_FAILED');
      if (!batch) return sendError(res, 404, 'Batch not found', 'NOT_FOUND');

      const [{ data: lines }, { data: events }, { data: period }] = await Promise.all([
        client.from('settlement_line_items').select('*').eq('batch_id', id).order('created_at'),
        client
          .from('settlement_events')
          .select('*')
          .eq('batch_id', id)
          .order('created_at', { ascending: false }),
        client.from('settlement_periods').select('*').eq('id', batch.period_id).maybeSingle(),
      ]);

      return sendOk(res, {
        batch: mapBatch(batch),
        lineItems: (lines || []).map(mapLineItem),
        events: (events || []).map(mapEvent),
        period: period ? mapPeriod(period) : null,
      });
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'Failed to load batch', 'BATCH_LOAD_FAILED');
    }
  });

  router.post('/batches/:id/admin-mark-paid', requireAdmin, sensitiveActionLimiter, async (req, res) => {
    try {
      if (!requireDb(res)) return;
      const id = String(req.params.id || '').trim();
      const actorUserId = authProfileId(req);
      if (!id) return sendError(res, 400, 'Batch id required', 'INVALID_ID');
      if (!actorUserId) return sendError(res, 401, 'Unauthorized', 'UNAUTHORIZED');

      const body = req.body || {};
      const result = await markBatchAdminPaid({
        batchId: id,
        actorUserId,
        note: typeof body.note === 'string' ? body.note : undefined,
        paymentReference:
          typeof body.paymentReference === 'string'
            ? body.paymentReference
            : typeof body.payment_reference === 'string'
              ? body.payment_reference
              : undefined,
        // Product rule: direct hosts paid on admin_paid; TL bundles wait for tl_confirmed
        markHostsPaidNow: false,
      });

      if (!result.success) {
        const status =
          result.code === 'NOT_FOUND' ? 404 : result.code === 'INVALID_TRANSITION' ? 409 : 400;
        return sendError(res, status, result.error || 'Mark paid failed', result.code || 'MARK_PAID_FAILED');
      }

      const { data: batch } = await getSupabaseAdmin()!
        .from('settlement_batches')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      return sendOk(res, { batch: batch ? mapBatch(batch) : null });
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'Mark paid failed', 'MARK_PAID_FAILED');
    }
  });

  /** Cancel batch (status + settlement_events). Amounts stay immutable. */
  router.post('/batches/:id/cancel', requireAdmin, sensitiveActionLimiter, async (req, res) => {
    try {
      if (!requireDb(res)) return;
      const id = String(req.params.id || '').trim();
      const actorUserId = authProfileId(req);
      if (!id) return sendError(res, 400, 'Batch id required', 'INVALID_ID');
      if (!actorUserId) return sendError(res, 401, 'Unauthorized', 'UNAUTHORIZED');

      const body = req.body || {};
      const result = await cancelSettlementBatch({
        batchId: id,
        actorUserId,
        note: typeof body.note === 'string' ? body.note : undefined,
      });
      if (!result.success) {
        const status =
          result.code === 'NOT_FOUND' ? 404 : result.code === 'INVALID_TRANSITION' ? 409 : 400;
        return sendError(res, status, result.error || 'Cancel failed', result.code || 'CANCEL_FAILED');
      }

      const { data: batch } = await getSupabaseAdmin()!
        .from('settlement_batches')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      return sendOk(res, { batch: batch ? mapBatch(batch) : null });
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'Cancel failed', 'CANCEL_FAILED');
    }
  });

  /**
   * Minimal REVERSAL ledger stub — append-only correction (never mutates prior rows).
   * Does not auto-adjust settlement batches; ops must pair with cancel when needed.
   */
  router.post('/ledger/reversal', requireAdmin, sensitiveActionLimiter, async (req, res) => {
    try {
      if (!requireDb(res)) return;
      const body = req.body || {};
      const amountCoins = Number(body.amountCoins ?? body.amount_coins);
      const fxRatio = Number(body.fxRatio ?? body.fx_ratio);
      if (!Number.isFinite(amountCoins) || amountCoins === 0) {
        return sendError(res, 400, 'amountCoins required (typically negative)', 'INVALID_AMOUNT');
      }
      if (!Number.isFinite(fxRatio) || fxRatio <= 0) {
        return sendError(res, 400, 'fxRatio required', 'INVALID_FX');
      }

      const result = await appendReversalEntry({
        periodId:
          typeof body.periodId === 'string'
            ? body.periodId
            : typeof body.period_id === 'string'
              ? body.period_id
              : null,
        userId:
          typeof body.userId === 'string'
            ? body.userId
            : typeof body.user_id === 'string'
              ? body.user_id
              : null,
        teamLeaderId:
          typeof body.teamLeaderId === 'string'
            ? body.teamLeaderId
            : typeof body.team_leader_id === 'string'
              ? body.team_leader_id
              : null,
        counterpartyRole:
          body.counterpartyRole === 'platform' ||
          body.counterpartyRole === 'host' ||
          body.counterpartyRole === 'team_leader'
            ? body.counterpartyRole
            : null,
        amountCoins,
        amountUsd:
          body.amountUsd !== undefined
            ? Number(body.amountUsd)
            : body.amount_usd !== undefined
              ? Number(body.amount_usd)
              : undefined,
        fxRatio,
        reversesEntryId:
          typeof body.reversesEntryId === 'string'
            ? body.reversesEntryId
            : typeof body.reverses_entry_id === 'string'
              ? body.reverses_entry_id
              : null,
        reason: typeof body.reason === 'string' ? body.reason : undefined,
        metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : undefined,
      });

      if (!result.success) {
        return sendError(res, 500, result.error || 'Reversal failed', 'REVERSAL_FAILED');
      }
      return sendOk(res, { entry: result.entry }, 201);
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'Reversal failed', 'REVERSAL_FAILED');
    }
  });

  // =========================================================================
  // FUNDING / PURCHASES — admin manual + gateway-ready (Phase 1)
  // =========================================================================

  router.post('/funding/admin-credit', requireAdmin, sensitiveActionLimiter, async (req, res) => {
    try {
      if (!requireDb(res)) return;
      const actorAdminId = authProfileId(req);
      if (!actorAdminId) return sendError(res, 401, 'Unauthorized', 'UNAUTHORIZED');

      const body = req.body || {};
      const userId =
        typeof body.userId === 'string'
          ? body.userId.trim()
          : typeof body.user_id === 'string'
            ? body.user_id.trim()
            : '';
      const amountCoins = Number(body.amountCoins ?? body.amount_coins);
      const reason =
        typeof body.reason === 'string' && body.reason.trim()
          ? body.reason.trim().slice(0, 500)
          : 'Manual Admin Credit';
      const amountUsd =
        body.amountUsd !== undefined
          ? Number(body.amountUsd)
          : body.amount_usd !== undefined
            ? Number(body.amount_usd)
            : undefined;

      if (!userId) return sendError(res, 400, 'userId required', 'INVALID_USER');
      if (!Number.isFinite(amountCoins) || amountCoins <= 0) {
        return sendError(res, 400, 'amountCoins must be a positive number', 'INVALID_AMOUNT');
      }

      const result = await completeCoinPurchase({
        userId,
        amountCoins,
        channel: 'ADMIN_MANUAL',
        amountUsd: Number.isFinite(amountUsd) ? amountUsd : undefined,
        actorAdminId,
        reason,
      });

      if (!result.success) {
        const status =
          result.code === 'NOT_FOUND'
            ? 404
            : result.code === 'INVALID_AMOUNT' || result.code === 'INVALID_USER'
              ? 400
              : 500;
        return sendError(res, status, result.error || 'Admin credit failed', result.code || 'ADMIN_CREDIT_FAILED');
      }

      const { data: profile } = await getSupabaseAdmin()!
        .from('profiles')
        .select('id, auth_id, email, coin_balance, earnings_coins, name')
        .eq('id', userId)
        .maybeSingle();

      if (profile && runtime.serverUsers) {
        const existing = runtime.serverUsers.get(userId);
        const normalized = runtime.normalizeUserProfile({
          ...(existing || {}),
          id: userId,
          authId: profile.auth_id ?? existing?.authId,
          email: profile.email ?? existing?.email,
          name: profile.name || existing?.name,
          coinBalance: Number(profile.coin_balance) || 0,
          earningsCoins: Number(profile.earnings_coins) || existing?.earningsCoins || 0,
        });
        runtime.serverUsers.set(userId, normalized);
        runtime.broadcastAll({
          type: 'wallet:balance_update',
          userId: normalized.id,
          authId: normalized.authId,
          email: normalized.email,
          coinBalance: normalized.coinBalance,
          earningsCoins: normalized.earningsCoins,
        });
        runtime.broadcastUsers();
      }

      const { data: purchaseRow } = await getSupabaseAdmin()!
        .from('coin_purchases')
        .select('*')
        .eq('id', result.purchaseId!)
        .maybeSingle();

      return sendOk(
        res,
        {
          purchase: purchaseRow ? mapCoinPurchase(purchaseRow, profile) : null,
          walletLedgerId: result.walletLedgerId,
          coinBalance: result.coinBalance,
          duplicate: result.duplicate === true,
        },
        201
      );
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'Admin credit failed', 'ADMIN_CREDIT_FAILED');
    }
  });

  router.get('/funding', requireAdmin, async (req, res) => {
    try {
      if (!requireDb(res)) return;
      const client = getSupabaseAdmin()!;
      const channel = typeof req.query.channel === 'string' ? req.query.channel.trim() : '';
      const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
      const from = typeof req.query.from === 'string' ? req.query.from.trim() : '';
      const to = typeof req.query.to === 'string' ? req.query.to.trim() : '';
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
      const offset = Math.max(Number(req.query.offset) || 0, 0);

      let q = client
        .from('coin_purchases')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (channel === 'ADMIN_MANUAL' || channel === 'GATEWAY') q = q.eq('channel', channel);
      if (userId) q = q.eq('user_id', userId);
      if (from) q = q.gte('created_at', from);
      if (to) q = q.lte('created_at', to);

      const { data, error } = await q;
      if (error) return sendError(res, 500, error.message, 'FUNDING_LOAD_FAILED');

      const userIds = Array.from(new Set((data || []).map((r: any) => String(r.user_id))));
      const { data: profiles } = userIds.length
        ? await client
            .from('profiles')
            .select('id, name, email')
            .in('id', userIds)
        : { data: [] as any[] };
      const profileById = new Map(
        (profiles || []).map((p: any) => [
          String(p.id),
          { id: p.id, name: p.name, email: p.email },
        ])
      );

      return sendOk(res, {
        purchases: (data || []).map((row: any) =>
          mapCoinPurchase(row, profileById.get(String(row.user_id)) || null)
        ),
        pagination: { limit, offset, count: (data || []).length },
      });
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'Failed to load funding', 'FUNDING_LOAD_FAILED');
    }
  });

  router.get('/funding/mine', requireAuth, async (req, res) => {
    try {
      if (!requireDb(res)) return;
      const userId = authProfileId(req);
      if (!userId) return sendError(res, 401, 'Unauthorized', 'UNAUTHORIZED');

      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const offset = Math.max(Number(req.query.offset) || 0, 0);

      const { data, error } = await getSupabaseAdmin()!
        .from('coin_purchases')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) return sendError(res, 500, error.message, 'FUNDING_MINE_FAILED');

      return sendOk(res, {
        purchases: (data || []).map((row: any) => mapCoinPurchase(row)),
        pagination: { limit, offset, count: (data || []).length },
      });
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'Failed to load purchase history', 'FUNDING_MINE_FAILED');
    }
  });

  /**
   * Create a pending GATEWAY purchase from coin_packages SKU.
   * Does not credit coins — webhook (or admin simulate) calls completeCoinPurchase.
   */
  router.post('/funding/checkout-intent', requireAuth, sensitiveActionLimiter, async (req, res) => {
    try {
      if (!requireDb(res)) return;
      const userId = authProfileId(req);
      if (!userId) return sendError(res, 401, 'Unauthorized', 'UNAUTHORIZED');

      const body = req.body || {};
      const packageId =
        typeof body.packageId === 'string'
          ? body.packageId.trim()
          : typeof body.package_id === 'string'
            ? body.package_id.trim()
            : '';
      const provider =
        typeof body.provider === 'string' && body.provider.trim()
          ? body.provider.trim().slice(0, 64)
          : 'stub';

      if (!packageId) return sendError(res, 400, 'packageId required', 'INVALID_PACKAGE');

      const result = await createCheckoutIntent({ userId, packageId, provider });
      if (!result.success) {
        const status =
          result.code === 'PACKAGE_NOT_FOUND' || result.code === 'NOT_FOUND'
            ? 404
            : result.code === 'INVALID_PACKAGE' || result.code === 'INVALID_USER'
              ? 400
              : 500;
        return sendError(res, status, result.error || 'Checkout intent failed', result.code || 'CHECKOUT_INTENT_FAILED');
      }

      return sendOk(
        res,
        {
          purchase: result.purchase,
          package: result.package,
          checkoutToken: result.checkoutToken,
          note:
            'Skeleton checkout — no live PSP. Complete via POST /funding/webhook/provider or admin simulate-gateway.',
        },
        201
      );
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'Checkout intent failed', 'CHECKOUT_INTENT_FAILED');
    }
  });

  /**
   * Gateway webhook stub / extension point.
   * Real PSP: verify signature with FINANCE_WEBHOOK_SECRET (or provider-specific secrets),
   * then call completeCoinPurchase(channel=GATEWAY) with the same completer as admin-credit.
   *
   * Body (success):
   *   { purchaseId, status: 'completed'|'failed', provider?, externalRef?, eventId? }
   * Optional header: X-Finance-Webhook-Secret
   */
  router.post('/funding/webhook/provider', sensitiveActionLimiter, async (req, res) => {
    try {
      if (!requireDb(res)) return;

      const configuredSecret = (
        process.env.FINANCE_WEBHOOK_SECRET ||
        process.env.PAYMENT_WEBHOOK_SECRET ||
        ''
      ).trim();
      const provided =
        String(req.headers['x-finance-webhook-secret'] || req.headers['x-payment-webhook-secret'] || '').trim() ||
        (typeof (req.body as any)?.webhookSecret === 'string' ? String((req.body as any).webhookSecret).trim() : '');

      // If a secret is configured, require it. If not, allow stub calls in non-production only.
      const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
      if (configuredSecret) {
        if (!provided || !timingSafeEqualString(provided, configuredSecret)) {
          return sendError(res, 401, 'Invalid webhook secret', 'WEBHOOK_AUTH_FAILED');
        }
      } else if (isProd) {
        return sendError(
          res,
          503,
          'FINANCE_WEBHOOK_SECRET must be configured in production before accepting gateway webhooks',
          'WEBHOOK_SECRET_REQUIRED'
        );
      }

      const body = req.body || {};
      const purchaseId =
        typeof body.purchaseId === 'string'
          ? body.purchaseId.trim()
          : typeof body.purchase_id === 'string'
            ? body.purchase_id.trim()
            : '';
      const statusRaw = String(body.status || body.event || 'completed').toLowerCase();
      const provider =
        typeof body.provider === 'string'
          ? body.provider.trim()
          : typeof body.payment_provider === 'string'
            ? body.payment_provider.trim()
            : 'stub';
      const externalRef =
        typeof body.externalRef === 'string'
          ? body.externalRef.trim()
          : typeof body.external_ref === 'string'
            ? body.external_ref.trim()
            : typeof body.eventId === 'string'
              ? body.eventId.trim()
              : null;

      if (!purchaseId) return sendError(res, 400, 'purchaseId required', 'INVALID_ID');

      if (statusRaw === 'failed' || statusRaw === 'canceled' || statusRaw === 'cancelled') {
        const failed = await failCheckoutIntent({
          purchaseId,
          reason: typeof body.reason === 'string' ? body.reason : 'Payment failed',
          provider,
          externalRef,
        });
        if (!failed.success) {
          const st = failed.code === 'NOT_FOUND' ? 404 : failed.code === 'ALREADY_COMPLETED' ? 409 : 400;
          return sendError(res, st, failed.error || 'Fail intent failed', failed.code || 'WEBHOOK_FAIL');
        }
        return sendOk(res, { purchaseId, status: 'failed' });
      }

      if (statusRaw !== 'completed' && statusRaw !== 'success' && statusRaw !== 'paid') {
        return sendError(res, 400, 'Unsupported webhook status', 'INVALID_STATUS');
      }

      const { data: pending } = await getSupabaseAdmin()!
        .from('coin_purchases')
        .select('*')
        .eq('id', purchaseId)
        .maybeSingle();
      if (!pending) return sendError(res, 404, 'Purchase intent not found', 'NOT_FOUND');

      const result = await completeCoinPurchase({
        purchaseId,
        userId: String(pending.user_id),
        amountCoins: Number(pending.amount_coins) || 0,
        channel: 'GATEWAY',
        amountUsd: pending.amount_usd != null ? Number(pending.amount_usd) : undefined,
        packageId: pending.package_id,
        provider: provider || pending.payment_provider || 'stub',
        externalRef: externalRef || `webhook_${purchaseId}`,
        reason: pending.reason || 'Gateway purchase',
      });

      if (!result.success) {
        const st =
          result.code === 'NOT_FOUND'
            ? 404
            : result.code === 'INVALID_STATUS' || result.code === 'DUPLICATE'
              ? 409
              : 500;
        return sendError(res, st, result.error || 'Webhook complete failed', result.code || 'WEBHOOK_COMPLETE_FAILED');
      }

      const { data: profile } = await getSupabaseAdmin()!
        .from('profiles')
        .select('id, auth_id, email, coin_balance, earnings_coins, name')
        .eq('id', pending.user_id)
        .maybeSingle();

      if (profile && runtime.serverUsers) {
        const existing = runtime.serverUsers.get(String(pending.user_id));
        const normalized = runtime.normalizeUserProfile({
          ...(existing || {}),
          id: String(pending.user_id),
          authId: profile.auth_id ?? existing?.authId,
          email: profile.email ?? existing?.email,
          name: profile.name || existing?.name,
          coinBalance: Number(profile.coin_balance) || 0,
          earningsCoins: Number(profile.earnings_coins) || existing?.earningsCoins || 0,
        });
        runtime.serverUsers.set(String(pending.user_id), normalized);
        runtime.broadcastAll({
          type: 'wallet:balance_update',
          userId: normalized.id,
          authId: normalized.authId,
          email: normalized.email,
          coinBalance: normalized.coinBalance,
          earningsCoins: normalized.earningsCoins,
        });
        runtime.broadcastUsers();
      }

      const { data: purchaseRow } = await getSupabaseAdmin()!
        .from('coin_purchases')
        .select('*')
        .eq('id', result.purchaseId!)
        .maybeSingle();

      return sendOk(res, {
        purchase: purchaseRow ? mapCoinPurchase(purchaseRow, profile) : null,
        walletLedgerId: result.walletLedgerId,
        coinBalance: result.coinBalance,
        duplicate: result.duplicate === true,
        extensionPoint:
          'Replace stub verification with real PSP signature checks; keep completeCoinPurchase as the sole credit path.',
      });
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'Webhook failed', 'WEBHOOK_FAILED');
    }
  });

  /**
   * Non-production admin helper: create pending GATEWAY intent then complete it
   * through the same completeCoinPurchase path a real webhook would use.
   */
  router.post('/funding/simulate-gateway', requireAdmin, sensitiveActionLimiter, async (req, res) => {
    try {
      if (!requireDb(res)) return;
      const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
      if (isProd) {
        return sendError(res, 403, 'simulate-gateway disabled in production', 'FORBIDDEN');
      }

      const actorAdminId = authProfileId(req);
      const body = req.body || {};
      const userId =
        typeof body.userId === 'string'
          ? body.userId.trim()
          : typeof body.user_id === 'string'
            ? body.user_id.trim()
            : '';
      const packageId =
        typeof body.packageId === 'string'
          ? body.packageId.trim()
          : typeof body.package_id === 'string'
            ? body.package_id.trim()
            : '';

      if (!userId) return sendError(res, 400, 'userId required', 'INVALID_USER');
      if (!packageId) return sendError(res, 400, 'packageId required', 'INVALID_PACKAGE');

      const intent = await createCheckoutIntent({
        userId,
        packageId,
        provider: 'simulate',
      });
      if (!intent.success || !intent.purchase) {
        return sendError(
          res,
          intent.code === 'PACKAGE_NOT_FOUND' ? 404 : 400,
          intent.error || 'Intent failed',
          intent.code || 'SIMULATE_FAILED'
        );
      }

      const externalRef = `sim_${intent.purchase.id}_${Date.now()}`;
      const result = await completeCoinPurchase({
        purchaseId: intent.purchase.id,
        userId,
        amountCoins: intent.purchase.amountCoins,
        channel: 'GATEWAY',
        amountUsd: intent.purchase.amountUsd,
        packageId,
        provider: 'simulate',
        externalRef,
        actorAdminId: actorAdminId || null,
        reason: `Simulated gateway purchase · ${intent.package?.title || packageId}`,
      });

      if (!result.success) {
        return sendError(res, 500, result.error || 'Simulate complete failed', result.code || 'SIMULATE_FAILED');
      }

      const { data: profile } = await getSupabaseAdmin()!
        .from('profiles')
        .select('id, auth_id, email, coin_balance, earnings_coins, name')
        .eq('id', userId)
        .maybeSingle();

      if (profile && runtime.serverUsers) {
        const existing = runtime.serverUsers.get(userId);
        const normalized = runtime.normalizeUserProfile({
          ...(existing || {}),
          id: userId,
          authId: profile.auth_id ?? existing?.authId,
          email: profile.email ?? existing?.email,
          name: profile.name || existing?.name,
          coinBalance: Number(profile.coin_balance) || 0,
          earningsCoins: Number(profile.earnings_coins) || existing?.earningsCoins || 0,
        });
        runtime.serverUsers.set(userId, normalized);
        runtime.broadcastAll({
          type: 'wallet:balance_update',
          userId: normalized.id,
          authId: normalized.authId,
          email: normalized.email,
          coinBalance: normalized.coinBalance,
          earningsCoins: normalized.earningsCoins,
        });
        runtime.broadcastUsers();
      }

      const { data: purchaseRow } = await getSupabaseAdmin()!
        .from('coin_purchases')
        .select('*')
        .eq('id', result.purchaseId!)
        .maybeSingle();

      return sendOk(
        res,
        {
          purchase: purchaseRow ? mapCoinPurchase(purchaseRow, profile) : null,
          package: intent.package,
          walletLedgerId: result.walletLedgerId,
          coinBalance: result.coinBalance,
          path: 'createCheckoutIntent → completeCoinPurchase(GATEWAY)',
        },
        201
      );
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'Simulate gateway failed', 'SIMULATE_FAILED');
    }
  });

  // =========================================================================
  // ADMIN — summary
  // =========================================================================

  router.get('/admin/summary', requireAdmin, async (req, res) => {
    try {
      if (!requireDb(res)) return;
      const client = getSupabaseAdmin()!;
      const periodId = typeof req.query.periodId === 'string' ? req.query.periodId.trim() : '';

      let periodFilterId = periodId;
      if (!periodFilterId) {
        const ensured = await ensureOpenPeriod({ at: new Date() });
        // Prefer latest closed period for settlement due totals; fall back to current open
        const { data: latestClosed } = await client
          .from('settlement_periods')
          .select('id')
          .eq('status', 'closed')
          .order('period_end', { ascending: false })
          .limit(1)
          .maybeSingle();
        periodFilterId = latestClosed?.id || ensured.period?.id || '';
      }

      let batchesQuery = client.from('settlement_batches').select('*');
      if (periodFilterId) batchesQuery = batchesQuery.eq('period_id', periodFilterId);
      const { data: batches, error: batchesError } = await batchesQuery;
      if (batchesError) return sendError(res, 500, batchesError.message, 'SUMMARY_FAILED');

      let ledgerQuery = client
        .from('financial_ledger')
        .select('entry_type, amount_usd, amount_coins');
      if (periodFilterId) ledgerQuery = ledgerQuery.eq('period_id', periodFilterId);
      const { data: ledgerRows, error: ledgerError } = await ledgerQuery;
      if (ledgerError) return sendError(res, 500, ledgerError.message, 'SUMMARY_FAILED');

      const list = batches || [];
      const ledger = ledgerRows || [];

      const sumUsd = (pred: (b: any) => boolean) =>
        list.filter(pred).reduce((s, b) => s + (Number(b.total_due_usd) || 0), 0);

      const platformEarnedUsd = ledger
        .filter((r) => r.entry_type === 'PLATFORM_EARN')
        .reduce((s, r) => s + (Number(r.amount_usd) || 0), 0);
      const hostAccruedUsd = ledger
        .filter(
          (r) =>
            r.entry_type === 'HOST_EARN' ||
            r.entry_type === 'TARGET_BONUS' ||
            r.entry_type === 'TARGET_SHARE_TRUEUP'
        )
        .reduce((s, r) => s + (Number(r.amount_usd) || 0), 0);
      const tlAccruedUsd = ledger
        .filter((r) => r.entry_type === 'TL_EARN')
        .reduce((s, r) => s + (Number(r.amount_usd) || 0), 0);

      const outstanding = list.filter((b) => b.status === 'pending_admin_pay');

      return sendOk(res, {
        periodId: periodFilterId || null,
        payableSourceOfTruth: PAYABLE_SOURCE_OF_TRUTH,
        platformEarnedUsd,
        hostAccruedUsd,
        tlAccruedUsd,
        totalDueToTeamLeadersUsd: sumUsd((b) => b.batch_kind === 'team_leader_bundle'),
        totalDueToDirectHostsUsd: sumUsd((b) => b.batch_kind === 'direct_host'),
        outstandingBatchCount: outstanding.length,
        outstandingDueUsd: outstanding.reduce((s, b) => s + (Number(b.total_due_usd) || 0), 0),
        batchCountsByStatus: {
          pending_admin_pay: list.filter((b) => b.status === 'pending_admin_pay').length,
          admin_paid: list.filter((b) => b.status === 'admin_paid').length,
          tl_confirmed: list.filter((b) => b.status === 'tl_confirmed').length,
          cancelled: list.filter((b) => b.status === 'cancelled').length,
        },
      });
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'Summary failed', 'SUMMARY_FAILED');
    }
  });

  // =========================================================================
  // TEAM LEADER — own batches (amounts allowed)
  // =========================================================================

  router.get('/tl/batches', requireTeamLeader, async (req, res) => {
    try {
      if (!requireDb(res)) return;
      const tlId = authProfileId(req);
      if (!tlId) return sendError(res, 401, 'Unauthorized', 'UNAUTHORIZED');
      if (!TEAM_LEADER_ROLES.has(authRole(req)) && authRole(req) !== 'admin') {
        return sendError(res, 403, 'Team leader role required', 'FORBIDDEN');
      }

      const client = getSupabaseAdmin()!;
      const periodId = typeof req.query.periodId === 'string' ? req.query.periodId.trim() : '';
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
      const offset = Math.max(Number(req.query.offset) || 0, 0);

      let q = client
        .from('settlement_batches')
        .select('*')
        .eq('batch_kind', 'team_leader_bundle')
        .or(`team_leader_id.eq.${tlId},payee_user_id.eq.${tlId}`)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      if (periodId) q = q.eq('period_id', periodId);

      const { data, error } = await q;
      if (error) return sendError(res, 500, error.message, 'TL_BATCHES_LOAD_FAILED');
      return sendOk(res, {
        batches: (data || []).map(mapBatch),
        pagination: { limit, offset, count: (data || []).length },
      });
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'Failed to load TL batches', 'TL_BATCHES_LOAD_FAILED');
    }
  });

  router.get('/tl/batches/:id', requireTeamLeader, async (req, res) => {
    try {
      if (!requireDb(res)) return;
      const tlId = authProfileId(req);
      const id = String(req.params.id || '').trim();
      if (!tlId) return sendError(res, 401, 'Unauthorized', 'UNAUTHORIZED');
      if (!id) return sendError(res, 400, 'Batch id required', 'INVALID_ID');

      const client = getSupabaseAdmin()!;
      const { data: batch, error } = await client
        .from('settlement_batches')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) return sendError(res, 500, error.message, 'TL_BATCH_LOAD_FAILED');
      if (!batch) return sendError(res, 404, 'Batch not found', 'NOT_FOUND');

      const isOwner =
        authRole(req) === 'admin' ||
        batch.team_leader_id === tlId ||
        batch.payee_user_id === tlId;
      if (!isOwner) return sendError(res, 403, 'Not your settlement batch', 'FORBIDDEN');

      const { data: lines } = await client
        .from('settlement_line_items')
        .select('*')
        .eq('batch_id', id)
        .order('created_at');
      const { data: events } = await client
        .from('settlement_events')
        .select('*')
        .eq('batch_id', id)
        .order('created_at', { ascending: false });

      return sendOk(res, {
        batch: mapBatch(batch),
        lineItems: (lines || []).map(mapLineItem),
        events: (events || []).map(mapEvent),
      });
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'Failed to load TL batch', 'TL_BATCH_LOAD_FAILED');
    }
  });

  router.post('/tl/batches/:id/confirm-received', requireTeamLeader, sensitiveActionLimiter, async (req, res) => {
    try {
      if (!requireDb(res)) return;
      const tlId = authProfileId(req);
      const id = String(req.params.id || '').trim();
      if (!tlId) return sendError(res, 401, 'Unauthorized', 'UNAUTHORIZED');
      if (!id) return sendError(res, 400, 'Batch id required', 'INVALID_ID');

      const body = req.body || {};
      const result = await markBatchTlConfirmed({
        batchId: id,
        actorUserId: tlId,
        note: typeof body.note === 'string' ? body.note : undefined,
      });

      if (!result.success) {
        const status =
          result.code === 'NOT_FOUND' ? 404 : result.code === 'INVALID_TRANSITION' ? 409 : 400;
        return sendError(
          res,
          status,
          result.error || 'Confirm received failed',
          result.code || 'TL_CONFIRM_FAILED'
        );
      }

      const { data: batch } = await getSupabaseAdmin()!
        .from('settlement_batches')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      return sendOk(res, { batch: batch ? mapBatch(batch) : null });
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'Confirm received failed', 'TL_CONFIRM_FAILED');
    }
  });

  // =========================================================================
  // Manual payouts (LEGACY) — always rejected (Phase 7: settlement only)
  // =========================================================================

  router.post('/manual-payouts', requireAuth, sensitiveActionLimiter, async (_req, res) => {
    try {
      const decision = await checkManualPayoutAllowed();
      return sendError(
        res,
        400,
        decision.message || 'Manual payouts are disabled. Use period-end settlement batches.',
        decision.code || PAYOUT_PERIOD_END_ONLY
      );
    } catch (err: any) {
      return sendError(
        res,
        400,
        err?.message || 'Manual payouts are disabled',
        PAYOUT_PERIOD_END_ONLY
      );
    }
  });

  // =========================================================================
  // HOST — salary status only (NO amounts) + period earnings breakdown (own amounts OK)
  // =========================================================================

  router.get('/host/salary-status', requireAuth, async (req, res) => {
    try {
      if (!requireDb(res)) return;
      const hostId = authProfileId(req);
      if (!hostId) return sendError(res, 401, 'Unauthorized', 'UNAUTHORIZED');

      const client = getSupabaseAdmin()!;
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

      const { data: lines, error } = await client
        .from('settlement_line_items')
        .select('id, batch_id, host_salary_status, payee_role, created_at')
        .eq('payee_user_id', hostId)
        .eq('payee_role', 'host')
        .order('created_at', { ascending: false })
        .limit(limit * 5);
      if (error) return sendError(res, 500, error.message, 'HOST_STATUS_FAILED');

      const batchIds = Array.from(new Set((lines || []).map((l: any) => String(l.batch_id))));
      if (!batchIds.length) {
        return sendOk(res, { items: [] });
      }

      const { data: batches, error: batchError } = await client
        .from('settlement_batches')
        .select('id, period_id, batch_kind, status, created_at')
        .in('id', batchIds);
      if (batchError) return sendError(res, 500, batchError.message, 'HOST_STATUS_FAILED');

      const periodIds = Array.from(
        new Set((batches || []).map((b: any) => String(b.period_id)).filter(Boolean))
      );
      const { data: periods } = periodIds.length
        ? await client
            .from('settlement_periods')
            .select('id, cycle_type, period_start, period_end, status')
            .in('id', periodIds)
        : { data: [] as any[] };

      const batchById = new Map((batches || []).map((b: any) => [String(b.id), b]));
      const periodById = new Map((periods || []).map((p: any) => [String(p.id), p]));

      // Aggregate per batch: pending if any host line pending, else paid
      const byBatch = new Map<
        string,
        { salaryStatus: 'pending' | 'paid'; lineCount: number }
      >();
      for (const line of lines || []) {
        const bid = String(line.batch_id);
        const prev = byBatch.get(bid) || { salaryStatus: 'paid' as const, lineCount: 0 };
        prev.lineCount += 1;
        if (line.host_salary_status !== 'paid') prev.salaryStatus = 'pending';
        byBatch.set(bid, prev);
      }

      const items = Array.from(byBatch.entries())
        .map(([batchId, agg]) => {
          const batch = batchById.get(batchId);
          if (!batch) return null;
          const period = periodById.get(String(batch.period_id));
          return {
            periodId: batch.period_id,
            cycleType: period?.cycle_type ?? null,
            periodStart: period?.period_start ?? null,
            periodEnd: period?.period_end ?? null,
            periodStatus: period?.status ?? null,
            batchId,
            batchKind: batch.batch_kind,
            batchStatus: batch.status,
            salaryStatus: agg.salaryStatus,
            // Intentionally omit all coin/USD amounts
          };
        })
        .filter(Boolean)
        .slice(0, limit);

      return sendOk(res, { items });
    } catch (err: any) {
      return sendError(res, 500, err?.message || 'Failed to load salary status', 'HOST_STATUS_FAILED');
    }
  });

  /**
   * Own-host period earnings breakdown (call base / true-up / gift / tier bonus).
   * Amounts allowed — this is the authenticated host's own settlement lines only.
   */
  router.get('/host/period-earnings', requireAuth, async (req, res) => {
    try {
      if (!requireDb(res)) return;
      const hostId = authProfileId(req);
      if (!hostId) return sendError(res, 401, 'Unauthorized', 'UNAUTHORIZED');

      const client = getSupabaseAdmin()!;
      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
      const periodIdFilter =
        typeof req.query.periodId === 'string' ? req.query.periodId.trim() : '';

      const { data: lines, error } = await client
        .from('settlement_line_items')
        .select(
          'id, batch_id, component, amount_coins, amount_usd, host_salary_status, payee_role, created_at'
        )
        .eq('payee_user_id', hostId)
        .eq('payee_role', 'host')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) return sendError(res, 500, error.message, 'HOST_EARNINGS_FAILED');

      const batchIds = Array.from(new Set((lines || []).map((l: any) => String(l.batch_id))));
      if (!batchIds.length) return sendOk(res, { periods: [] });

      const { data: batches, error: batchError } = await client
        .from('settlement_batches')
        .select('id, period_id, batch_kind, status')
        .in('id', batchIds);
      if (batchError) return sendError(res, 500, batchError.message, 'HOST_EARNINGS_FAILED');

      const periodIds = Array.from(
        new Set(
          (batches || [])
            .map((b: any) => String(b.period_id))
            .filter((id) => id && (!periodIdFilter || id === periodIdFilter))
        )
      );
      if (!periodIds.length) return sendOk(res, { periods: [] });

      const { data: periods } = await client
        .from('settlement_periods')
        .select('id, cycle_type, period_start, period_end, status, closed_at')
        .in('id', periodIds)
        .order('period_start', { ascending: false });

      const batchById = new Map((batches || []).map((b: any) => [String(b.id), b]));

      const linesByPeriod = new Map<string, any[]>();
      for (const line of lines || []) {
        const batch = batchById.get(String(line.batch_id));
        if (!batch) continue;
        const pid = String(batch.period_id);
        if (periodIdFilter && pid !== periodIdFilter) continue;
        const list = linesByPeriod.get(pid) || [];
        list.push(line);
        linesByPeriod.set(pid, list);
      }

      const result = (periods || [])
        .map((p: any) => {
          const pid = String(p.id);
          const periodLines = linesByPeriod.get(pid) || [];
          if (!periodLines.length) return null;
          const breakdown = summarizeHostSettlementLines(periodLines);
          const salaryStatus = periodLines.some((l) => l.host_salary_status !== 'paid')
            ? 'pending'
            : 'paid';
          return {
            periodId: pid,
            cycleType: p.cycle_type,
            periodStart: p.period_start,
            periodEnd: p.period_end,
            periodStatus: p.status,
            closedAt: p.closed_at ?? null,
            salaryStatus,
            breakdown,
            hasTrueUp: breakdown.targetShareTrueUpCoins > 0 || breakdown.targetShareTrueUpUsd > 0,
          };
        })
        .filter(Boolean)
        .slice(0, limit);

      return sendOk(res, { periods: result });
    } catch (err: any) {
      return sendError(
        res,
        500,
        err?.message || 'Failed to load period earnings',
        'HOST_EARNINGS_FAILED'
      );
    }
  });

  /** Admin: host period earnings breakdown for a selected user (+ optional period). */
  router.get('/admin/host-period-earnings', requireAdmin, async (req, res) => {
    try {
      if (!requireDb(res)) return;
      const userId =
        typeof req.query.userId === 'string'
          ? req.query.userId.trim()
          : typeof req.query.user_id === 'string'
            ? req.query.user_id.trim()
            : '';
      if (!userId) return sendError(res, 400, 'userId required', 'INVALID_USER');

      const periodIdFilter =
        typeof req.query.periodId === 'string'
          ? req.query.periodId.trim()
          : typeof req.query.period_id === 'string'
            ? req.query.period_id.trim()
            : '';
      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
      const client = getSupabaseAdmin()!;

      const { data: lines, error } = await client
        .from('settlement_line_items')
        .select(
          'id, batch_id, component, amount_coins, amount_usd, host_salary_status, payee_role, created_at'
        )
        .eq('payee_user_id', userId)
        .eq('payee_role', 'host')
        .order('created_at', { ascending: false })
        .limit(800);
      if (error) return sendError(res, 500, error.message, 'ADMIN_HOST_EARNINGS_FAILED');

      const batchIds = Array.from(new Set((lines || []).map((l: any) => String(l.batch_id))));
      if (!batchIds.length) return sendOk(res, { userId, periods: [] });

      const { data: batches, error: batchError } = await client
        .from('settlement_batches')
        .select('id, period_id, batch_kind, status')
        .in('id', batchIds);
      if (batchError) return sendError(res, 500, batchError.message, 'ADMIN_HOST_EARNINGS_FAILED');

      const periodIds = Array.from(
        new Set(
          (batches || [])
            .map((b: any) => String(b.period_id))
            .filter((id) => id && (!periodIdFilter || id === periodIdFilter))
        )
      );
      if (!periodIds.length) return sendOk(res, { userId, periods: [] });

      const { data: periods } = await client
        .from('settlement_periods')
        .select('id, cycle_type, period_start, period_end, status, closed_at')
        .in('id', periodIds)
        .order('period_start', { ascending: false });

      const batchById = new Map((batches || []).map((b: any) => [String(b.id), b]));

      const linesByPeriod = new Map<string, any[]>();
      for (const line of lines || []) {
        const batch = batchById.get(String(line.batch_id));
        if (!batch) continue;
        const pid = String(batch.period_id);
        if (periodIdFilter && pid !== periodIdFilter) continue;
        const list = linesByPeriod.get(pid) || [];
        list.push(line);
        linesByPeriod.set(pid, list);
      }

      const result = (periods || [])
        .map((p: any) => {
          const pid = String(p.id);
          const periodLines = linesByPeriod.get(pid) || [];
          if (!periodLines.length) return null;
          const breakdown = summarizeHostSettlementLines(periodLines);
          return {
            periodId: pid,
            cycleType: p.cycle_type,
            periodStart: p.period_start,
            periodEnd: p.period_end,
            periodStatus: p.status,
            closedAt: p.closed_at ?? null,
            breakdown,
            hasTrueUp: breakdown.targetShareTrueUpCoins > 0 || breakdown.targetShareTrueUpUsd > 0,
            lineItems: periodLines.map(mapLineItem),
          };
        })
        .filter(Boolean)
        .slice(0, limit);

      return sendOk(res, { userId, periods: result });
    } catch (err: any) {
      return sendError(
        res,
        500,
        err?.message || 'Failed to load admin host period earnings',
        'ADMIN_HOST_EARNINGS_FAILED'
      );
    }
  });

  return router;
}
