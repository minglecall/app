# Financial Module — Phase 10 verification matrix

Automated pure tests: `npm run test:finance`  
Manual / integration checks noted where DB/runtime required.

| # | Scenario | Evidence | Result |
|---|----------|----------|--------|
| 1 | Weekly + custom close time closes once | `periodBounds` unit: Mon→Mon + `computeCloseScheduledAt`; `closePeriod` returns `noop` when `status=closed` | **PASS** (unit + code path) |
| 2 | Monthly 1st→1st boundaries | `getCurrentPeriodBounds('monthly')` unit | **PASS** |
| 3 | Two TLs → two batches | `buildSettlementBatches` unit | **PASS** |
| 4 | Direct host paid on `admin_paid` | `markBatchAdminPaid` sets host lines paid when `batch_kind=direct_host` | **PASS** (code review) |
| 5 | Agency host paid on `tl_confirmed` | `markBatchTlConfirmed` → `markHostLinesPaid` | **PASS** (code review) |
| 6 | Target bonus in same batch | `target_bonus` line in TL bundle unit | **PASS** |
| 7 | Second close no-op | `closePeriod` early return `status: noop` when already closed | **PASS** (code review) |
| 8 | Manual payout rejected | `evaluateManualPayoutPolicy` + `POST /manual-payouts` | **PASS** (unit) |
| 9 | Analytics 7/15/30/365 | `buildDateRange` UTC presets unit | **PASS** |
| 10 | Config change does not alter closed snapshots | Close freezes `config_snapshot` with `frozen_at`; resume with existing batches keeps prior snapshot | **PASS** (code review) |

## Hardening delivered (Phase 10)

- DELETE blocked on `settlement_batches` / `settlement_line_items` (triggers)
- Host RLS no longer SELECT line-item amounts; salary-status API remains strip-only
- Status transitions rollback if `settlement_events` insert fails
- Admin cancel + REVERSAL ledger stub endpoints
- Offset pagination on periods / ledger / batches / TL batches
- Production job endpoints require `FINANCE_JOB_SECRET` (not admin JWT alone); Bearer no longer accepted as job secret

## Residual risks / follow-ups

1. Status + event still not a single DB transaction (rollback is best-effort). Prefer RPC/transaction later.
2. REVERSAL does not auto-adjust settlement batches — ops must cancel + reverse deliberately.
3. Open-period provisional `config_snapshot` is not refreshed mid-period (freeze-at-close is intentional).
4. Full end-to-end close against live Supabase not automated in CI (no finance integration tests yet).
5. Apply schema trigger/RLS drops on remote DB if not yet deployed from `supabase_schema.sql`.
6. `SETTLEMENT_PAID` ledger entry type remains unused (optional completeness).
