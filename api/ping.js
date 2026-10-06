// Plain CommonJS ping — never imports the catch-all / heavy deps.
module.exports = function handler(_req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ success: true, ping: true, vercel: Boolean(process.env.VERCEL) }));
};
