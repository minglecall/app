/**
 * Client wrappers for Financial Module REST APIs (/api/v1/finance).
 * Auth via Supabase session Bearer token (authFetch).
 * Host salary-status responses contain NO amounts by design.
 */

import { authFetch } from '../utils/apiClient';

const FINANCE_BASE = '/api/v1/finance';

export type FinanceApiError = {
  message: string;
  code?: string;
};

export type FinanceApiResult<T> = {
  success: boolean;
  data?: T;
  error?: FinanceApiError;
  status: number;
};

async function financeRequest<T>(
  path: string,
  init?: RequestInit
): Promise<FinanceApiResult<T>> {
  try {
    const res = await authFetch(`${FINANCE_BASE}${path}`, init);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.success === false) {
      return {
        success: false,
        status: res.status,
        error: {
          message: json?.error?.message || res.statusText || 'Request failed',
          code: json?.error?.code,
        },
      };
    }
    return { success: true, status: res.status, data: json.data as T };
  } catch (err: any) {
    return {
      success: false,
      status: 0,
      error: { message: err?.message || 'Network error', code: 'NETWORK_ERROR' },
    };
  }
}

function qs(params?: Record<string, string | number | undefined | null>): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// --- Health ---

export function fetchFinanceHealth() {
  return financeRequest<{
    module: string;
    phase: number;
    payableSourceOfTruth: string;
    payableModelNotes?: string;
  }>('/health');
}

/** Authenticated period clock for countdown UI (hosts + admin). No amounts. */
export function fetchPeriodClock() {
  return financeRequest<{
    cycleType: string;
    periodCloseUtcTime: string;
    settlementEnabled: boolean;
    periodStart: string;
    periodEnd: string;
    nextCloseAt: string;
    periodId: string | null;
    periodStatus: string | null;
  }>('/period-clock');
}

// --- Admin: periods ---

export function fetchFinancePeriods(params?: {
  status?: string;
  cycleType?: string;
  limit?: number;
}) {
  return financeRequest<{ periods: any[] }>(`/periods${qs(params)}`);
}

export function fetchCurrentFinancePeriod() {
  return financeRequest<{
    period: any;
    created?: boolean;
    bounds: { cycleType: string; periodStart: string; periodEnd: string };
    nextCloseAt: string;
    config: {
      creatorTargetCycle: string;
      periodCloseUtcTime: string;
      settlementEnabled: boolean;
    };
  }>('/periods/current');
}

export function fetchFinancePeriod(id: string) {
  return financeRequest<{ period: any }>(`/periods/${encodeURIComponent(id)}`);
}

// --- Admin: config ---

export function patchFinanceConfig(body: {
  creatorTargetCycle?: 'weekly' | 'monthly' | string;
  periodCloseUtcTime?: string;
  settlementEnabled?: boolean;
}) {
  return financeRequest<{ config: any }>('/config', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// --- Jobs ---

export function postCloseDuePeriods(body?: {
  includeFailedRetries?: boolean;
  jobSecret?: string;
}) {
  const headers: Record<string, string> = {};
  if (body?.jobSecret) headers['X-Finance-Job-Secret'] = body.jobSecret;
  return financeRequest<{
    ensuredOpenPeriodId?: string | null;
    results: any[];
    payableSourceOfTruth?: string;
  }>('/jobs/close-due-periods', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      includeFailedRetries: body?.includeFailedRetries,
    }),
  });
}

export function postEnsureOpenPeriod(jobSecret?: string) {
  const headers: Record<string, string> = {};
  if (jobSecret) headers['X-Finance-Job-Secret'] = jobSecret;
  return financeRequest<{
    period: any;
    bounds: { cycleType: string; periodStart: string; periodEnd: string };
    created: boolean;
  }>('/jobs/ensure-open-period', { method: 'POST', headers, body: '{}' });
}

// --- Admin: ledger / batches / summary ---

export function fetchFinanceLedger(params?: {
  periodId?: string;
  userId?: string;
  entryType?: string;
  teamLeaderId?: string;
  limit?: number;
}) {
  return financeRequest<{ entries: any[] }>(`/ledger${qs(params)}`);
}

