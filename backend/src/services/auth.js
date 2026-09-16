const crypto = require('node:crypto');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { query, withTransaction } = require('../db');

const REFRESH_COOKIE = 'songboard_refresh';
// Two tabs refreshing at the same moment send the same cookie, and the slower request arrives
// just after the token was rotated. Inside this window that's a race, not a stolen token.
const ROTATION_GRACE_SECONDS = 30;

// --- Passwords ---

function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id });
}

// When the account doesn't exist, verify against a throwaway hash anyway, so a failed login
// takes as long either way and response times don't reveal which accounts exist.
let dummyHash;
async function verifyPassword(passwordHash, password) {
  if (!passwordHash) {
    dummyHash ??= hashPassword('not-a-real-password');
    await argon2.verify(await dummyHash, password);
    return false;
  }
  return argon2.verify(passwordHash, password);
}

// --- Access tokens: short-lived JWTs the client keeps in memory ---

function createAccessToken(userId) {
  return jwt.sign({}, config.auth.accessTokenSecret, {
    subject: String(userId),
    expiresIn: `${config.auth.accessTokenTtlMinutes}m`,
    algorithm: 'HS256',
  });
}

// Returns the user id from a valid, unexpired token, or null.
function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, config.auth.accessTokenSecret, { algorithms: ['HS256'] });
    const userId = Number(payload.sub);
    return Number.isSafeInteger(userId) ? userId : null;
  } catch {
    return null;
  }
}

// --- Refresh tokens: random strings in an httpOnly cookie ---
// Only a SHA-256 hash is stored, so a leaked database can't be replayed as live sessions.
// revoked_at marks a token that was rotated; logging out and detected reuse delete rows instead.

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// `db` is the pool helper or a transaction client; both have query().
async function issueRefreshToken(db, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3))`,
    [userId, hashToken(token), config.auth.refreshTokenTtlDays],
  );
  return token;
}

// Swaps a refresh token for a new one and returns { userId, token }, or null when the token is
// unknown, expired, or was already rotated more than the grace window ago. That last case
// suggests the old token was stolen, so it also ends every session the user has.
async function rotateRefreshToken(token) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, user_id AS "userId",
              expires_at < now() AS expired,
              revoked_at IS NOT NULL AS rotated,
              revoked_at > now() - make_interval(secs => $2) AS "rotatedRecently"
       FROM refresh_tokens
       WHERE token_hash = $1
       FOR UPDATE`,
      [hashToken(token), ROTATION_GRACE_SECONDS],
    );
    const row = rows[0];
    if (!row || row.expired) return null;

    if (row.rotated && !row.rotatedRecently) {
      await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [row.userId]);
      return null;
    }
    if (!row.rotated) {
      await client.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [row.id]);
    }
    return { userId: row.userId, token: await issueRefreshToken(client, row.userId) };
  });
}

async function deleteRefreshToken(token) {
  await query('DELETE FROM refresh_tokens WHERE token_hash = $1', [hashToken(token)]);
}

// The cookie is only ever sent to /api/auth, never readable by scripts, and never sent
// on requests started by other sites.
function refreshCookieOptions() {
  return { httpOnly: true, secure: config.auth.cookieSecure, sameSite: 'strict', path: '/api/auth' };
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, {
    ...refreshCookieOptions(),
    maxAge: config.auth.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
}

module.exports = {
  REFRESH_COOKIE,
  hashPassword,
  verifyPassword,
  createAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  deleteRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
};
