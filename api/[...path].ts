/**
 * Catch-all for remaining /api/* routes on Vercel (Express app).
 * Prefer dedicated lightweight handlers (e.g. api/admin/infra-config.ts) for critical admin saves.
 */
export { default } from '../server';
