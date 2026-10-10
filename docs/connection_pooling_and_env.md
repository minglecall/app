# Connection Pooling & Environment (High-Concurrency)

## Supabase connection pooling

- Prefer the **Transaction** pooler (port `6543`, PgBouncer) for any direct `postgres` / SQL driver connections from serverless or workers.
- Next.js Route Handlers and the existing `@supabase/supabase-js` service-role client use the **HTTP/PostgREST** API — they do **not** open a Postgres session per request. Keep using that for API handlers unless a worker needs raw SQL.
- If you add a `pg` / `postgres.js` client, set `DATABASE_URL` (or `SUPABASE_DB_URL`) to the pooler URL, not the direct `5432` session URL, to avoid exhausting connection limits under Vercel concurrency.

## Vercel / Next.js environment variables

| Variable | Client? | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` or `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `VITE_SUPABASE_ANON_KEY` | Yes | Anon key (RLS-protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | **No** | Server-only admin client |
| `UPSTASH_REDIS_REST_URL` | **No** | Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | **No** | Redis REST token |
| `LIVEKIT_URL` | **No** (config may expose URL) | LiveKit WebSocket URL |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | **No** | Token minting |
| `R2_*` / SMTP / payment secrets | **No** | Server-only |

During the Vite → Next migration, both `VITE_*` and `NEXT_PUBLIC_*` names are accepted for Supabase public config.

## Presence durability rule

- Routine heartbeats update **Redis only** (`presence:{userId}`, TTL 60–90s).
- Write `profiles.online_status` / `profiles.last_seen_at` only on login, logout, or significant status transitions — never on every heartbeat tick.
