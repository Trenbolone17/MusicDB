const fs = require('node:fs/promises');
const path = require('node:path');
const request = require('supertest');
const sharp = require('sharp');
const config = require('../src/config');
const { query } = require('../src/db');
const { createTestApp, resetDatabase, createUser, authHeader, createArtist, createAlbum, createTrack } = require('./setup/helpers');

const app = createTestApp();

let user;
let track;
let otherTrack;

beforeEach(async () => {
  await resetDatabase();
  user = await createUser({ username: 'thom', displayName: 'Thom', password: 'paranoid-android' });
  const artist = await createArtist({ name: 'Radiohead' });
  const album = await createAlbum(artist.id, { title: 'OK Computer', coverUrl: 'https://example.com/ok.jpg' });
  track = await createTrack(album.id, { title: 'Airbag', trackNumber: 1 });
  otherTrack = await createTrack(album.id, { title: 'Let Down', trackNumber: 5 });
});

const rate = (who, path, body) => request(app).put(`/api/${path}/my-review`).set('Authorization', authHeader(who)).send(body);

describe('public profile', () => {
  it('shows stats and never the email address', async () => {
    await rate(user, `tracks/${track.id}`, { rating: 9, body: 'Opens the record perfectly.' });
    await rate(user, `tracks/${otherTrack.id}`, { rating: 6 });

    const res = await request(app).get('/api/users/THOM');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: 'thom', displayName: 'Thom', bio: '', avatarUrl: null, ratingCount: 2, averageGiven: 7.5 });
    expect(res.body).not.toHaveProperty('email');
    expect(res.body).not.toHaveProperty('id');
  });

  it('returns 404 for an unknown user', async () => {
    const res = await request(app).get('/api/users/nobody');

    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('User not found');
  });

  it('lists their top-rated songs, highest first', async () => {
    await rate(user, `tracks/${track.id}`, { rating: 7 });
    await rate(user, `tracks/${otherTrack.id}`, { rating: 10 });

    const res = await request(app).get('/api/users/thom/top-tracks');

    expect(res.body.items.map((item) => [item.title, item.givenRating])).toEqual([
      ['Let Down', 10],
      ['Airbag', 7],
    ]);
    expect(res.body.items[0]).toMatchObject({ artist: { name: 'Radiohead' }, album: { title: 'OK Computer' }, ratingAverage: 10 });
  });

  it('lists their written reviews with what each one is about', async () => {
    await rate(user, `tracks/${track.id}`, { rating: 9, body: 'Opens the record perfectly.' });
    await rate(user, `tracks/${otherTrack.id}`, { rating: 6 });

    const res = await request(app).get('/api/users/thom/reviews');

    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({
      rating: 9,
      body: 'Opens the record perfectly.',
      target: { type: 'track', id: track.id, title: 'Airbag', subtitle: 'Radiohead · OK Computer', coverUrl: 'https://example.com/ok.jpg' },
    });
  });
});

describe('PATCH /api/me', () => {
  it('requires signing in', async () => {
    expect((await request(app).patch('/api/me').send({ bio: 'hi' })).status).toBe(401);
  });

  it('updates the display name and bio', async () => {
    const res = await request(app).patch('/api/me').set('Authorization', authHeader(user)).send({ displayName: 'Thom Y', bio: 'Singer.' });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ displayName: 'Thom Y', bio: 'Singer.' });
    expect((await request(app).get('/api/users/thom')).body).toMatchObject({ displayName: 'Thom Y', bio: 'Singer.' });
  });

  it('rejects an empty display name', async () => {
    const res = await request(app).patch('/api/me').set('Authorization', authHeader(user)).send({ displayName: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error.details.fields).toHaveProperty('displayName');
  });
});

