/**
 * Shared Financial Module types — periods, immutable ledger, settlement batches.
 * Keep this module free of React / DOM / Node-only APIs so server and (later) client can import it.
 *
 * Period rules (locked):
 * - Weekly: Monday 00:00 UTC → next Monday 00:00 UTC
 * - Monthly: calendar month 1st 00:00 UTC → next 1st 00:00 UTC (NOT rolling 30 days)
 * - Close clock: system_configs.period_close_utc_time (UTC HH:mm)
 *
 * Money mutations and period math live in server/finance (Phase 2+). This file is contracts only.
 */

export type SettlementCycleType = 'weekly' | 'monthly';

export type SettlementPeriodStatus = 'open' | 'closing' | 'closed' | 'failed';

export type FinancialLedgerEntryType =
  | 'PLATFORM_EARN'
  | 'HOST_EARN'
  | 'TL_EARN'
  | 'TARGET_BONUS'
  | 'TARGET_SHARE_TRUEUP'
  | 'SETTLEMENT_ACCRUAL'
  | 'SETTLEMENT_PAID'
  | 'REVERSAL';

export type FinancialCounterpartyRole = 'platform' | 'host' | 'team_leader';

export type SettlementBatchKind = 'team_leader_bundle' | 'direct_host';

export type SettlementBatchStatus =
  | 'pending_admin_pay'
  | 'admin_paid'
  | 'tl_confirmed'
  | 'cancelled';

export type SettlementPayeeRole = 'host' | 'team_leader';

export type SettlementLineComponent =
  | 'call_earnings'
  | 'gift_earnings'
  | 'target_bonus'
  | 'target_share_trueup'
  | 'tl_commission'
  | 'other';

export type HostSalaryStatus = 'pending' | 'paid';

export type SettlementEventType =
  | 'created'
  | 'admin_marked_paid'
  | 'tl_confirmed'
  | 'cancelled'
  | 'note';

export type CreatorPerformanceTier = 'bronze' | 'silver' | 'gold';

/** Snapshot of money rules frozen onto a settlement period at close. */
export interface SettlementConfigSnapshot {
  period_close_utc_time?: string;
  creator_target_cycle?: SettlementCycleType | string;
  /** Fixed Peg — USD per coin for host/TL/platform (Phase 1 canonical). */
  coin_usd_peg?: number;
  /** Call burn coins/min (non-friends) frozen at close. */
  coin_burn_rate_per_min?: number;
  /** Call burn coins/min (friends) frozen at close. */
  coin_burn_rate_friend_per_min?: number;
  /**
   * @deprecated Synced to coin_usd_peg for backward compat.
   */
  female_payout_ratio_usd?: number;
  /**
   * @deprecated Synced to coin_usd_peg for backward compat.
   */
  coin_to_usd_ratio?: number;
  /** Host target share % — period-end true-up if bronze+ met (not mid-call). Default 40. */
  female_host_target_share_percent?: number;
  /** Host base share % on live call burns — default 30, never gift 70. */
  female_host_share_percent?: number;
  team_leader_share_percent?: number;
  gift_female_host_share_percent?: number;
  gift_team_leader_share_percent?: number;
  creator_target_bronze_hours?: number;
  creator_target_bronze_coins?: number;
  creator_target_bronze_bonus_usd?: number;
  creator_target_silver_hours?: number;
  creator_target_silver_coins?: number;
  creator_target_silver_bonus_usd?: number;
  creator_target_gold_hours?: number;
  creator_target_gold_coins?: number;
  creator_target_gold_bonus_usd?: number;
  [key: string]: unknown;
}

export interface SettlementPeriod {
  id: string;
  cycleType: SettlementCycleType;
  /** Inclusive accrual window start (timestamptz ISO). */
  periodStart: string;
  /** Exclusive accrual window end (timestamptz ISO). */
  periodEnd: string;
  closeScheduledAt: string;
  closedAt: string | null;
  status: SettlementPeriodStatus;
  configSnapshot: SettlementConfigSnapshot;
  closeError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialLedgerEntry {
  id: string;
  createdAt: string;
  periodId: string | null;
  entryType: FinancialLedgerEntryType;
  userId: string | null;
  teamLeaderId: string | null;
  counterpartyRole: FinancialCounterpartyRole | null;
  amountCoins: number;
  amountUsd: number;
  fxRatio: number;
  sourceRefType: string | null;
  sourceRefId: string | null;
  metadata: Record<string, unknown>;
}

export interface SettlementBatch {
  id: string;
  periodId: string;
  batchKind: SettlementBatchKind;
  teamLeaderId: string | null;
  /** TL for team_leader_bundle; host for direct_host. */
  payeeUserId: string;
  status: SettlementBatchStatus;
  totalHostSalaryUsd: number;
  totalTlCommissionUsd: number;
  totalDueUsd: number;
  totalHostSalaryCoins: number;
  totalTlCommissionCoins: number;
  currency: string;
  paymentReference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementLineItem {
  id: string;
  batchId: string;
  payeeUserId: string;
  payeeRole: SettlementPayeeRole;
  amountCoins: number;
  amountUsd: number;
  component: SettlementLineComponent;
  breakdown: Record<string, unknown>;
  hostSalaryStatus: HostSalaryStatus;
  createdAt: string;
}

export interface SettlementEvent {
  id: string;
  batchId: string | null;
  periodId: string | null;
  eventType: SettlementEventType;
  actorUserId: string;
  note: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface CreatorPeriodSnapshot {
  id: string;
  periodId: string;
  creatorId: string;
  agencyLeaderId: string | null;
  activeOnlineSeconds: number;
  activeOnlineHours: number;
  coinsEarnedFromCalls: number;
  coinsEarnedFromGifts: number;
  totalTargetCoins: number;
  performanceTier: CreatorPerformanceTier;
  bonusEarnedCoins: number;
  bonusEarnedUsd: number;
  currentStreakDays: number;
  responseHealthScore: number;
  metricsSnapshot: Record<string, unknown>;
  createdAt: string;
}
