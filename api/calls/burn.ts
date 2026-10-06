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
  if (req.method !== 'POST') {
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
  const coins = Math.max(0, Number(body?.coins || body?.amount || 0));
  if (!coins) {
    return sendJson(res, 400, { success: false, error: 'coins required' });
  }

  const { data: sender } = await client
    .from('profiles')
    .select('coin_balance')
    .eq('id', auth.profileId)
    .maybeSingle();

  const bal = Number(sender?.coin_balance || 0);
  if (bal < coins) {
    return sendJson(res, 400, { success: false, error: 'Insufficient coins', code: 'INSUFFICIENT' });
  }

  const newBal = bal - coins;
  await client.from('profiles').update({ coin_balance: newBal } as any).eq('id', auth.profileId);

  const hostId = String(body?.hostId || body?.receiverId || '');
  const hostEarn = Math.floor(coins * 0.7);
  if (hostId) {
    const { data: host } = await client
      .from('profiles')
      .select('earnings_coins')
      .eq('id', hostId)
      .maybeSingle();
    if (host) {
      await client
        .from('profiles')
        .update({ earnings_coins: Number(host.earnings_coins || 0) + hostEarn } as any)
        .eq('id', hostId);
    }
  }

  return sendJson(res, 200, {
    success: true,
    coinBalance: newBal,
    hostEarn,
  });
}
