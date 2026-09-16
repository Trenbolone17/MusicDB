const request = require('supertest');
const { createTestApp, resetDatabase, createUser, authHeader, createArtist, createAlbum, createTrack } = require('./setup/helpers');

const app = createTestApp();

let admin;
let member;
let artist;
let album;
let track;

beforeEach(async () => {
  await resetDatabase();
  admin = await createUser({ username: 'admin', isAdmin: true });
  member = await createUser({ username: 'member' });
  artist = await createArtist({ name: 'Radiohead' });
  album = await createAlbum(artist.id, { title: 'OK Computer', releaseYear: 1997 });
  track = await createTrack(album.id, { title: 'Airbag', ratingCount: 2, ratingSum: 17 });
});

const feature = (user, body) => request(app).post('/api/admin/featured').set('Authorization', authHeader(user)).send(body);

describe('POST /api/admin/featured', () => {
  it('requires an admin', async () => {
    expect((await request(app).post('/api/admin/featured').send({ type: 'track', id: track.id })).status).toBe(401);

    const asMember = await feature(member, { type: 'track', id: track.id });
    expect(asMember.status).toBe(403);
    expect(asMember.body.error.message).toBe('Admins only');
  });

  it('features an item once', async () => {
    const first = await feature(admin, { type: 'track', id: track.id });
    expect(first.status).toBe(201);
    expect(first.body.featuredId).toEqual(expect.any(Number));

    const again = await feature(admin, { type: 'track', id: track.id });
    expect(again.status).toBe(409);
  });

  it('rejects an unknown item or type', async () => {
    expect((await feature(admin, { type: 'album', id: 999999 })).status).toBe(404);
    expect((await feature(admin, { type: 'playlist', id: 1 })).status).toBe(400);
  });
});

describe('GET /api/featured', () => {
  it('lists featured items by type, newest first, for anyone', async () => {
    await feature(admin, { type: 'artist', id: artist.id });
    await feature(admin, { type: 'track', id: track.id });
    const second = await createTrack(album.id, { title: 'Karma Police', trackNumber: 6 });
    await feature(admin, { type: 'track', id: second.id });

    const res = await request(app).get('/api/featured');

    expect(res.status).toBe(200);
    expect(res.body.artists.map((item) => item.name)).toEqual(['Radiohead']);
    expect(res.body.albums).toEqual([]);
    expect(res.body.tracks.map((item) => item.title)).toEqual(['Karma Police', 'Airbag']);
    expect(res.body.tracks[1]).toMatchObject({ ratingCount: 2, ratingAverage: 8.5, artist: { name: 'Radiohead' }, album: { title: 'OK Computer' }, featuredId: expect.any(Number) });
  });
});

describe('DELETE /api/admin/featured/:id', () => {
  it('lets an admin unfeature, and nobody else', async () => {
    const { body } = await feature(admin, { type: 'album', id: album.id });

    expect((await request(app).delete(`/api/admin/featured/${body.featuredId}`).set('Authorization', authHeader(member))).status).toBe(403);
    expect((await request(app).delete(`/api/admin/featured/${body.featuredId}`).set('Authorization', authHeader(admin))).status).toBe(204);
    expect((await request(app).delete(`/api/admin/featured/${body.featuredId}`).set('Authorization', authHeader(admin))).status).toBe(404);
    expect((await request(app).get('/api/featured')).body.albums).toEqual([]);
  });
});

describe('GET /api/home', () => {
  it('returns featured songs and artists plus the top five of each chart', async () => {
    await feature(admin, { type: 'track', id: track.id });
    await feature(admin, { type: 'artist', id: artist.id });

    const res = await request(app).get('/api/home');

    expect(res.status).toBe(200);
    expect(res.body.featured.tracks.map((item) => item.title)).toEqual(['Airbag']);
    expect(res.body.featured.artists.map((item) => item.name)).toEqual(['Radiohead']);
    expect(res.body.top.tracks.map((item) => [item.rank, item.title])).toEqual([[1, 'Airbag']]);
    expect(res.body.top.albums).toEqual([]);
    expect(res.body.top.artists).toEqual([]);
  });
});
