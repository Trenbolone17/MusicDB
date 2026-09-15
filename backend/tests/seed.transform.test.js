const {
  releaseYear,
  rankAlbumCandidates,
  addDistinctAlbum,
  pickCanonicalRelease,
  tracksFromRelease,
  coverUrl,
  wikidataId,
  genresFrom,
} = require('../seed/transform');

// Fixtures are trimmed-down versions of real MusicBrainz responses for Radiohead and OK Computer.
const group = (title, votes, date, secondaryTypes = []) => ({
  id: `rg-${title}`,
  title,
  'primary-type': 'Album',
  'secondary-types': secondaryTypes,
  'first-release-date': date,
  rating: { 'votes-count': votes },
});

const track = (position, title, length) => ({
  position,
  title,
  length,
  recording: { id: `rec-${title}`, title, length },
});

const medium = (position, format, tracks) => ({ position, format, 'track-count': tracks.length, tracks });

const release = (id, date, { front = false, media } = {}) => ({
  id,
  date,
  status: 'Official',
  'cover-art-archive': { front },
  media: media ?? [medium(1, 'CD', [track(1, 'Airbag', 284400)])],
});

describe('rankAlbumCandidates', () => {
  const groups = [
    group('Radiotick Tracks 2', 0, '1997'),
    group('I Might Be Wrong: Live Recordings', 11, '2001-11-07', ['Live']),
    group('The Best Of', 6, '2008-05-28', ['Compilation']),
    group('Help!', 70, '1965-08-06', ['Soundtrack']),
    group('Pablo Honey', 58, '1993-02-22'),
    group('OK Computer', 88, '1997-05-21'),
    group('So Far Gone', 30, '2009-02-13', ['Mixtape/Street']),
  ];

  it('keeps albums, soundtracks, and mixtapes, best-known first', () => {
    expect(rankAlbumCandidates(groups).map((g) => g.title)).toEqual([
      'OK Computer',
      'Help!',
      'Pablo Honey',
      'So Far Gone',
      'Radiotick Tracks 2',
    ]);
  });

  it('breaks vote ties by release date, with missing dates last', () => {
    const tied = [group('Undated', 0, ''), group('Later', 0, '2005'), group('Earlier', 0, '1999-03-01')];
    expect(rankAlbumCandidates(tied).map((g) => g.title)).toEqual(['Earlier', 'Later', 'Undated']);
  });
});

describe('addDistinctAlbum', () => {
  const album = (title, date, recordingIds) => ({
    title,
    firstReleaseDate: date,
    tracks: recordingIds.map((mbid, index) => ({ mbid, trackNumber: index + 1 })),
  });
  const pleasePleaseMe = album('Please Please Me', '1963-03-22', ['r1', 'r2', 'r3', 'r4']);
  const introducing = album('Introducing… The Beatles', '1964-01-10', ['r1', 'r2', 'r3', 'r5']);
  const revolver = album('Revolver', '1966-08-05', ['r6', 'r7']);
  const titles = (albums) => albums.map((a) => a.title);

  it('keeps albums that share no recordings', () => {
    expect(titles(addDistinctAlbum([pleasePleaseMe], revolver))).toEqual(['Please Please Me', 'Revolver']);
  });

  it('skips a later edition of an album already kept', () => {
    expect(titles(addDistinctAlbum([pleasePleaseMe], introducing))).toEqual(['Please Please Me']);
  });

  it('swaps a kept edition for the earlier original', () => {
    expect(titles(addDistinctAlbum([introducing, revolver], pleasePleaseMe))).toEqual(['Please Please Me', 'Revolver']);
  });

  it('keeps re-recorded albums, which share no recordings with the original', () => {
    const original = album('Fearless', '2008-11-11', ['f1', 'f2']);
    const rerecorded = album('Fearless (Taylor’s Version)', '2021-04-09', ['t1', 't2']);
    expect(addDistinctAlbum([original], rerecorded)).toHaveLength(2);
  });
});

describe('pickCanonicalRelease', () => {
  it('picks the earliest release, counting a year-only date as the end of that year', () => {
    const releases = [release('us', '1997-07-01'), release('year-only', '1997'), release('jp', '1997-05-21')];
    expect(pickCanonicalRelease(releases).id).toBe('jp');
  });

  it('prefers a release with front cover art when dates tie', () => {
    const releases = [release('plain', '1997-06-16'), release('with-art', '1997-06-16', { front: true })];
    expect(pickCanonicalRelease(releases).id).toBe('with-art');
  });

  it('ignores releases that are video-only or have no tracklist', () => {
    const dvdOnly = release('dvd', '1990-01-01', { media: [medium(1, 'DVD-Video', [track(1, 'Live', 1000)])] });
    const noTracks = release('empty', '1991-01-01', { media: [{ position: 1, format: 'CD', 'track-count': 12 }] });

    expect(pickCanonicalRelease([dvdOnly, noTracks, release('cd', '1997-05-21')]).id).toBe('cd');
    expect(pickCanonicalRelease([dvdOnly, noTracks])).toBeNull();
  });
});

describe('tracksFromRelease', () => {
  it('maps audio tracks to rows and skips video media', () => {
    const deluxe = release('collectors-edition', '2009-03-24', {
      media: [
        medium(1, 'CD', [
          track(1, 'Airbag', 284400),
          { position: 2, title: 'Paranoid Android', length: null, recording: { id: 'rec-pa', title: 'Paranoid Android', length: 387000 } },
        ]),
        medium(2, 'CD', [{ position: 1, title: 'Polyethylene', length: 0, recording: { id: 'rec-poly', title: 'Polyethylene (Parts 1 & 2)' } }]),
        medium(3, 'DVD-Video', [track(1, 'Karma Police (video)', 264000)]),
      ],
    });

    expect(tracksFromRelease(deluxe)).toEqual([
      { mbid: 'rec-Airbag', title: 'Airbag', discNumber: 1, trackNumber: 1, durationMs: 284400 },
      { mbid: 'rec-pa', title: 'Paranoid Android', discNumber: 1, trackNumber: 2, durationMs: 387000 },
      { mbid: 'rec-poly', title: 'Polyethylene (Parts 1 & 2)', discNumber: 2, trackNumber: 1, durationMs: null },
    ]);
  });
});

describe('small helpers', () => {
  it('builds a Cover Art Archive URL only when some release has front art', () => {
    const withArt = [release('a', '1997'), release('b', '1997', { front: true })];
    expect(coverUrl('rg1', withArt)).toBe('https://coverartarchive.org/release-group/rg1/front-500');
    expect(coverUrl('rg1', [release('a', '1997')])).toBeNull();
  });

  it('reads the year from full, partial, and missing dates', () => {
    expect([releaseYear('1997-05-21'), releaseYear('1997'), releaseYear(''), releaseYear(undefined)]).toEqual([
      1997,
      1997,
      null,
      null,
    ]);
  });

  it('extracts the Wikidata id from url relations', () => {
    const relations = [
      { type: 'allmusic', url: { resource: 'https://www.allmusic.com/artist/radiohead-mn0000326249' } },
      { type: 'wikidata', url: { resource: 'https://www.wikidata.org/wiki/Q44190' } },
    ];
    expect(wikidataId(relations)).toBe('Q44190');
    expect(wikidataId([])).toBeNull();
    expect(wikidataId(undefined)).toBeNull();
  });

  it('keeps only genres that have votes', () => {
    const artist = { genres: [{ name: 'alternative rock', count: 42 }, { name: 'britpop', count: 0 }] };
    expect(genresFrom(artist)).toEqual([{ name: 'alternative rock', votes: 42 }]);
  });
});
