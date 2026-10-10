import { NextResponse } from 'next/server';
import { isRedisConfigured } from '../../../lib/redis';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    success: true,
    ok: true,
    runtime: 'next',
    redis: isRedisConfigured(),
    ts: new Date().toISOString(),
  });
}
