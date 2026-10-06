module.exports = function handler(_req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(
    JSON.stringify({
      success: true,
      ok: true,
      vercel: Boolean(process.env.VERCEL),
      node: process.version,
      time: new Date().toISOString(),
      r2: Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY),
      supabase: Boolean(
        (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) && process.env.SUPABASE_SERVICE_ROLE_KEY
      ),
    })
  );
};
