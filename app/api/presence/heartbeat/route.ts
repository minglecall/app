import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, createServiceClient } from '../../../../lib/nextAuth';
import {
  isRedisConfigured,
  setPresence,
  deletePresence,
  mgetPresence,
  type PresenceStatus,
} from '../../../../lib/redis';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.ok === false) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const statusRaw = String(body?.status || 'online').toLowerCase();
  const writeStatus: PresenceStatus =
    statusRaw === 'offline'
      ? 'offline'
      : statusRaw === 'busy' || statusRaw === 'in_call'
        ? 'busy'
        : 'online';
  const durable = Boolean(body?.durable) || writeStatus === 'offline';

  if (isRedisConfigured()) {
    if (writeStatus === 'offline') await deletePresence(auth.profileId);
    else await setPresence(auth.profileId, writeStatus);
  }

  if (durable || !isRedisConfigured()) {
    const client = createServiceClient();
    if (client) {
      const nowIso = new Date().toISOString();
      await client
        .from('profiles')
        .update({
          online_status: writeStatus,
          last_seen_at: nowIso,
          updated_at: nowIso,
        } as any)
        .eq('id', auth.profileId);
    }
  }

  const peerIds = Array.isArray(body?.peerIds)
    ? body.peerIds.map((id: unknown) => String(id || '').trim()).filter(Boolean).slice(0, 200)
    : [];
  let presence: Record<string, PresenceStatus> = {};
  if (isRedisConfigured() && peerIds.length) {
    presence = await mgetPresence(peerIds);
  }
  presence[auth.profileId] = writeStatus;

  return NextResponse.json({
    success: true,
    userId: auth.profileId,
    status: writeStatus,
    presence,
    redis: isRedisConfigured(),
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
