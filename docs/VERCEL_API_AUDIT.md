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

## Router modules (`api/_lib/cjs/`)

| Module | Coverage |
|--------|----------|
| `authRoutes.js` | send-otp, verify-otp, register-bootstrap, login-password, reset/update-password |
| `teamleaderRoutes.js` | creators, stats, ban/unban/delete-creator |
| `coreRoutes.js` | presence, messages, calls, gifts, users/sync-all, users/me/delete, supabase/* |
| `v1Routes.js` | matches, favorites, friends, blocks, feed, reviews, reports |
| `storageRoutes.js` | storage/config, storage/presigned-url (SigV4, no AWS SDK) |
| `adminRoutes.js` | infra-config, delete-user, CMS, overrides, active-calls, terminate |
| `appExtrasRoutes.js` | creator/*, rewards/* (rewards claims limited without full Express helpers) |
| `helpers.js` | shared auth, OTP, mail, password policy |

## Orphaned TypeScript drafts

`api/_lib/handlers/**/*.ts` are **not** mounted on Vercel. They are references for future ports. Do not point rewrites at them.

## Not on Vercel (local Express only / 501)

- Full finance (`/api/v1/finance/*`)
- Setup wizard (`/api/setup/*`)
- Factory / granular reset (admin destructive ops)
- Full rewards claim ledger logic (soft-fail / limited)

## Signaling

Realtime uses **Supabase Realtime** in production (no custom `/ws` on Vercel).
