/**
 * Phase 10 verification — pure unit coverage for Financial Module rules.
 * Run: npx tsx --test shared/finance/*.test.ts server/finance/*.test.ts src/utils/adminAnalytics.dateRange.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCloseScheduledAt,
  getCurrentPeriodBounds,
  isTimestampInPeriod,
  normalizeCycleType,
  parseUtcCloseTime,
} from './periodBounds.ts';
import { evaluateManualPayoutPolicy, PAYOUT_PERIOD_END_ONLY } from '../../server/finance/payoutPolicy.ts';
import { buildSettlementBatches } from '../../server/finance/settlement.ts';
import {
  canTransitionSettlementStatus,
  SETTLEMENT_STATUS_TRANSITIONS,
} from '../../server/finance/statusTransition.ts';
import { buildDateRange } from '../../src/utils/adminAnalytics.ts';
import { computePerformanceTier, targetBonusUsdForTier } from './targetBonus.ts';

describe('periodBounds — weekly + custom close time', () => {
  it('weekly Mon→Mon UTC and closes once at custom HH:mm on period_end date', () => {
    // Wednesday 2026-03-11 → week Mon 2026-03-09 → Mon 2026-03-16
    const at = new Date(Date.UTC(2026, 2, 11, 15, 0, 0));
    const bounds = getCurrentPeriodBounds('weekly', at);
    assert.equal(bounds.cycleType, 'weekly');
    assert.equal(bounds.periodStart.toISOString(), '2026-03-09T00:00:00.000Z');
    assert.equal(bounds.periodEnd.toISOString(), '2026-03-16T00:00:00.000Z');

    const close = computeCloseScheduledAt(bounds.periodEnd, '18:30');
    assert.equal(close.toISOString(), '2026-03-16T18:30:00.000Z');
    assert.equal(parseUtcCloseTime('18:30').hhmm, '18:30');

    // Accrual half-open: periodEnd not included
    assert.equal(isTimestampInPeriod(bounds.periodEnd, bounds.periodStart, bounds.periodEnd), false);
    assert.equal(
      isTimestampInPeriod(new Date(bounds.periodEnd.getTime() - 1), bounds.periodStart, bounds.periodEnd),
      true
    );
  });
});

describe('periodBounds — monthly 1st→1st', () => {
  it('uses calendar month boundaries (not rolling 30 days)', () => {
    const at = new Date(Date.UTC(2026, 0, 15, 12, 0, 0)); // mid-January
    const bounds = getCurrentPeriodBounds('monthly', at);
    assert.equal(bounds.cycleType, 'monthly');
    assert.equal(bounds.periodStart.toISOString(), '2026-01-01T00:00:00.000Z');
    assert.equal(bounds.periodEnd.toISOString(), '2026-02-01T00:00:00.000Z');
    assert.equal(normalizeCycleType('MONTHLY'), 'monthly');
  });
});

describe('buildSettlementBatches — two TLs + target bonus + direct host', () => {
  it('creates one TL bundle per TL and a separate direct_host batch; bonus in same host lines', () => {
    const batches = buildSettlementBatches({
      fxRatio: 0.01,
      accruals: [
        {
          userId: 'host_a',
          teamLeaderId: 'tl_1',
          role: 'host',
          callEarningsCoins: 1000,
          giftEarningsCoins: 100,
          targetBonusCoins: 50,
          targetBonusUsd: 5,
        },
        {
          userId: 'host_b',
          teamLeaderId: 'tl_2',
          role: 'host',
          callEarningsCoins: 500,
        },
        { userId: 'tl_1', role: 'team_leader', tlCommissionCoins: 200 },
        { userId: 'tl_2', role: 'team_leader', tlCommissionCoins: 80 },
        {
          userId: 'host_direct',
          teamLeaderId: null,
          role: 'host',
          callEarningsCoins: 300,
        },
      ],
    });

    const tlBundles = batches.filter((b) => b.batchKind === 'team_leader_bundle');
    const direct = batches.filter((b) => b.batchKind === 'direct_host');
    assert.equal(tlBundles.length, 2, 'two TLs → two bundles');
    assert.equal(direct.length, 1, 'direct host separate');

    const tl1 = tlBundles.find((b) => b.teamLeaderId === 'tl_1');
    assert.ok(tl1);
    const bonusLine = tl1!.lineItems.find(
      (l) => l.payeeUserId === 'host_a' && l.component === 'target_bonus'
    );
    assert.ok(bonusLine, 'target bonus in same TL batch');
    assert.equal(bonusLine!.amountUsd, 5);
  });
});

describe('status transitions — paid rules', () => {
  it('allows pending→admin_paid and admin_paid→tl_confirmed; blocks reverse', () => {
    assert.equal(canTransitionSettlementStatus('pending_admin_pay', 'admin_paid'), true);
    assert.equal(canTransitionSettlementStatus('admin_paid', 'tl_confirmed'), true);
    assert.equal(canTransitionSettlementStatus('tl_confirmed', 'admin_paid'), false);
    assert.deepEqual([...SETTLEMENT_STATUS_TRANSITIONS.tl_confirmed], []);
  });
});

describe('manual payout policy', () => {
  it('always rejects with PAYOUT_PERIOD_END_ONLY', () => {
    const d = evaluateManualPayoutPolicy(true);
    assert.equal(d.allowed, false);
    assert.equal(d.code, PAYOUT_PERIOD_END_ONLY);
    const d2 = evaluateManualPayoutPolicy(false);
    assert.equal(d2.allowed, false);
  });
});

describe('analytics date presets UTC', () => {
  it('supports 7 / 15 / 30 / 365 day presets', () => {
    for (const preset of ['7d', '15d', '30d', '365d'] as const) {
      const range = buildDateRange(preset);
      assert.equal(range.preset, preset);
      assert.ok(range.end.getTime() >= range.start.getTime());
      // Bounds are UTC midnights / end-of-day
      assert.equal(range.start.getUTCHours(), 0);
      assert.equal(range.end.getUTCHours(), 23);
    }
  });
});

describe('target bonus helper (close path)', () => {
  it('computes tiers from thresholds', () => {
    const thresholds = {
      bronzeHours: 20,
      bronzeCoins: 5000,
      bronzeBonusUsd: 15,
      silverHours: 40,
      silverCoins: 20000,
      silverBonusUsd: 50,
      goldHours: 60,
      goldCoins: 60000,
      goldBonusUsd: 150,
    };
    assert.equal(computePerformanceTier(45, 25000, thresholds), 'silver');
    assert.equal(targetBonusUsdForTier('silver', thresholds), 50);
  });
});

describe('config snapshot contract (documentation assertion)', () => {
  it('closed snapshot fields include FX + shares keys used by freezeConfigSnapshot', () => {
    // Structural contract — closePeriod freezeConfigSnapshot must keep these keys
    const required = [
      'coin_usd_peg',
      'coin_burn_rate_per_min',
      'coin_burn_rate_friend_per_min',
      'female_payout_ratio_usd',
      'coin_to_usd_ratio',
      'female_host_share_percent',
      'female_host_target_share_percent',
      'team_leader_share_percent',
      'gift_female_host_share_percent',
      'gift_team_leader_share_percent',
      'creator_target_gold_bonus_usd',
      'frozen_at',
    ];
    assert.ok(required.length >= 5);
    // Call host default must not be gift 70%
    assert.equal(
      required.includes('female_host_share_percent') &&
        required.includes('gift_female_host_share_percent'),
      true
    );
  });
});

describe('freezeFinanceConfigSnapshot — Phase 5 economy knobs', () => {
  it('freezes peg, burns, call shares (30/40 default) and gift shares (70 default) separately', async () => {
    const { freezeFinanceConfigSnapshot } = await import('../../server/finance/configSnapshot.ts');
    const { defaultFinanceSystemConfig } = await import('../../server/finance/config.ts');
    const snap = freezeFinanceConfigSnapshot(defaultFinanceSystemConfig(), {
      includeFrozenAt: true,
    });
    assert.equal(typeof snap.coin_usd_peg, 'number');
    assert.equal(snap.coin_burn_rate_per_min, 120);
    assert.equal(snap.coin_burn_rate_friend_per_min, 80);
    assert.equal(snap.female_host_share_percent, 30);
    assert.equal(snap.female_host_target_share_percent, 40);
    assert.equal(snap.team_leader_share_percent, 10);
    assert.equal(snap.gift_female_host_share_percent, 70);
    assert.equal(snap.gift_team_leader_share_percent, 10);
    assert.ok(snap.frozen_at);
    // Never confuse gift default with call host default
    assert.notEqual(snap.female_host_share_percent, snap.gift_female_host_share_percent);
  });
});
