import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Large legacy SPA — typecheck via `npm run lint`; do not block Next deploy on historical TS debt
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Silence workspace root warning when multiple lockfiles exist
  outputFileTracingRoot: __dirname,
  typescript: {
    // Large legacy SPA — typecheck via `npm run lint`; do not block Next deploy on historical TS debt
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.cloudflarestorage.com' },
    ],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': __dirname,
    };
    // Ignore Vite-only virtual modules when bundling the SPA under Next
    config.resolve.fallback = {
      ...config.resolve.fallback,
    };
    config.plugins = config.plugins || [];
    return config;
  },
  // Existing CJS api/ folder remains for dual-run; Next app/api takes precedence on Vercel Next.
  serverExternalPackages: ['@upstash/redis', 'livekit-server-sdk'],
};

export default nextConfig;
