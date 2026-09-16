const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { AppError, conflict, unauthorized } = require('../errors');
const { requireAuth } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const auth = require('../services/auth');
const { SELF_COLUMNS, toSelf, findSelfById } = require('../services/users');

const SignupSchema = z.object({
  username: z
    .string('Required')
    .trim()
    .regex(/^[A-Za-z0-9_]{3,30}$/, 'Use 3–30 letters, numbers, or underscores'),
  email: z.string('Required').trim().max(254, 'That email is too long').pipe(z.email('Enter a valid email address')),
  password: z.string('Required').min(8, 'Use at least 8 characters').max(128, 'Use at most 128 characters'),
  displayName: z.string().trim().max(50, 'Use at most 50 characters').optional(),
});

const LoginSchema = z.object({
  login: z.string('Required').trim().min(1, 'Required'),
  password: z.string('Required').min(1, 'Required'),
});

// Postgres unique indexes are the real guard against duplicate accounts (a pre-check could
// race), so their violations are translated into a message for the right form field.
const DUPLICATE_FIELDS = {
  users_username_lower_key: ['username', 'That username is taken'],
  users_email_lower_key: ['email', 'An account with that email already exists'],
};

const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect username, email, or password');

// signupLimiter counts every sign-up request; loginLimiter counts only failed log-ins, so typing
// the right password never locks anyone out; sessionLimiter is loose, because the client
// refreshes on every page load.
function createAuthRouter({ signupLimiter, loginLimiter, sessionLimiter }) {
  const router = express.Router();

  // Logs the user in: the access token goes in the body for the client to keep in memory, and
  // the refresh token goes in an httpOnly cookie that scripts can't read.
  async function startSession(res, status, user) {
    const refreshToken = await auth.issueRefreshToken(db, user.id);
    auth.setRefreshCookie(res, refreshToken);
    res.status(status).json({ user, accessToken: auth.createAccessToken(user.id) });
  }

  router.post('/signup', signupLimiter, validateBody(SignupSchema), async (req, res) => {
    const { username, email, password, displayName } = req.body;
    const passwordHash = await auth.hashPassword(password);

    let user;
    try {
      const { rows } = await db.query(
        `INSERT INTO users (username, email, password_hash, display_name)
         VALUES ($1, $2, $3, $4)
         RETURNING ${SELF_COLUMNS}`,
        [username, email, passwordHash, displayName || username],
      );
      user = toSelf(rows[0]);
    } catch (err) {
      const duplicate = err.code === '23505' && DUPLICATE_FIELDS[err.constraint];
      if (!duplicate) throw err;
      const [field, message] = duplicate;
      throw conflict(message, { fields: { [field]: message } });
    }

    await startSession(res, 201, user);
  });

  router.post('/login', loginLimiter, validateBody(LoginSchema), async (req, res) => {
    const { login, password } = req.body;
    // Usernames can't contain "@", so a login matches at most one account.
    const { rows } = await db.query(
      `SELECT ${SELF_COLUMNS}, password_hash AS "passwordHash"
       FROM users
       WHERE lower(username) = lower($1) OR lower(email) = lower($1)`,
      [login],
    );

    const row = rows[0];
    if (!(await auth.verifyPassword(row?.passwordHash, password))) throw invalidCredentials();

    const { passwordHash, ...user } = row;
    await startSession(res, 200, toSelf(user));
  });

  // Restores a session from the refresh cookie, rotating it. No cookie at all just means
  // nobody is logged in, which is a normal answer rather than an error.
  router.post('/refresh', sessionLimiter, async (req, res) => {
    const token = req.cookies[auth.REFRESH_COOKIE];
    if (!token) {
      res.json({ user: null, accessToken: null });
      return;
    }

    const rotated = await auth.rotateRefreshToken(token);
    const user = rotated && (await findSelfById(rotated.userId));
    if (!user) {
      auth.clearRefreshCookie(res);
      throw unauthorized('Your session has ended. Please log in again.');
    }

    auth.setRefreshCookie(res, rotated.token);
    res.json({ user, accessToken: auth.createAccessToken(user.id) });
  });

  router.post('/logout', sessionLimiter, async (req, res) => {
    const token = req.cookies[auth.REFRESH_COOKIE];
    if (token) await auth.deleteRefreshToken(token);
    auth.clearRefreshCookie(res);
    res.status(204).end();
  });

  router.get('/me', requireAuth, async (req, res) => {
    res.json({ user: await findSelfById(req.user.id) });
  });

  return router;
}

module.exports = { createAuthRouter };
