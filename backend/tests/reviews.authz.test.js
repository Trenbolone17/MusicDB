const request = require('supertest');
const { query } = require('../src/db');
const { createTestApp, createUser, authHeader, resetDatabase, createArtist, createAlbum, createTrack } = require('./setup/helpers');

const app = createTestApp();

let author;
let stranger;
let track;
let review;

beforeEach(async () => {
  await resetDatabase();
  author = await createUser({ username: 'author' });
  stranger = await createUser({ username: 'stranger' });
  const artist = await createArtist({ name: 'Massive Attack' });
  const album = await createAlbum(artist.id, { title: 'Mezzanine' });
  track = await createTrack(album.id, { title: 'Teardrop' });

  const created = await request(app)
    .put(`/api/tracks/${track.id}/my-review`)
    .set('Authorization', authHeader(author))
    .send({ rating: 9, body: 'That drum loop.' });
  review = created.body.review;
});

const trackCounters = async () => {
  const { rows } = await query('SELECT rating_count AS count, rating_sum AS sum FROM tracks WHERE id = $1', [track.id]);
  return rows[0];
};

describe('rating requires signing in', () => {
  it('rejects a rating with no token', async () => {
    const res = await request(app).put(`/api/tracks/${track.id}/my-review`).send({ rating: 5 });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects reading your own review with no token', async () => {
    const res = await request(app).get(`/api/tracks/${track.id}/my-review`);

    expect(res.status).toBe(401);
  });

  it('lets anyone read the reviews list', async () => {
    const res = await request(app).get(`/api/tracks/${track.id}/reviews`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, total: 1 });
    expect(res.body.items[0]).toMatchObject({ rating: 9, body: 'That drum loop.', author: { username: 'author' } });
  });
});

describe('editing a review', () => {
  it('lets the author edit their own', async () => {
    const res = await request(app)
      .patch(`/api/reviews/${review.id}`)
      .set('Authorization', authHeader(author))
      .send({ rating: 7 });

    expect(res.status).toBe(200);
    expect(res.body.review).toMatchObject({ rating: 7, body: 'That drum loop.' });
    expect(await trackCounters()).toEqual({ count: 1, sum: 7 });
  });

  it('refuses to let someone else edit it', async () => {
    const res = await request(app)
      .patch(`/api/reviews/${review.id}`)
      .set('Authorization', authHeader(stranger))
      .send({ rating: 1 });

    expect(res.status).toBe(403);
    expect(res.body.error).toEqual({ code: 'FORBIDDEN', message: 'You can only change your own reviews' });
    expect(await trackCounters()).toEqual({ count: 1, sum: 9 });
  });

  it('rejects an edit with no token', async () => {
    const res = await request(app).patch(`/api/reviews/${review.id}`).send({ rating: 1 });

    expect(res.status).toBe(401);
  });

  it('returns 404 for a review that does not exist', async () => {
    const res = await request(app).patch('/api/reviews/999999').set('Authorization', authHeader(author)).send({ rating: 5 });

    expect(res.status).toBe(404);
  });
});

describe('deleting a review', () => {
  it('lets the author delete their own and takes the rating off the total', async () => {
    const res = await request(app).delete(`/api/reviews/${review.id}`).set('Authorization', authHeader(author));

    expect(res.status).toBe(204);
    expect(await trackCounters()).toEqual({ count: 0, sum: 0 });
    const { rows } = await query('SELECT id FROM reviews WHERE id = $1', [review.id]);
    expect(rows).toHaveLength(0);
  });

  it('refuses to let someone else delete it', async () => {
    const res = await request(app).delete(`/api/reviews/${review.id}`).set('Authorization', authHeader(stranger));

    expect(res.status).toBe(403);
    expect(await trackCounters()).toEqual({ count: 1, sum: 9 });
  });

  it('rejects a deletion with no token', async () => {
    const res = await request(app).delete(`/api/reviews/${review.id}`);

    expect(res.status).toBe(401);
    expect(await trackCounters()).toEqual({ count: 1, sum: 9 });
  });

  it('returns 404 for a review that does not exist', async () => {
    const res = await request(app).delete('/api/reviews/999999').set('Authorization', authHeader(author));

    expect(res.status).toBe(404);
  });
});
