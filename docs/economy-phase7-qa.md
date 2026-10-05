# Fixed Peg / Economy — Phase 7 QA & hardening

Automated pure tests: `npm run test:finance` (includes `shared/finance/phase7.verification.test.ts`).

| # | Scenario | Evidence | Result |
|---|----------|----------|--------|
| 1 | Economy: change peg, burn 120/80, host base/target %, TL %, gift % → persists and loads | `AdminEconomyConfigHub` sole writer; `updateSystemConfigs` maps camel→snake including `female_host_target_share_percent` + gift shares; guaranteed retry cols include gift % + peg; resolve helpers unit | **PASS** (code + unit) |
| 2 | Non-friend call minute: splits match Economy; USD = coins×peg on Finance live ledger | `call.routes` live `resolveEconomyBurnRates` + `computeCallMinuteSplit`; Finance KPIs use `coinsToUsd` + peg; Phase 7 unit split 120→48/12/60 @ 40/10 | **PASS** (code + unit) |
| 3 | Friend call minute: friend burn rate | Burn path selects friend rate; unit 80→32/8/40 | **PASS** |
| 4 | Host meeting period target → target host % | `resolveCallHostSharePercent` + `creator_metrics` gate in burn path; unit target 50% | **PASS** (when Phase 2 target enabled) |
| 5 | Gift send: coinCost debit; host/TL credits; catalog prices intact | `appendGiftEarnLedger` GIFT_DEBIT + HOST/TL; shares from config; catalog SKU-only in Gifts tab; unit split | **PASS** |
| 6 | Package purchase + admin credit: coins; amount_usd; margin vs peg | `completeCoinPurchase` snapshots `coin_usd_peg_at_purchase`, `peg_value_usd`, `load_margin_usd`; Funding UI shows paid/peg/margin; unit margin | **PASS** (server path); see residual #1 for client store checkout |
| 7 | Period close: HOST/TL/PLATFORM under peg; snapshot frozen | `freezeFinanceConfigSnapshot` + `closePeriod` PLATFORM = retained×peg (+ optional load_margin); unit snapshot keys | **PASS** |
| 8 | No hardcoded 0.01/0.008/120/80/40/10 in **logic** paths | Server burn/finance use shared defaults only; QA replaced logic-adjacent UI fallbacks with `DEFAULT_*` constants; display toasts may still `?? DEFAULT` | **PASS** (logic); display leftovers use appDefaults-aligned constants where touched |
| 9 | No duplicate economy editors outside Economy hub | Setup Wizard Step 6 RO “Configured in Economy”; Gifts tab SKU-only; taxonomy FX ≠ peg disclaimer | **PASS** |
| 10 | Store currency AED display still works | `taxonomies` AED `rateFromUsd: 3.6725`; `CoinStoreModal` `packageDisplayPrices` / `checkoutPayLabel`; unit 4.99→18.33 | **PASS** (display only) |

## Hardening delivered (Phase 7)

- Guaranteed `updateSystemConfigs` retry payload includes gift share columns + `enable_virtual_gifts` so gift % persist when schema is partial.
- Logic-adjacent display fallbacks (`analyticsHelper`, AdminDashboard SKU mins, CoinStore burn mins, Silent Monitor runway) use `DEFAULT_COIN_BURN_*` instead of bare literals.
- Phase 7 verification unit suite covering matrix items 1–8 + 10 (pure).

## Residual risks / follow-ups

1. **Client `buyCoinPackage` (AppContext)** still simulates local credit for Coin Store checkout; production coins + peg margin require server `completeCoinPurchase` / checkout-intent wiring. Admin credit / funding paths that call the server are fine.
2. **Remote DB schema lag**: columns `female_host_target_share_percent`, `GIFT_DEBIT` on `wallet_ledger` CHECK, and `coin_purchases` peg/margin columns must match `supabase_schema.sql`. Apply on remote if not yet deployed (MCP apply may time out).
3. **Live Finance ledger aggregates** are page/limit scoped — KPIs are approximate until full-window aggregation exists.
4. **Gift HOST/TL** still flow into settlement salary lines by design; rewards remain excluded — product confirmation if gifts should be settlement-payable.
5. **Setup Wizard** still holds unused economy form defaults in local state; they are not persisted (RO banner only) — low risk of operator confusion.
6. **Optimistic gift UI** can briefly disagree with server until `/api/gifts/send` response; authoritative balance is server/DB.
7. **UI display fallbacks** elsewhere (`?? 120` / `?? 80` in profile/discovery copy) remain for UX when settings not loaded; they are not burn/settlement logic. Prefer importing `DEFAULT_*` when those files are next touched.
8. **Close status + event** still best-effort (Phase 10 residual); not re-opened here.
9. **End-to-end live burn/gift/close** against Supabase is not automated in CI — matrix items 2–7 beyond pure math rely on code review + manual smoke.
