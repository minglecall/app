/**
 * Vercel serverless entry — re-exports the Express app from server.ts.
 * Static SPA assets are served from /dist via vercel.json outputDirectory.
 * REST /api/* is handled here; WebSocket /ws is not supported on Vercel.
 */
export { default } from '../server';
