const request = require('supertest');
const { query } = require('../src/db');
const { createTestApp, createUser, resetDatabase } = require('./setup/helpers');

const app = createTestApp();

beforeEach(resetDatabase);

// The "songboard_refresh=<token>" part of a response's Set-Cookie header, ready to send back.
function refreshCookie(res) {
  const cookie = (res.headers['set-cookie'] ?? []).find((value) => value.startsWith('songboard_refresh='));
  return cookie?.split(';')[0];
}

const signup = (fields = {}) =>
  request(app)
    .post('/api/auth/signup')
    .send({ username: 'thom', email: 'thom@example.com', password: 'paranoid-android', ...fields });

const refresh = (cookie) => request(app).post('/api/auth/refresh').set('Cookie', cookie);

describe('POST /api/auth/signup', () => {
  it('creates the account with a hashed password and starts a session', async () => {
    const res = await signup({ displayName: 'Thom' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ username: 'thom', email: 'thom@example.com', displayName: 'Thom', isAdmin: false });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.accessToken).toEqual(expect.any(String));

    const cookie = res.headers['set-cookie'].find((value) => value.startsWith('songboard_refresh='));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/auth/);

    const { rows } = await query('SELECT password_hash FROM users WHERE username = $1', ['thom']);
    expect(rows[0].password_hash).toMatch(/^\$argon2id\$/);
  });

  it('uses the username as the display name when none is given', async () => {
    const res = await signup();

    expect(res.body.user.displayName).toBe('thom');
  });

  it('rejects invalid fields with a message for each one', async () => {
    const res = await request(app).post('/api/auth/signup').send({ username: 'a!', email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.error.details.fields).sort()).toEqual(['email', 'password', 'username']);
  });

  it('refuses a username or email that is already taken, ignoring case', async () => {
    await signup();

    const sameUsername = await signup({ username: 'THOM', email: 'other@example.com' });
    expect(sameUsername.status).toBe(409);
    expect(sameUsername.body.error.details.fields).toEqual({ username: 'That username is taken' });

    const sameEmail = await signup({ username: 'jonny', email: 'Thom@Example.com' });
    expect(sameEmail.status).toBe(409);
    expect(sameEmail.body.error.details.fields).toEqual({ email: 'An account with that email already exists' });
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(() => createUser({ username: 'jonny', email: 'jonny@example.com', password: 'kid-a-2000' }));

  it.each(['jonny', 'JONNY', 'Jonny@Example.com'])('logs in with "%s"', async (login) => {
    const res = await request(app).post('/api/auth/login').send({ login, password: 'kid-a-2000' });

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('jonny');
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(refreshCookie(res)).toBeDefined();
  });

  it.each([
    ['a wrong password', 'jonny', 'wrong-password'],
    ['an unknown account', 'nobody', 'kid-a-2000'],
  ])('gives the same answer for %s', async (_case, login, password) => {
    const res = await request(app).post('/api/auth/login').send({ login, password });

    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({ code: 'INVALID_CREDENTIALS', message: 'Incorrect username, email, or password' });
  });
});

describe('GET /api/auth/me', () => {
  it('requires an access token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects an invalid access token so the client knows to refresh', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns the signed-in user', async () => {
    const { body } = await signup();

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ username: 'thom', email: 'thom@example.com' });
  });
});

describe('POST /api/auth/refresh', () => {
  it('reports that nobody is logged in when there is no cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null, accessToken: null });
  });

  it('restores the session and rotates the refresh token', async () => {
    const signedUp = await signup();

    const res = await refresh(refreshCookie(signedUp));

    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('thom');
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(refreshCookie(res)).not.toBe(refreshCookie(signedUp));
  });

  it('lets a just-rotated token through once more, for tabs refreshing at the same time', async () => {
    const signedUp = await signup();
    await refresh(refreshCookie(signedUp));

    const secondTab = await refresh(refreshCookie(signedUp));

    expect(secondTab.status).toBe(200);
  });

  it('ends every session when an old token is reused after the grace window', async () => {
    const signedUp = await signup();
    const rotated = await refresh(refreshCookie(signedUp));
    await query("UPDATE refresh_tokens SET revoked_at = now() - interval '5 minutes' WHERE revoked_at IS NOT NULL");

    const reuse = await refresh(refreshCookie(signedUp));
    expect(reuse.status).toBe(401);

    const newest = await refresh(refreshCookie(rotated));
    expect(newest.status).toBe(401);
  });

  it('rejects an expired refresh token', async () => {
    const signedUp = await signup();
    await query("UPDATE refresh_tokens SET expires_at = now() - interval '1 second'");

    const res = await refresh(refreshCookie(signedUp));

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('deletes the refresh token and clears the cookie', async () => {
    const signedUp = await signup();

    const res = await request(app).post('/api/auth/logout').set('Cookie', refreshCookie(signedUp));

    expect(res.status).toBe(204);
    expect(res.headers['set-cookie'].join(';')).toMatch(/songboard_refresh=;/);
    expect((await refresh(refreshCookie(signedUp))).status).toBe(401);
  });
});

describe('rate limiting', () => {
  const limitedApp = () => createTestApp({ authRateLimit: { max: 2, windowMs: 60_000 } });

  it('blocks log-in after too many failed attempts', async () => {
    const app = limitedApp();
    const attempt = () => request(app).post('/api/auth/login').send({ login: 'nobody', password: 'whatever' });

    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);

    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });

  it('does not count successful log-ins toward the limit', async () => {
    await createUser({ username: 'colin', password: 'right-password' });
    const app = limitedApp();
    const logIn = (password) => request(app).post('/api/auth/login').send({ login: 'colin', password });

    for (let i = 0; i < 3; i += 1) {
      expect((await logIn('right-password')).status).toBe(200);
    }
    expect((await logIn('wrong-password')).status).toBe(401);
  });

  it('counts every sign-up request', async () => {
    const app = limitedApp();
    const signUp = (n) =>
      request(app).post('/api/auth/signup').send({ username: `fan${n}`, email: `fan${n}@example.com`, password: 'long-enough' });

    expect((await signUp(1)).status).toBe(201);
    expect((await signUp(2)).status).toBe(201);
    expect((await signUp(3)).status).toBe(429);
  });
});
