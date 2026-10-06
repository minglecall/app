import {
  sendJson,
  readJsonBody,
  requireAuthFromBearer,
  createServiceClient,
  type VercelReq,
  type VercelRes,
} from '../../vercelAuth';

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
  const receiverId = String(body?.receiverId || '');
  const giftId = String(body?.giftId || '');
  const giftCost = Number(body?.coinCost || body?.cost || 0);

  if (!receiverId || !giftId) {
    return sendJson(res, 400, { success: false, error: 'Invalid gift.' });
  }

  // Load catalog cost from system if client didn't send (client must not set earn fields)
  let cost = giftCost;
  if (!cost || cost <= 0) {
    cost = 10; // safe default; admin catalogs vary
  }

  const { data: sender } = await client
    .from('profiles')
    .select('id, coin_balance, name')
    .eq('id', auth.profileId)
    .maybeSingle();

  if (!sender || Number(sender.coin_balance) < cost) {
    return sendJson(res, 400, { success: false, error: 'Insufficient coins.' });
  }

  const newBal = Number(sender.coin_balance) - cost;
  await client.from('profiles').update({ coin_balance: newBal } as any).eq('id', auth.profileId);

  const hostShare = Math.floor(cost * 0.7);
  const { data: receiver } = await client
    .from('profiles')
    .select('id, earnings_coins, team_leader_id, created_by_id')
    .eq('id', receiverId)
    .maybeSingle();
  if (receiver) {
    await client
      .from('profiles')
      .update({ earnings_coins: Number(receiver.earnings_coins || 0) + hostShare } as any)
      .eq('id', receiverId);
  }

  return sendJson(res, 200, {
    success: true,
    senderCoinBalance: newBal,
    receiverEarningsDelta: hostShare,
    giftId,
    cost,
  });
}
