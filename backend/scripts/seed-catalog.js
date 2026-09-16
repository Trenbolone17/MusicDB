// Imports artists, their albums, and tracks from MusicBrainz, plus bios and images from
// Wikipedia, for the artists in a seed list.
//
//   npm run seed:catalog                          the English list, every artist not seeded yet
//   npm run seed:catalog -- --list malayalam      the Malayalam list (composers, bands; EPs too)
//   npm run seed:catalog -- --artists 10          only the first 10 in the list
//   npm run seed:catalog -- --only "Sushin Shyam,Gopi Sundar"   only these names from the list
//   npm run seed:catalog -- --refresh             re-fetch artists that were already seeded
//
// Each artist is written in one transaction, so stopping with Ctrl+C never leaves a
// half-imported artist, and re-running picks up where it stopped.
const path = require('node:path');
const { parseArgs } = require('node:util');
const config = require('../src/config');
const { pool, query, withTransaction } = require('../src/db');
const { createClient, requireUserAgent } = require('../seed/http');
const { createMusicBrainz } = require('../seed/musicbrainz');
const { createWikipedia } = require('../seed/wikipedia');
const { PROFILES } = require('../seed/profiles');
const transform = require('../seed/transform');
const { saveArtistCatalog } = require('../seed/catalogStore');

// MusicBrainz allows about one request per second; leave a little headroom.
const MUSICBRAINZ_INTERVAL_MS = 1100;
// MusicBrainz 503s are frequent but temporary, and one request giving up throws away
// everything already fetched for that artist, so be more patient than the default.
const MUSICBRAINZ_MAX_ATTEMPTS = 10;
const WIKIMEDIA_INTERVAL_MS = 250;
// Candidates to look at beyond the cap, to make up for regional editions that turn out to
// be copies of albums already kept.
const EXTRA_ALBUM_CANDIDATES = 6;

