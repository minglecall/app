/**
 * Public + authenticated health probe for Vercel.
 */
import { sendJson, getSupabaseEnv, getR2Env, getLiveKitEnv, type VercelReq, type VercelRes } from './_lib/vercelAuth';

export default async function handler(_req: VercelReq, res: VercelRes) {
  const supabase = getSupabaseEnv();
  const r2 = getR2Env();
  const livekit = getLiveKitEnv();

  return sendJson(res, 200, {
    success: true,
    vercel: Boolean(process.env.VERCEL),
    services: {
      supabase: Boolean(supabase.url && supabase.serviceKey),
      supabaseAnon: Boolean(supabase.anonKey),
      r2: Boolean(r2.accountId && r2.accessKeyId && r2.secretAccessKey),
      livekit: Boolean(livekit.wsUrl && livekit.apiKey && livekit.apiSecret),
    },
  });
}
