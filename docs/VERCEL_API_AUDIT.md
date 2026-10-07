# Vercel API audit (production)

## Architecture

| Layer | Role |
|-------|------|
| Local `npm run dev` | Full Express (`server.ts` + `server/routes/*`) |
| Vercel production | SPA + **CommonJS** serverless under `api/` (Hobby ≤12 functions) |

**Critical rule:** `api/package.json` is `"type":"commonjs"`. Do **not** use TypeScript `export default` route entries that pull ESM-only graphs — that caused `FUNCTION_INVOCATION_FAILED`. Prefer `api/router.js` + `api/_lib/cjs/*.js`.

## Standalone functions (8 + router)

| File | Path |
|------|------|
| `api/health.js` | `/api/health` |
| `api/ping.js` | `/api/ping` |
| `api/r2-test.js` | `/api/r2-test` |
| `api/storage/test-connection.js` | `/api/storage/test-connection` |
| `api/livekit/config.js` | `/api/livekit/config` |
| `api/livekit/token.js` | `/api/livekit/token` |
| `api/admin/create-team-leader.js` | `/api/admin/create-team-leader` |
| `api/users.js` | `/api/users` |
| `api/router.js` | catch-all via rewrite |

`vercel-build` also runs esbuild to produce `api/_lib/cjs/financeLib.cjs` from `api/_lib/financeBundleEntry.ts`.
`api/router.js` includes `supabase_schema.sql` via `vercel.json` `includeFiles`.

## Router modules (`api/_lib/cjs/`)

| Module | Coverage |
|--------|----------|
| `authRoutes.js` | send-otp, verify-otp, register-bootstrap, login-password, reset/update-password |
| `teamleaderRoutes.js` | creators, stats, ban/unban/delete-creator |
| `coreRoutes.js` | presence, messages, calls, gifts, users/sync-all, users/me/delete, supabase/* |
| `v1Routes.js` | matches, favorites, friends, blocks, feed, reviews, reports |
| `financeRoutes.js` | `/api/v1/finance/*` via `financeLib.cjs` (periods, ledger, batches, funding, jobs, host/TL) |
| `storageRoutes.js` | storage/config, media proxy GET, presigned-url, upload (SigV4, no AWS SDK) |
| `adminRoutes.js` | infra-config, delete-user, CMS CRUD/active/DELETE, schema GET, granular-reset (gated), spectator-token, issue-warning |
| `appExtrasRoutes.js` | setup status/auth/tests (save blocked), livekit/status, creator/*, rewards/* |
| `granularResetDb.js` | DB-only wipe helpers for admin granular-reset |
| `helpers.js` | shared auth, OTP, mail, password policy |

## Intentionally limited on Vercel

- **Setup save** (`POST /api/setup/save-all`) — cannot write `.env`; configure Vercel Environment Variables + redeploy. Connectivity **tests** work.
- **Granular reset** — DB-only; requires `ALLOW_FACTORY_RESET=true`. No in-memory/WebSocket/R2 wipe.
- **Issue-warning / terminate-call** — no custom WebSocket bus; warning may persist a moderation note only.
- **Signaling** — Supabase Realtime only (no `/ws`).

## Orphaned TypeScript drafts

`api/_lib/handlers/**/*.ts` are **not** mounted on Vercel. They are references for future ports. Do not point rewrites at them.

## Signaling

Realtime uses **Supabase Realtime** in production (no custom `/ws` on Vercel).
