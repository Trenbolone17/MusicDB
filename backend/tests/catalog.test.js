const request = require('supertest');
const { createApp } = require('../src/app');
const { resetDatabase, createArtist, createAlbum, createTrack, addGenre } = require('./setup/helpers');

const app = createApp();

beforeEach(resetDatabase);

describe('GET /api/artists/:id', () => {
  it('returns the artist with top genres, discography, and rated tracks only', async () => {
    const artist = await createArtist({ name: 'Radiohead', bio: 'English rock band.', ratingCount: 4, ratingSum: 35 });
    await addGenre(artist.id, 'rock', 10);
    await addGenre(artist.id, 'alternative rock', 42);
    const kidA = await createAlbum(artist.id, { title: 'Kid A', releaseYear: 2000 });
    const okComputer = await createAlbum(artist.id, { title: 'OK Computer', releaseYear: 1997 });
    await createTrack(okComputer.id, { title: 'Airbag', trackNumber: 1, ratingCount: 5, ratingSum: 40 });
    await createTrack(okComputer.id, { title: 'Paranoid Android', trackNumber: 2, ratingCount: 2, ratingSum: 19 });
    await createTrack(kidA.id, { title: 'Everything in Its Right Place', trackNumber: 1 });

    const res = await request(app).get(`/api/artists/${artist.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      name: 'Radiohead',
      bio: 'English rock band.',
      ratingCount: 4,
      ratingAverage: 8.8,
      genres: ['alternative rock', 'rock'],
    });
    expect(res.body.albums.map((album) => [album.title, album.trackCount])).toEqual([
      ['OK Computer', 2],
      ['Kid A', 1],
    ]);
    expect(res.body.topTracks.map((track) => [track.title, track.ratingAverage, track.album.title])).toEqual([
      ['Paranoid Android', 9.5, 'OK Computer'],
      ['Airbag', 8, 'OK Computer'],
    ]);
  });

  it('reports no average and empty lists for a new artist', async () => {
    const artist = await createArtist();

    const res = await request(app).get(`/api/artists/${artist.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ratingCount: 0, ratingAverage: null, genres: [], albums: [], topTracks: [] });
  });

  it.each(['999', 'abc', '0', '1.5'])('returns 404 for id "%s"', async (id) => {
    const res = await request(app).get(`/api/artists/${id}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Artist not found' } });
  });
});

describe('GET /api/albums/:id', () => {
  it('returns the album with its artist and tracklist in disc order', async () => {
    const artist = await createArtist({ name: 'The Beatles' });
    const album = await createAlbum(artist.id, { title: 'The Beatles', releaseYear: 1968, ratingCount: 1, ratingSum: 9 });
    await createTrack(album.id, { title: 'Birthday', discNumber: 2, trackNumber: 1 });
    await createTrack(album.id, { title: 'Dear Prudence', discNumber: 1, trackNumber: 2 });
    await createTrack(album.id, { title: 'Back in the U.S.S.R.', discNumber: 1, trackNumber: 1, durationMs: 163000 });

    const res = await request(app).get(`/api/albums/${album.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: 'The Beatles',
      releaseYear: 1968,
      ratingAverage: 9,
      artist: { id: artist.id, name: 'The Beatles' },
    });
    expect(res.body.tracks.map((track) => [track.discNumber, track.trackNumber, track.title])).toEqual([
      [1, 1, 'Back in the U.S.S.R.'],
      [1, 2, 'Dear Prudence'],
      [2, 1, 'Birthday'],
    ]);
    expect(res.body.tracks[0]).toMatchObject({ durationMs: 163000, ratingCount: 0, ratingAverage: null });
  });

  it('returns 404 for a missing album', async () => {
    const res = await request(app).get('/api/albums/42');

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Album not found' });
  });
});

describe('GET /api/tracks/:id', () => {
  it('returns the track with its album and artist', async () => {
    const artist = await createArtist({ name: 'Daft Punk' });
    const album = await createAlbum(artist.id, { title: 'Discovery', releaseYear: 2001, coverUrl: 'https://example.com/discovery.jpg' });
    const track = await createTrack(album.id, { title: 'One More Time', trackNumber: 1, durationMs: 320000, ratingCount: 3, ratingSum: 26 });

    const res = await request(app).get(`/api/tracks/${track.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: 'One More Time',
      durationMs: 320000,
      ratingCount: 3,
      ratingAverage: 8.7,
      album: { id: album.id, title: 'Discovery', releaseYear: 2001, coverUrl: 'https://example.com/discovery.jpg' },
      artist: { id: artist.id, name: 'Daft Punk' },
    });
  });

  it('returns 404 for a missing track', async () => {
    const res = await request(app).get('/api/tracks/42');

    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Track not found' });
  });
});