describe('PUT /api/me/avatar', () => {
  const png = () => sharp({ create: { width: 600, height: 400, channels: 3, background: '#22c55e' } }).png().toBuffer();

  it('stores a resized WebP and serves its URL', async () => {
    const res = await request(app).put('/api/me/avatar').set('Authorization', authHeader(user)).attach('avatar', await png(), 'me.png');

    expect(res.status).toBe(200);
    expect(res.body.user.avatarUrl).toMatch(/^\/uploads\/avatars\/\d+-[0-9a-f]{16}\.webp$/);

    const stored = await fs.readFile(path.join(config.storage.uploadsDir, res.body.user.avatarUrl.replace('/uploads/', '')));
    const meta = await sharp(stored).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 256, 256]);
  });

  it('replaces the previous picture and deletes the old file', async () => {
    const first = await request(app).put('/api/me/avatar').set('Authorization', authHeader(user)).attach('avatar', await png(), 'a.png');
    const second = await request(app).put('/api/me/avatar').set('Authorization', authHeader(user)).attach('avatar', await png(), 'b.png');

    expect(second.body.user.avatarUrl).not.toBe(first.body.user.avatarUrl);
    const oldFile = path.join(config.storage.uploadsDir, first.body.user.avatarUrl.replace('/uploads/', ''));
    await expect(fs.access(oldFile)).rejects.toThrow();
  });

  it('rejects files that are not images', async () => {
    const res = await request(app).put('/api/me/avatar').set('Authorization', authHeader(user)).attach('avatar', Buffer.from('not an image'), 'notes.txt');

    expect(res.status).toBe(400);
    expect(res.body.error.details.fields).toHaveProperty('avatar');
  });

  it('rejects files over 2 MB', async () => {
    const res = await request(app).put('/api/me/avatar').set('Authorization', authHeader(user)).attach('avatar', Buffer.alloc(2 * 1024 * 1024 + 1), 'big.png');

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('PUT /api/me/password', () => {
  const refreshCookie = (res) => (res.headers['set-cookie'] ?? []).find((c) => c.startsWith('songboard_refresh=')).split(';')[0];

  it('requires the current password', async () => {
    const res = await request(app).put('/api/me/password').set('Authorization', authHeader(user)).send({ currentPassword: 'wrong', newPassword: 'a-new-password' });

    expect(res.status).toBe(400);
    expect(res.body.error.details.fields).toEqual({ currentPassword: 'Incorrect password' });
  });

  it('changes the password and signs out other devices', async () => {
    const otherDevice = await request(app).post('/api/auth/login').send({ login: 'thom', password: 'paranoid-android' });

    const res = await request(app).put('/api/me/password').set('Authorization', authHeader(user)).send({ currentPassword: 'paranoid-android', newPassword: 'a-new-password' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect((await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie(otherDevice))).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie(res))).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ login: 'thom', password: 'a-new-password' })).status).toBe(200);
  });
});

describe('DELETE /api/me', () => {
  it('requires the password', async () => {
    const res = await request(app).delete('/api/me').set('Authorization', authHeader(user)).send({ password: 'wrong' });

    expect(res.status).toBe(400);
    expect((await query('SELECT id FROM users WHERE id = $1', [user.id])).rows).toHaveLength(1);
  });

  it('removes the account and takes its ratings off every total', async () => {
    const other = await createUser({ username: 'jonny' });
    await rate(user, `tracks/${track.id}`, { rating: 9 });
    await rate(other, `tracks/${track.id}`, { rating: 5 });
    await rate(user, `albums/${track.album_id}`, { rating: 8 });

    const res = await request(app).delete('/api/me').set('Authorization', authHeader(user)).send({ password: 'paranoid-android' });

    expect(res.status).toBe(204);
    expect((await query('SELECT id FROM users WHERE id = $1', [user.id])).rows).toHaveLength(0);
    expect((await query('SELECT rating_count AS count, rating_sum AS sum FROM tracks WHERE id = $1', [track.id])).rows[0]).toEqual({ count: 1, sum: 5 });
    expect((await query('SELECT rating_count AS count, rating_sum AS sum FROM albums WHERE id = $1', [track.album_id])).rows[0]).toEqual({ count: 0, sum: 0 });
    expect((await request(app).get('/api/auth/me').set('Authorization', authHeader(user))).status).toBe(401);
  });
});
