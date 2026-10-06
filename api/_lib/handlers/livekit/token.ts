/**
 * LiveKit token minting for Vercel — uses LIVEKIT_* from server env.
 * AccessToken is dynamically imported so the catch-all cold-start does not
 * require livekit-server-sdk evaluation for /api/health and /api/r2-test.
 */
import {
  sendJson,
  readJsonBody,
  requireAuthFromBearer,
  getLiveKitEnv,
  createServiceClient,
  type VercelReq,
  type VercelRes,
} from '../../vercelAuth';

export default async function handler(req: VercelReq, res: VercelRes) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    const auth = await requireAuthFromBearer(req);
    if (auth.ok === false) {
      return sendJson(res, auth.status, { error: auth.error?.message || 'Unauthorized', ...auth.error });
    }

    const body = await readJsonBody(req);
    const roomName = String(body.roomName || '').trim();
    const identity = auth.profileId;
    const isAdmin = auth.role === 'admin';

    if (!roomName || !identity) {
      return sendJson(res, 400, { error: 'roomName is required' });
    }

    const isAdminTestRoom = roomName.startsWith('admin_test_room_');
    if (isAdminTestRoom && !isAdmin) {
      return sendJson(res, 403, { error: 'Admin test rooms require admin privileges.' });
    }

    // Authorize room join from env-backed Supabase when possible (Vercel has no in-memory activeCalls).
    if (!isAdminTestRoom && !isAdmin) {
      const memberHint =
        roomName.includes(identity) ||
        roomName.includes(auth.userId) ||
        roomName.startsWith('call_') ||
        roomName.startsWith('lk_');

      let dbMember = false;
      if (!memberHint) {
        const client = createServiceClient();
        if (client) {
          const { data: callRow } = await client
            .from('call_logs')
            .select('caller_id, receiver_id, host_id')
            .eq('id', roomName)
            .maybeSingle();
          const ids = [
            callRow?.caller_id,
            callRow?.receiver_id,
            (callRow as any)?.host_id,
          ].map((v) => String(v || ''));
          dbMember = ids.includes(identity) || ids.includes(auth.userId);
        }
      }

      if (!memberHint && !dbMember) {
        return sendJson(res, 403, {
          error:
            'Not authorized for this LiveKit room. Join only works for calls you participate in.',
        });
      }
    }

    const livekit = getLiveKitEnv();
    if (
      !livekit.apiKey ||
      !livekit.apiSecret ||
      livekit.apiKey === 'devkey' ||
      livekit.apiSecret === 'secret'
    ) {
      return sendJson(res, 200, {
        configured: false,
        token: null,
        wsUrl: livekit.wsUrl || null,
        message: 'LiveKit credentials missing. Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET in Vercel env.',
      });
    }

    const displayName =
      (typeof body.name === 'string' && body.name.trim()) ||
      auth.user?.user_metadata?.full_name ||
      auth.email ||
      identity;

    const { AccessToken } = await import('livekit-server-sdk');
    const at = new AccessToken(livekit.apiKey, livekit.apiSecret, {
      identity,
      name: displayName,
      ttl: '1h',
    });
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      hidden: false,
    });

    const token = await at.toJwt();
    return sendJson(res, 200, {
      configured: true,
      token,
      wsUrl: livekit.wsUrl,
      source: 'environment',
    });
  } catch (err: any) {
    console.error('[api/livekit/token]', err);
    return sendJson(res, 500, {
      configured: false,
      token: null,
      error: 'Failed to generate token',
      message: err?.message || 'Token signing failed',
    });
  }
}
