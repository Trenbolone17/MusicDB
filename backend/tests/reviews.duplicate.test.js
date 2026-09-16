const request = require('supertest');
const { query } = require('../src/db');
const { createTestApp, createUser, authHeader, resetDatabase, createArtist, createAlbum, createTrack } = require('./setup/helpers');

const app = createTestApp();

let user;
let artist;
let album;
let track;

beforeEach(async () => {
  await resetDatabase();
  user = await createUser({ username: 'listener' });
  artist = await createArtist({ name: 'Portishead' });
  album = await createAlbum(artist.id, { title: 'Dummy' });
  track = await createTrack(album.id, { title: 'Glory Box' });
});

const rate = (rating, body) =>
  request(app).put(`/api/tracks/${track.id}/my-review`).set('Authorization', authHeader(user)).send({ rating, body });

const counters = async (table, id) => {
  const { rows } = await query(`SELECT rating_count AS count, rating_sum AS sum FROM ${table} WHERE id = $1`, [id]);
  return rows[0];
};

describe('one rating per user per item', () => {
  it('replaces the previous rating instead of adding a second one', async () => {
    const first = await rate(8, 'Woozy and perfect.');
    expect(first.status).toBe(201);

    const second = await rate(6, 'Still good, less perfect.');
    expect(second.status).toBe(200);
    expect(second.body.review.id).toBe(first.body.review.id);

    const { rows } = await query('SELECT rating, body FROM reviews WHERE user_id = $1 AND track_id = $2', [user.id, track.id]);
    expect(rows).toEqual([{ rating: 6, body: 'Still good, less perfect.' }]);
    expect(await counters('tracks', track.id)).toEqual({ count: 1, sum: 6 });
  });

  it('is enforced by Postgres, not only by the API', async () => {
    await rate(8);

    // Insert straight into the table, bypassing the service entirely.
    await expect(
      query('INSERT INTO reviews (user_id, track_id, rating) VALUES ($1, $2, $3)', [user.id, track.id, 5]),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('counts one rating per person', async () => {
    const other = await createUser({ username: 'second_listener' });
    await rate(8);
    await request(app).put(`/api/tracks/${track.id}/my-review`).set('Authorization', authHeader(other)).send({ rating: 10 });

    expect(await counters('tracks', track.id)).toEqual({ count: 2, sum: 18 });
  });

  it('keeps ratings of an artist, album, and track separate', async () => {
    await request(app).put(`/api/artists/${artist.id}/my-review`).set('Authorization', authHeader(user)).send({ rating: 9 });
    await request(app).put(`/api/albums/${album.id}/my-review`).set('Authorization', authHeader(user)).send({ rating: 7 });
    await rate(8);

    expect(await counters('artists', artist.id)).toEqual({ count: 1, sum: 9 });
    expect(await counters('albums', album.id)).toEqual({ count: 1, sum: 7 });
    expect(await counters('tracks', track.id)).toEqual({ count: 1, sum: 8 });
  });

  it('accepts a rating with no text and reports it as your own', async () => {
    await rate(7);

    const mine = await request(app).get(`/api/tracks/${track.id}/my-review`).set('Authorization', authHeader(user));
    expect(mine.status).toBe(200);
    expect(mine.body.review).toMatchObject({ rating: 7, body: null });
  });

  it.each([0, 11, 4.5, 'eight'])('rejects the invalid rating %p', async (rating) => {
    const res = await rate(rating);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.fields).toHaveProperty('rating');
    expect(await counters('tracks', track.id)).toEqual({ count: 0, sum: 0 });
  });

  it('returns 404 for an item that does not exist', async () => {
    const res = await request(app).put('/api/tracks/999999/my-review').set('Authorization', authHeader(user)).send({ rating: 8 });

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Track not found' });
  });
});
