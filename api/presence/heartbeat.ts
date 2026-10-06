/**
 * POST /api/presence/heartbeat — alias of presence update for Vercel.
 */
import {
  sendJson,
  readJsonBody,
  requireAuthFromBearer,
  createServiceClient,
  type VercelReq,
  type VercelRes,
} from '../_lib/vercelAuth';

export default async function handler(req: VercelReq, res: VercelRes) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return sendJson(res, 405, { success: false, error: 'Method not allowed' });
  }

  const auth = await requireAuthFromBearer(req);
  if (auth.ok === false) {
    return sendJson(res, auth.status, { success: false, error: auth.error });
  }

  const client = createServiceClient();
  if (!client) {
    return sendJson(res, 503, { success: false, error: 'Supabase not configured' });
  }

  const body = await readJsonBody(req);
  const status = String(body?.status || 'online').toLowerCase();
  const allowed = status === 'online' || status === 'busy' || status === 'offline';
  const onlineStatus = allowed ? status : 'online';

  await client
    .from('profiles')
    .update({
      online_status: onlineStatus,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', auth.profileId);

  return sendJson(res, 200, { success: true, userId: auth.profileId, status: onlineStatus });
}
