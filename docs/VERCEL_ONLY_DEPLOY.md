# Vercel-only deploy (minglecall.com)

## Model

- **Vercel** serves the Vite SPA + a small set of serverless functions (Hobby-safe; ≤12).
- Isolated probes (plain CommonJS, crash-isolated): `api/health.js`, `api/ping.js`, `api/r2-test.js`, `api/livekit/config.js`, `api/livekit/token.js`, `api/admin/create-team-leader.js`, `api/users.js`.
- Other `/api/*` routes: rewrite → `api/router.js` (CommonJS modules in `api/_lib/cjs/` — auth, teamleader, presence, messages, calls, gifts, v1 social, storage, admin, creator, rewards).
- See `docs/VERCEL_API_AUDIT.md` for full coverage and orphaned TS handlers.
- Public URLs stay `/api/...` (same-origin). Local `npm run dev` still uses Express + `/ws`.
- **Supabase** is Auth + DB + Realtime (call/presence signaling).
- **Do not** run a separate Express/WebSocket host for production.
- **Do not** import Express/`server.ts` into Vercel API entries (causes `FUNCTION_INVOCATION_FAILED`).

## Required Production env (Vercel → Settings → Environment Variables)

| Variable | Notes |
|----------|--------|
| `VITE_SUPABASE_URL` | Public |
| `VITE_SUPABASE_ANON_KEY` | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | Media |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Calls |
| `SMTP_*` and/or `RESEND_API_KEY` | OTP email |

**Leave unset:** `VITE_API_BASE_URL`, `VITE_WS_URL` (same-origin `/api`).

## DNS

1. Vercel → Domains → add `minglecall.com` and `www`.
2. At the registrar, use Vercel’s A/CNAME (not Spaceship parking).
3. Verify: `https://minglecall.com/api/health` returns JSON with `"mode":"vercel"`.

## Database

Apply `/supabase_schema.sql` (includes `auth_otps`, `auth_pending_signups`) in the Supabase SQL editor if not already applied. Enable Realtime for relevant tables/channels as needed for presence/broadcast.

## Local vs production

- `npm run dev` — Express + `/ws` for developers.
- Production build — Realtime signaling (`shouldUseRealtimeSignaling()` when `PROD`).

## Admin check

Admin → **API Health** probes `/api/health`, `/api/admin/api-health`, auth/storage/LiveKit routes, and Supabase Realtime (not `/ws`).
