/**
 * Bundle the Vercel API router into a single CommonJS function file.
 * Avoids [...path] routing quirks and cold-start MODULE_NOT_FOUND for _lib handlers.
 */
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

await esbuild.build({
  entryPoints: [path.join(root, 'api/_router-entry.ts')],
  outfile: path.join(root, 'api/router.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  // Keep heavy / optional packages external (resolved from node_modules on Vercel).
  external: [
    '@aws-sdk/client-s3',
    '@aws-sdk/s3-request-presigner',
    'livekit-server-sdk',
    'dotenv',
    'bcryptjs',
  ],
  logLevel: 'info',
});

console.log('[bundle-vercel-api] wrote api/router.js');
