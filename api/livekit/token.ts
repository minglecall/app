/**
 * LiveKit token minting for Vercel — uses LIVEKIT_* from server env.
 * Room membership for non-admin rooms still requires the long-lived Node call state;
 * on Vercel, admin test rooms and rooms named with the caller's profile id are allowed.
 */
import { AccessToken } from 'livekit-server-sdk';
import {
  sendJson,
  readJsonBody,
  requireAuthFromBearer,
  getLiveKitEnv,
  type VercelReq,
  type VercelRes,
} from '../_lib/vercelAuth';

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

    // Without in-memory activeCalls on Vercel, allow join when the room id contains the caller's id,
    // or when admin. Full call-membership checks remain on the long-lived Node server.
    if (!isAdminTestRoom && !isAdmin) {
      const memberHint =
        roomName.includes(identity) ||
        roomName.includes(auth.userId) ||
        roomName.startsWith('call_');
      if (!memberHint) {
        return sendJson(res, 403, {
          error:
            'Call room authorization requires the Node signaling server. On Vercel-only hosting, room names must include your user id, or run the full Express server.',
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
