// Plain CommonJS ping — bypasses TypeScript/ESM entirely
module.exports = function handler(_req, res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ success: true, ping: true, vercel: Boolean(process.env.VERCEL) }));
};
