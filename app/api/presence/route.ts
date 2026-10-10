import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/nextAuth';
import { isRedisConfigured, mgetPresence } from '../../../lib/redis';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.ok === false) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }
  const idsParam = req.nextUrl.searchParams.get('ids') || '';
  const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 200);
  if (!isRedisConfigured() || !ids.length) {
    return NextResponse.json({
      success: true,
      presence: {},
      source: isRedisConfigured() ? 'redis_empty_ids' : 'redis_unconfigured',
    });
  }
  const presence = await mgetPresence(ids);
  return NextResponse.json({ success: true, presence, source: 'redis' });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
