const request = require('supertest');
const { query } = require('../src/db');
const ranking = require('../src/ranking');
const { createTestApp, resetDatabase, createUser, createArtist, createAlbum, createTrack } = require('./setup/helpers');

const app = createTestApp();

describe('bayesianScore', () => {
  it('pulls items with few ratings towards the global mean', () => {
    const onePerfectTen = ranking.bayesianScore({ ratingSum: 10, ratingCount: 1, globalMean: 7 });
    const twentyNines = ranking.bayesianScore({ ratingSum: 180, ratingCount: 20, globalMean: 7 });

    expect(onePerfectTen).toBeCloseTo(7.5); // (10 + 5 * 7) / (1 + 5)
    expect(twentyNines).toBeCloseTo(8.6); // (180 + 5 * 7) / (20 + 5)
    expect(twentyNines).toBeGreaterThan(onePerfectTen);
  });

  it('approaches the plain average as ratings pile up', () => {
    const score = ranking.bayesianScore({ ratingSum: 9000, ratingCount: 1000, globalMean: 5 });

    expect(score).toBeCloseTo(8.98, 2);
  });
});

describe('decayWeight', () => {
  it('halves every half-life', () => {
    expect(ranking.decayWeight(0)).toBe(1);
    expect(ranking.decayWeight(ranking.TRENDING_HALF_LIFE_DAYS)).toBeCloseTo(0.5);
    expect(ranking.decayWeight(2 * ranking.TRENDING_HALF_LIFE_DAYS)).toBeCloseTo(0.25);
  });
});

describe('trendingScore', () => {
  it('favours a fresh rating over an identical old one', () => {
    const fresh = ranking.trendingScore({ ratings: [{ rating: 10, ageDays: 1 }], globalMean: 7 });
    const stale = ranking.trendingScore({ ratings: [{ rating: 10, ageDays: 60 }], globalMean: 7 });

    expect(fresh).toBeGreaterThan(stale);
  });
});

describe('GET /api/charts/:type', () => {
  let album;

  beforeEach(async () => {
    await resetDatabase();
    const artist = await createArtist({ name: 'Björk' });
    album = await createAlbum(artist.id, { title: 'Homogenic', releaseYear: 1997 });
  });

  it('orders the top chart by the weighted score, matching the JavaScript formula', async () => {
    const specs = [
      ['One perfect ten', 1, 10],
      ['Twenty nines', 20, 180],
      ['Three sevens', 3, 21],
      ['Fifty sixes', 50, 300],
      ['Unrated', 0, 0],
    ];
    for (const [index, [title, ratingCount, ratingSum]] of specs.entries()) {
      await createTrack(album.id, { title, trackNumber: index + 1, ratingCount, ratingSum });
    }
    const rated = specs.filter(([, count]) => count > 0);
    const globalMean = rated.reduce((sum, [, , s]) => sum + s, 0) / rated.reduce((sum, [, c]) => sum + c, 0);
    const expected = rated
      .map(([title, ratingCount, ratingSum]) => ({ title, score: ranking.bayesianScore({ ratingSum, ratingCount, globalMean }) }))
      .sort((a, b) => b.score - a.score);

    const res = await request(app).get('/api/charts/tracks');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 25, total: 4, sort: 'top' });
    expect(res.body.items.map((item) => item.title)).toEqual(expected.map((item) => item.title));
    // Twenty 9s beat a single 10, and the unrated track isn't listed at all.
    expect(res.body.items.map((item) => item.title)).toEqual(['Twenty nines', 'One perfect ten', 'Three sevens', 'Fifty sixes']);
    expect(res.body.items.map((item) => item.rank)).toEqual([1, 2, 3, 4]);
    expect(res.body.items[0].score).toBeCloseTo(expected[0].score, 3);
    expect(res.body.items[0]).toMatchObject({
      ratingCount: 20,
      ratingAverage: 9,
      artist: { name: 'Björk' },
      album: { title: 'Homogenic' },
    });
  });

  it('orders the trending chart by decayed ratings and drops ones outside the window', async () => {
    const users = [];
    for (let n = 1; n <= 4; n += 1) users.push(await createUser({ username: `fan${n}` }));
    const tracks = {};
    const specs = [
      ['Fresh ten', 10, 1],
      ['Stale ten', 10, 60],
      ['Recent four', 4, 2],
      ['Ancient ten', 10, 100],
    ];
    for (const [index, [title, rating, ageDays]] of specs.entries()) {
      tracks[title] = await createTrack(album.id, { title, trackNumber: index + 1, ratingCount: 1, ratingSum: rating });
      await query(
        `INSERT INTO reviews (user_id, track_id, rating, created_at, updated_at)
         VALUES ($1, $2, $3, now() - make_interval(days => $4), now() - make_interval(days => $4))`,
        [users[index].id, tracks[title].id, rating, ageDays],
      );
    }
    const globalMean = specs.reduce((sum, [, rating]) => sum + rating, 0) / specs.length;
    const jsScore = (rating, ageDays) => ranking.trendingScore({ ratings: [{ rating, ageDays }], globalMean });

    const res = await request(app).get('/api/charts/tracks?sort=trending');

    expect(res.status).toBe(200);
    expect(res.body.sort).toBe('trending');
    expect(res.body.items.map((item) => item.title)).toEqual(['Fresh ten', 'Stale ten', 'Recent four']);
    expect(res.body.items[0].score).toBeCloseTo(jsScore(10, 1), 3);
    expect(res.body.items[1].score).toBeCloseTo(jsScore(10, 60), 3);
    expect(res.body.items[2].score).toBeCloseTo(jsScore(4, 2), 3);
  });

  it('pages 25 at a time with continuing ranks', async () => {
    for (let n = 1; n <= 26; n += 1) {
      await createTrack(album.id, { title: `Track ${n}`, trackNumber: n, ratingCount: 1, ratingSum: 5 });
    }

    const first = await request(app).get('/api/charts/tracks');
    const second = await request(app).get('/api/charts/tracks?page=2');

    expect(first.body.items).toHaveLength(25);
    expect(first.body.total).toBe(26);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.items[0].rank).toBe(26);
    expect(second.body.page).toBe(2);
  });

  it('lists albums and artists too', async () => {
    await query('UPDATE albums SET rating_count = 2, rating_sum = 17 WHERE id = $1', [album.id]);
    await query('UPDATE artists SET rating_count = 1, rating_sum = 9 WHERE id = $1', [album.artist_id]);

    const albums = await request(app).get('/api/charts/albums');
    const artists = await request(app).get('/api/charts/artists');

    expect(albums.body.items[0]).toMatchObject({ title: 'Homogenic', releaseYear: 1997, ratingAverage: 8.5, artist: { name: 'Björk' } });
    expect(artists.body.items[0]).toMatchObject({ name: 'Björk', ratingCount: 1, ratingAverage: 9 });
  });

  it('rejects an unknown chart or sort', async () => {
    expect((await request(app).get('/api/charts/songs')).status).toBe(404);

    const badSort = await request(app).get('/api/charts/tracks?sort=best');
    expect(badSort.status).toBe(400);
    expect(badSort.body.error.details.fields).toHaveProperty('sort');
  });
});
