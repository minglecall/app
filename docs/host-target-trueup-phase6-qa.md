# HOST TARGET TRUE-UP — Phase 6 QA

Automated matrix: `shared/finance/phase6.trueup.qa.test.ts`  
Run: `npm run test:finance`

Locked rules verified via pure planners (`planHostShareTrueUps`, `computeCallMinuteSplit`, `computeHostShareTrueUpCoins`, `buildSettlementBatches`, `getHostPeriodTargetProgress`) — same helpers used by live burn + `closePeriod`.

| # | Scenario | Evidence | Result |
|---|----------|----------|--------|
| 1 | Host never hits target → only base HOST_EARN; true-up 0; no bronze+ tier bonus | `planHostShareTrueUps` with hours/coins below Creator Ops bronze → `trueUpCoins=0`; `hasMetCreatorPeriodTarget` false | **PASS** |
| 2 | Host hits target on last day → true-up ≈ (target%−base%)×period call burn; earlier minutes not rewritten | Period burn 1200 @ 30/40 → true-up 120; live split still BASE when `targetMet`; true-up `call_id=target_share_trueup:{periodId}` | **PASS** |
| 3 | TL earnings = static % of burns; no TL true-up line | Live TL coins identical with/without `targetMet`; settlement has `tl_commission` only (no TL `target_share_trueup`) | **PASS** |
| 4 | Gift-heavy host: gift HOST_EARN unchanged; true-up ignores gift volume | Gift split 500→350 host; true-up from CALL burn 1000 only (=100); gift on separate settlement component | **PASS** |
| 5 | Override host: no share true-up | `shouldSkipHostShareTrueUp(50)`; plan `skippedOverride` → `trueUpCoins=0` | **PASS** |
| 6 | Base 30 / target 40 / burn 120 — hand-calc matches ledger + settlement | Live 36/12/72; true-up 12; direct_host salary 48 coins / $0.48 @ peg 0.01 | **PASS** |
| 7 | Second close: no duplicate true-up | `alreadyTrueUpCoins>0` → `skippedAlreadyPosted`, `trueUpCoins=0` | **PASS** |
| 8 | Progress bar 100% when metrics cross bronze; admin + host agree | Same `getHostPeriodTargetProgress` inputs → `pctHours/pctCoins=100`, `targetMet` equal | **PASS** |
| 9 | Finance “amount to pay host” = (call + true-up + bonus) under peg | Settlement `totalHostSalaryCoins` + `totalDueUsd` = call×peg + true-up×peg + explicit bonus USD | **PASS** |
| 10 | New period after close: live burns again at base % | `resolveCallHostSharePercent` / `computeCallMinuteSplit` always BASE even if `targetMet` | **PASS** |

## Suite status

- Phase 6 matrix: **10/10 PASS**
- Full `npm run test:finance`: includes Phase 6 + Phase 7 + Phase 10 — run green at Phase 6 exit

## Residuals (not failures)

1. End-to-end live DB close against Supabase is not in CI; wallet unique index + plan skip cover double-post mathematically.
2. Progress **preview** coins stay `null` until UI supplies period CALL burn (gate/hours/coins already match close).
3. Remote schema must include `TARGET_SHARE_TRUEUP` / `target_share_trueup` (see `supabase_schema.sql`) if not yet applied.
