# Backend full audit — inventory & findings

Generated for production hardening (Vercel CJS + Express local).

## 1. Complete file inventory (audit scope)

### Entry / config
- `server.ts` — Express monolith + inline routes + `/ws`
- `package.json`, `api/package.json` (`"type":"commonjs"`), `vercel.json`
- `supabase_schema.sql` — canonical DB (incl. `burn_call_coins_atomic`)

### Express route modules (`server/routes/`)
| File | Mount |
|------|--------|
| `auth.routes.ts` | `/api/auth` |
| `storage.routes.ts` | `/api/storage` |
| `presence.routes.ts` | `/api/presence`, `/api/creator` |
| `livekit.routes.ts` | `/api/livekit`, admin LiveKit |
| `admin.routes.ts` | `/api/admin`, `/api/users` admin |
| `cms.routes.ts` | `/api/admin/cms/*` |
| `call.routes.ts` | `/api/calls` (atomic burn) |
| `rewards.routes.ts` | `/api/rewards` |
| `matches.routes.ts` | `/api/v1/matches` |
| `favorites.routes.ts` | `/api/v1/favorites` |
| `blocks.routes.ts` | `/api/v1/blocks` |
| `friends.routes.ts` | `/api/v1/friends` |
| `reports.routes.ts` | `/api/v1/reports`, admin reports |
| `reviews.routes.ts` | `/api/v1/reviews` |
| `feed.routes.ts` | `/api/v1/feed` |
| `messages.routes.ts` | `/api/messages` |
| `finance.routes.ts` | `/api/v1/finance` (**Express-only**) |
| `index.ts` | barrel |

### Express middleware / services
- `server/middleware/auth.ts`, `rateLimit.ts`
- `server/supabaseAdmin.ts`, `r2Storage.ts`, `emailService.ts`, `userHardDelete.ts`, `schemaLoader.ts`, `runtimeTypes.ts`
- `server/finance/*` (ledger, settlement, period, burn config, etc.)
- `shared/finance/*`, `shared/passwordPolicy.ts`

### Vercel production entries (mounted)
- Standalone: `api/health.js`, `ping.js`, `r2-test.js`, `storage/test-connection.js`, `livekit/config.js`, `livekit/token.js`, `admin/create-team-leader.js`, `users.js`
- Catch-all: `api/router.js` → `api/_lib/cjs/{helpers,authRoutes,teamleaderRoutes,coreRoutes,v1Routes,storageRoutes,adminRoutes,appExtrasRoutes}.js`

### Orphaned (not mounted on Vercel)
- `api/_lib/handlers/**/*.ts`, `vercelAuth.ts`, `authHelpers.ts`, `mail.ts`, `otpDb.ts` (drafts; CJS is source of truth)

---

## 2. Critical findings (severity)

### P0 — fixed this pass
1. **Vercel `POST /api/calls/burn` was non-atomic and trusted client coin amounts**  
   → Rewrote to reject client amounts, derive rates from `system_configs`, resolve call from `call_logs`, call `burn_call_coins_atomic` RPC (row lock + ledger + idempotency).
2. **Vercel `POST /api/gifts/send` race + client cost trust**  
   → Catalog cost preferred; conditional debit `.gte('coin_balance', cost)`; ledger writes; host share from config.
3. **`supabaseAdmin` fell back to anon key when service role missing**  
   → Removed anon fallback; warn if JWT is not `service_role`.
4. **Vercel CJS `createServiceClient` now refuses non-`service_role` JWTs.**

### P0 — prior pass (still required: redeploy)
5. TypeScript/ESM catch-all under `api/package.json` type commonjs → `FUNCTION_INVOCATION_FAILED`  
   → Replaced with `api/router.js` CJS modules (auth, TL, users, presence, messages, v1, storage, admin, creator).

### P1 — known gaps (document, do not pretend fixed)
| Area | Status on Vercel |
|------|------------------|
| `/api/v1/finance/*` | Not ported (Express-only) |
| `/api/setup/*` | Local installer only |
| Full rewards claim ledger | Limited soft path |
| LiveKit webhooks | Not present (tokens only) |
| In-memory `activeCalls` / `/ws` | Express-only; prod uses Supabase Realtime + `call_logs` |
| `api/_lib/handlers/**` TS | Orphaned — do not mount under CJS package type |

### P2 — RLS note
Schema has broad `authenticated update profiles` policies. Backend must use **service role** for authoritative coin mutations; client must never be trusted for balances. Atomic RPC is the correct burn path.

---

## 3. Subsystem status matrix

| Subsystem | Express local | Vercel prod |
|-----------|---------------|-------------|
| Auth / signup / roles | Full | CJS auth + create-team-leader + users |
| Supabase clients | `supabaseAdmin` (service) | `helpers.createServiceClient` (service only) |
| Coin burn | `burn_call_coins_atomic` via call.routes | Same RPC via coreRoutes |
| Gifts | Express gifts/send | Hardened CJS gifts/send |
| LiveKit token/config | livekit.routes | Standalone CJS |
| Chat / messages | messages.routes | coreRoutes |
| Discovery / matches | matches + v1 | v1Routes |
| Heartbeat / presence | presence.routes | coreRoutes |
| Finance / payouts | finance.routes + server/finance | **Not on Vercel** |

---

## 4. Deploy checklist
1. Commit all `api/**` CJS changes + `server/supabaseAdmin.ts`
2. Redeploy Vercel (Production env must have real `SUPABASE_SERVICE_ROLE_KEY`, LiveKit, R2)
3. Verify: `/api/health` → `router: cjs`; create TL; signup; `POST /api/calls/burn` with only `{callId,billingMinute}`
4. Confirm burn with client `coins` field returns `CLIENT_AMOUNTS_FORBIDDEN`
