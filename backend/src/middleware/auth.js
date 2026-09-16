const { query } = require('../db');
const { AppError, forbidden, unauthorized } = require('../errors');
const { verifyAccessToken } = require('../services/auth');

const sessionExpired = () => new AppError(401, 'INVALID_TOKEN', 'Your session has expired. Please log in again.');

// Requires "Authorization: Bearer <access token>" for a user who still exists, and sets
// req.user = { id, username, isAdmin }. A bad or expired token gets INVALID_TOKEN, which
// tells the client to refresh its session and retry once.
async function requireAuth(req, res, next) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthorized();

  const userId = verifyAccessToken(token);
  if (!userId) throw sessionExpired();

  // Tokens outlive account deletion by up to their lifetime, so confirm the user is still here.
  const { rows } = await query('SELECT id, username, is_admin AS "isAdmin" FROM users WHERE id = $1', [userId]);
  if (rows.length === 0) throw sessionExpired();

  req.user = rows[0];
  next();
}

// requireAuth first, then the admin flag. The flag comes from the users row on every request,
// so revoking admin takes effect immediately rather than when the token expires.
const requireAdmin = [
  requireAuth,
  (req, res, next) => {
    if (!req.user.isAdmin) throw forbidden('Admins only');
    next();
  },
];

module.exports = { requireAuth, requireAdmin };