function formatDuration(ms) {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return `${Math.round(ms / 1000)}s`;
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

async function seededMbids(mbids) {
  const { rows } = await query('SELECT mbid FROM artists WHERE seeded_at IS NOT NULL AND mbid = ANY($1::uuid[])', [
    mbids,
  ]);
  return new Set(rows.map((row) => row.mbid));
}

// Walks the ranked candidates, fetching each one's releases, until `maxAlbums` distinct
// albums are kept. Bootlegs (no official release) and duplicate editions are skipped.
async function fetchAlbums(artistMbid, { musicBrainz, profile, maxAlbums }) {
  const candidates = transform
    .rankAlbumCandidates(await musicBrainz.browseAlbumGroups(artistMbid, profile.browseTypes), profile)
    .slice(0, maxAlbums + EXTRA_ALBUM_CANDIDATES);

  let kept = [];
  for (const group of candidates) {
    if (kept.length === maxAlbums) break;
    const releases = await musicBrainz.browseOfficialReleases(group.id);
    const release = transform.pickCanonicalRelease(releases);
    if (!release || !transform.albumAllowed(group, release, profile)) continue;

    kept = transform.addDistinctAlbum(kept, {
      mbid: group.id,
      releaseMbid: release.id,
      title: group.title,
      firstReleaseDate: group['first-release-date'],
      releaseYear: transform.releaseYear(group['first-release-date']),
      coverUrl: transform.coverUrl(group.id, releases),
      tracks: transform.tracksFromRelease(release, artistMbid),
    });
  }
  return kept;
}

// Fetches everything for one artist before touching the database, so the write is one short
// transaction. Returns null if the artist turns out to be seeded already under a merged id.
async function fetchArtistCatalog(listed, sources, refresh) {
  const mbArtist = await sources.musicBrainz.lookupArtist(listed.mbid);
  if (!mbArtist) throw new Error('not found on MusicBrainz');

  // Merged artists redirect to their new id, which may already be in the database.
  if (!refresh && mbArtist.id !== listed.mbid && (await seededMbids([mbArtist.id])).size > 0) return null;

  const wikidata = transform.wikidataId(mbArtist.relations);
  // A failed Wikipedia lookup shouldn't cost the whole artist; save it without a bio instead.
  const summaryPromise = wikidata
    ? sources.wikipedia.summaryFor(wikidata).catch((err) => ({ error: err }))
    : Promise.resolve(null);

  const [summaryResult, albums] = await Promise.all([summaryPromise, fetchAlbums(mbArtist.id, sources)]);
  const bioFailed = Boolean(summaryResult?.error);
  const summary = bioFailed ? null : summaryResult;

  return {
    bioFailed,
    artist: {
      mbid: mbArtist.id,
      name: mbArtist.name,
      sortName: mbArtist['sort-name'] ?? null,
      disambiguation: mbArtist.disambiguation || null,
      type: mbArtist.type ?? null,
      country: mbArtist.country ?? null,
      bio: summary?.bio ?? null,
      wikipediaUrl: summary?.wikipediaUrl ?? null,
      imageUrl: summary?.imageUrl ?? null,
    },
    genres: transform.genresFrom(mbArtist),
    albums,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      list: { type: 'string', default: 'english' },
      artists: { type: 'string' },
      only: { type: 'string' },
      refresh: { type: 'boolean', default: false },
    },
  });
  const profile = PROFILES[values.list];
  if (!profile) throw new Error(`--list must be one of: ${Object.keys(PROFILES).join(', ')}`);
  let artistList = require(path.join('../seed', profile.list));

  if (values.only) {
    const wanted = new Set(values.only.split(',').map((name) => name.trim().toLowerCase()).filter(Boolean));
    artistList = artistList.filter((artist) => wanted.has(artist.name.toLowerCase()));
    const found = new Set(artistList.map((artist) => artist.name.toLowerCase()));
    const missing = [...wanted].filter((name) => !found.has(name));
    if (missing.length > 0) throw new Error(`Not in the ${values.list} list: ${missing.join(', ')}`);
  }

  const limit = values.artists === undefined ? artistList.length : Number(values.artists);
  if (!Number.isInteger(limit) || limit < 1) throw new Error('--artists must be a positive whole number');

  const userAgent = requireUserAgent(config.seed.userAgent);
  const logRetry = (message) => console.log(`    ${message}`);
  const sources = {
    musicBrainz: createMusicBrainz(
      createClient({
        userAgent,
        minIntervalMs: MUSICBRAINZ_INTERVAL_MS,
        maxAttempts: MUSICBRAINZ_MAX_ATTEMPTS,
        log: logRetry,
      }),
    ),
    wikipedia: createWikipedia(createClient({ userAgent, minIntervalMs: WIKIMEDIA_INTERVAL_MS, log: logRetry })),
    profile,
    maxAlbums: profile.maxAlbums ?? config.seed.maxAlbumsPerArtist,
  };

  const selected = artistList.slice(0, limit);
  const alreadySeeded = values.refresh ? new Set() : await seededMbids(selected.map((artist) => artist.mbid));
  const todo = selected.filter((artist) => !alreadySeeded.has(artist.mbid));
  console.log(
    `${values.list} list: ${todo.length} to seed, ${selected.length - todo.length} already seeded` +
      `${values.refresh ? ' (refresh)' : ''}. Safe to stop with Ctrl+C; re-run to resume.`,
  );

  const started = Date.now();
  const failed = [];
  const withoutBio = [];
  for (const [index, listed] of todo.entries()) {
    const label = `[${String(index + 1).padStart(String(todo.length).length)}/${todo.length}] ${listed.name}`;
    try {
      const catalog = await fetchArtistCatalog(listed, sources, values.refresh);
      if (!catalog) {
        console.log(`${label}: already seeded under its merged MusicBrainz id, skipped`);
        continue;
      }
      await withTransaction((client) => saveArtistCatalog(client, catalog));
      if (catalog.bioFailed) withoutBio.push(listed.name);

      const trackCount = catalog.albums.reduce((sum, album) => sum + album.tracks.length, 0);
      const elapsed = Date.now() - started;
      const remaining = (elapsed / (index + 1)) * (todo.length - index - 1);
      console.log(
        `${label}: ${catalog.albums.length} albums, ${trackCount} tracks, bio ${catalog.artist.bio ? 'yes' : 'no'}` +
          ` (${formatDuration(elapsed)} elapsed, ~${formatDuration(remaining)} left)`,
      );
    } catch (err) {
      failed.push(listed.name);
      console.log(`${label}: FAILED, ${err.message}`);
    }
  }

  const { rows } = await query(
    'SELECT (SELECT count(*) FROM artists) AS artists, (SELECT count(*) FROM albums) AS albums, (SELECT count(*) FROM tracks) AS tracks',
  );
  console.log(`\nFinished in ${formatDuration(Date.now() - started)}: ${todo.length - failed.length} seeded, ${failed.length} failed.`);
  console.log(`Catalog now has ${rows[0].artists} artists, ${rows[0].albums} albums, ${rows[0].tracks} tracks.`);
  if (withoutBio.length > 0) {
    console.log(`Saved without a bio because Wikipedia requests failed: ${withoutBio.join(', ')}. Re-run with --refresh to retry.`);
  }
  if (failed.length > 0) {
    console.log(`Failed: ${failed.join(', ')}. Re-run the same command to retry them.`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