export type LiveWalletLedgerRow = {
  id: string;
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  callId?: string | null;
  transactionType:
    | 'PURCHASE'
    | 'CALL_DEBIT'
    | 'GIFT_DEBIT'
    | 'HOST_EARN'
    | 'TL_EARN'
    | 'TARGET_SHARE_TRUEUP'
    | 'REWARD_STREAK'
    | 'REWARD_MISSION'
    | 'REWARD_MASTER_CHEST'
    | string;
  amountCoins: number;
  balanceAfter: number;
  billingMinute: number;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type LiveWalletLedgerAggregates = {
  callDebitCoins: number;
  giftDebitCoins?: number;
  hostEarnCoins: number;
  tlEarnCoins: number;
  platformRetainedCoins: number;
  purchaseCoins: number;
  rewardCoins: number;
  callDebitUsd: number;
  giftDebitUsd?: number;
  hostPayableUsd: number;
  tlPayableUsd: number;
  platformRetainedUsd: number;
  coinUsdPeg?: number;
};

export function fetchFinanceLiveLedger(params?: {
  transactionType?: string;
  userId?: string;
  callId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}) {
  return financeRequest<{
    entries: LiveWalletLedgerRow[];
    aggregates: LiveWalletLedgerAggregates;
    pagination: { limit: number; offset: number; count: number };
  }>(`/ledger/live${qs(params as Record<string, string | number | undefined | null>)}`);
}

export function fetchFinanceBatches(params?: {
  periodId?: string;
  status?: string;
  batchKind?: string;
  limit?: number;
}) {
  return financeRequest<{ batches: any[] }>(`/batches${qs(params)}`);
}

export function fetchFinanceBatch(id: string) {
  return financeRequest<{
    batch: any;
    lineItems: any[];
    events: any[];
    period: any | null;
  }>(`/batches/${encodeURIComponent(id)}`);
}

export function postAdminMarkBatchPaid(
  id: string,
  body?: { note?: string; paymentReference?: string }
) {
  return financeRequest<{ batch: any }>(
    `/batches/${encodeURIComponent(id)}/admin-mark-paid`,
    {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }
  );
}

// --- Funding / purchases (Phase 1) ---

export type CoinPurchaseRow = {
  id: string;
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  channel: 'ADMIN_MANUAL' | 'GATEWAY';
  status: string;
  amountCoins: number;
  /** Cash paid / retail (USD). Not forced to coins×peg. */
  amountUsd?: number | null;
  /** Fixed Peg snapshot at purchase ($/coin). */
  coinUsdPegAtPurchase?: number | null;
  /** amount_coins × peg at purchase. */
  pegValueUsd?: number | null;
  /** amount_usd − peg_value_usd when paid known. */
  loadMarginUsd?: number | null;
  packageId?: string | null;
  paymentProvider?: string | null;
  externalRef?: string | null;
  actorAdminId?: string | null;
  reason?: string | null;
  walletLedgerId?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

export function postAdminFundingCredit(body: {
  userId: string;
  amountCoins: number;
  reason?: string;
  amountUsd?: number;
}) {
  return financeRequest<{
    purchase: CoinPurchaseRow | null;
    walletLedgerId: string;
    coinBalance: number;
    duplicate?: boolean;
  }>('/funding/admin-credit', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchFinanceFunding(params?: {
  channel?: 'ADMIN_MANUAL' | 'GATEWAY' | '';
  userId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}) {
  return financeRequest<{ purchases: CoinPurchaseRow[]; pagination: { limit: number; offset: number; count: number } }>(
    `/funding${qs(params as Record<string, string | number | undefined | null>)}`
  );
}

export function fetchMyFunding(params?: { limit?: number; offset?: number }) {
  return financeRequest<{ purchases: CoinPurchaseRow[]; pagination: { limit: number; offset: number; count: number } }>(
    `/funding/mine${qs(params)}`
  );
}

/** Create pending GATEWAY purchase from coin_packages SKU (no wallet credit yet). */
export function postFundingCheckoutIntent(body: { packageId: string; provider?: string }) {
  return financeRequest<{
    purchase: {
      id: string;
      userId: string;
      channel: 'GATEWAY';
      status: 'pending';
      amountCoins: number;
      amountUsd: number | null;
      packageId: string;
      paymentProvider: string;
      createdAt: string;
    };
    package: {
      id: string;
      title: string;
      coins: number;
      bonusCoins: number;
      totalCoins: number;
      priceUsd: number;
    };
    checkoutToken: string;
    note?: string;
  }>('/funding/checkout-intent', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Non-production admin: pending GATEWAY intent → completeCoinPurchase(GATEWAY).
 * Disabled when NODE_ENV=production.
 */
export function postSimulateGatewayPurchase(body: { userId: string; packageId: string }) {
  return financeRequest<{
    purchase: CoinPurchaseRow | null;
    package?: { id: string; title: string; coins: number; bonusCoins: number; totalCoins: number; priceUsd: number };
    walletLedgerId: string;
    coinBalance: number;
    path: string;
  }>('/funding/simulate-gateway', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchFinanceAdminSummary(params?: { periodId?: string }) {
  return financeRequest<{
    periodId: string | null;
    platformEarnedUsd: number;
    hostAccruedUsd: number;
    tlAccruedUsd: number;
    totalDueToTeamLeadersUsd: number;
    totalDueToDirectHostsUsd: number;
    outstandingBatchCount: number;
    outstandingDueUsd: number;
    batchCountsByStatus: Record<string, number>;
  }>(`/admin/summary${qs(params)}`);
}

// --- Team leader ---

export function fetchTlFinanceBatches(params?: { periodId?: string; limit?: number }) {
  return financeRequest<{ batches: any[] }>(`/tl/batches${qs(params)}`);
}

export function fetchTlFinanceBatch(id: string) {
  return financeRequest<{
    batch: any;
    lineItems: any[];
    events: any[];
  }>(`/tl/batches/${encodeURIComponent(id)}`);
}

export function postTlConfirmReceived(id: string, body?: { note?: string }) {
  return financeRequest<{ batch: any }>(
    `/tl/batches/${encodeURIComponent(id)}/confirm-received`,
    {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }
  );
}

// --- Host (status strips amounts; period-earnings returns own breakdown) ---

export type HostSalaryStatusItem = {
  periodId: string;
  cycleType: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  periodStatus: string | null;
  batchId: string;
  batchKind: string;
  batchStatus: string;
  salaryStatus: 'pending' | 'paid';
};

export function fetchHostSalaryStatus(params?: { limit?: number }) {
  return financeRequest<{ items: HostSalaryStatusItem[] }>(
    `/host/salary-status${qs(params)}`
  );
}

export type HostPeriodEarningsItem = {
  periodId: string;
  cycleType: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  periodStatus: string | null;
  closedAt: string | null;
  salaryStatus?: 'pending' | 'paid';
  hasTrueUp: boolean;
  breakdown: {
    callEarningsCoins: number;
    callEarningsUsd: number;
    giftEarningsCoins: number;
    giftEarningsUsd: number;
    targetShareTrueUpCoins: number;
    targetShareTrueUpUsd: number;
    targetBonusCoins: number;
    targetBonusUsd: number;
    totalCoins: number;
    totalUsd: number;
  };
  lineItems?: any[];
};

export function fetchHostPeriodEarnings(params?: { periodId?: string; limit?: number }) {
  return financeRequest<{ periods: HostPeriodEarningsItem[] }>(
    `/host/period-earnings${qs(params)}`
  );
}

export function fetchAdminHostPeriodEarnings(params: {
  userId: string;
  periodId?: string;
  limit?: number;
}) {
  return financeRequest<{ userId: string; periods: HostPeriodEarningsItem[] }>(
    `/admin/host-period-earnings${qs(params)}`
  );
}

/** Always rejected with PAYOUT_PERIOD_END_ONLY — settlement batches are the only cash-out path. */
export function postManualPayout(body?: Record<string, unknown>) {
  return financeRequest<never>(`/manual-payouts`, {
    method: 'POST',
    body: JSON.stringify(body || {}),
  });
}
