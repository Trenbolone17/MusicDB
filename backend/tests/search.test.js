const request = require('supertest');
const { createTestApp, resetDatabase, createArtist, createAlbum, createTrack } = require('./setup/helpers');

const app = createTestApp();

const search = (params) => request(app).get('/api/search').query(params);

describe('GET /api/search', () => {
  beforeEach(async () => {
    await resetDatabase();
    const radiohead = await createArtist({ name: 'Radiohead', ratingCount: 3, ratingSum: 27 });
    const okComputer = await createAlbum(radiohead.id, { title: 'OK Computer', releaseYear: 1997 });
    await createTrack(okComputer.id, { title: 'Airbag', trackNumber: 1 });
    await createTrack(okComputer.id, { title: 'Paranoid Android', trackNumber: 2, ratingCount: 1, ratingSum: 9 });
    await createTrack(okComputer.id, { title: 'Karma Police', trackNumber: 6 });
    const bjork = await createArtist({ name: 'Björk' });
    await createAlbum(bjork.id, { title: 'Homogenic', releaseYear: 1997 });
    const portishead = await createArtist({ name: 'Portishead' });
    await createAlbum(portishead.id, { title: 'Dummy', releaseYear: 1994 });
  });

  it('groups results by type with an exact match first', async () => {
    const res = await search({ q: 'Radiohead' });

    expect(res.status).toBe(200);
    expect(res.body.query).toBe('Radiohead');
    expect(res.body.artists.items[0]).toMatchObject({ name: 'Radiohead', ratingCount: 3, ratingAverage: 9 });
    expect(res.body.albums).toEqual({ items: [], total: 0 });
    expect(res.body.tracks).toEqual({ items: [], total: 0 });
  });

  it('tolerates typos through trigram similarity', async () => {
    const res = await search({ q: 'radiohed' });

    expect(res.body.artists.items.map((artist) => artist.name)).toEqual(['Radiohead']);
  });

  it('ignores accents in both the query and the data', async () => {
    expect((await search({ q: 'bjork' })).body.artists.items[0].name).toBe('Björk');
    expect((await search({ q: 'Björk' })).body.artists.items[0].name).toBe('Björk');
  });

  it('matches word prefixes while the user is still typing', async () => {
    const res = await search({ q: 'para' });

    expect(res.body.tracks.items.map((track) => track.title)).toEqual(['Paranoid Android']);
    expect(res.body.tracks.items[0]).toMatchObject({ artist: { name: 'Radiohead' }, album: { title: 'OK Computer' } });
  });

  it('matches word prefixes across several words', async () => {
    expect((await search({ q: 'karma pol' })).body.tracks.items.map((track) => track.title)).toEqual(['Karma Police']);
  });

  it('caps each group at five but reports the full total', async () => {
    const artist = await createArtist({ name: 'Prolific' });
    const album = await createAlbum(artist.id, { title: 'Numbers' });
    for (let n = 1; n <= 7; n += 1) await createTrack(album.id, { title: `Number ${n}`, trackNumber: n });

    const res = await search({ q: 'number' });

    expect(res.body.tracks.items).toHaveLength(5);
    expect(res.body.tracks.total).toBe(7);
  });

  it('pages a single type', async () => {
    const artist = await createArtist({ name: 'Prolific' });
    const album = await createAlbum(artist.id, { title: 'Numbers' });
    for (let n = 1; n <= 27; n += 1) await createTrack(album.id, { title: `Number ${n}`, trackNumber: n });

    const first = await search({ q: 'number', type: 'tracks' });
    const second = await search({ q: 'number', type: 'tracks', page: 2 });

    expect(first.body).toMatchObject({ type: 'tracks', page: 1, pageSize: 25, total: 27 });
    expect(first.body.items).toHaveLength(25);
    expect(second.body.items).toHaveLength(2);
  });

  it('finds songs by their performers, so film songs turn up under the singer', async () => {
    const composer = await createArtist({ name: 'Sushin Shyam' });
    const soundtrack = await createAlbum(composer.id, { title: 'Kumbalangi Nights' });
    await createTrack(soundtrack.id, { title: 'Cherathukal', trackNumber: 1, credit: 'Sithara Krishnakumar' });
    await createTrack(soundtrack.id, { title: 'Uyiril Thodum', trackNumber: 2, credit: 'Sooraj Santhosh & Anne Amie' });

    expect((await search({ q: 'sithara' })).body.tracks.items.map((track) => track.title)).toEqual(['Cherathukal']);
    expect((await search({ q: 'anne amie' })).body.tracks.items.map((track) => track.title)).toEqual(['Uyiril Thodum']);
    expect((await search({ q: 'sitara' })).body.tracks.items.map((track) => track.title)).toEqual(['Cherathukal']);
    expect((await search({ q: 'cherathukal' })).body.tracks.items[0]).toMatchObject({ credit: 'Sithara Krishnakumar', artist: { name: 'Sushin Shyam' } });
  });

  it('returns nothing for a query that matches nothing', async () => {
    const res = await search({ q: 'xyzzy plugh' });

    expect(res.body.artists.items).toEqual([]);
    expect(res.body.albums.items).toEqual([]);
    expect(res.body.tracks.items).toEqual([]);
  });

  it('copes with punctuation-only queries', async () => {
    const res = await search({ q: '!!!' });

    expect(res.status).toBe(200);
    expect(res.body.tracks.items).toEqual([]);
  });

  it('rejects a missing query or an unknown type', async () => {
    const missing = await search({});
    expect(missing.status).toBe(400);
    expect(missing.body.error.details.fields).toHaveProperty('q');

    const badType = await search({ q: 'radio', type: 'songs' });
    expect(badType.status).toBe(400);
    expect(badType.body.error.details.fields).toHaveProperty('type');
  });
});
