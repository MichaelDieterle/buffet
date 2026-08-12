const crypto = require('crypto');

const TOKEN_TTL_S = 7 * 24 * 60 * 60; // 7 days

function isEnabled() {
  return Boolean(
    process.env.APP_PASSWORD && process.env.APP_PASSWORD.trim().length > 0
  );
}

function secret() {
  return process.env.APP_SECRET
    ? process.env.APP_SECRET
    : crypto
        .createHash('sha256')
        .update('buffet:' + process.env.APP_PASSWORD)
        .digest('hex');
}

function signToken() {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_S })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', secret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = crypto
    .createHmac('sha256', secret())
    .update(payload)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch (err) {
    return false;
  }
}

// Express middleware. When auth is disabled (no APP_PASSWORD set) it lets
// everything through, so local development without a password keeps working.
function requireAuth(req, res, next) {
  if (!isEnabled()) return next();
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  // Accept either a signed token (from the login flow) or the raw APP_PASSWORD
  // itself (stable credential for connectors like remote MCP).
  if (token === process.env.APP_PASSWORD) return next();
  if (verifyToken(token)) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

module.exports = { isEnabled, signToken, verifyToken, requireAuth };
