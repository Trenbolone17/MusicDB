// Builds the artist lists the catalog seed reads. The outputs are committed, so seeding is
// reproducible without re-running this.
//
//   npm run seed:artist-list                              English: seed/artists.json from ListenBrainz
//   npm run seed:artist-list -- --count 500               ...with more artists (up to 1000)
//   npm run seed:artist-list -- --list malayalam          Malayalam: seed/artists-malayalam.json
//
// The English list is ListenBrainz's most-listened artists, which skews to Western music.
// The Malayalam list combines seed/malayalam-names.json (well-known composers and bands,
// resolved to MusicBrainz ids by name) with MusicBrainz artists from Kerala that have at least
// two albums or EPs, so film-music composers turn up even when nobody has tagged them. The
// same file's "exclude" list drops Kerala-area artists that qualify but aren't music acts.
const fs = require('node:fs/promises');
const path = require('node:path');
const { parseArgs } = require('node:util');
const config = require('../src/config');
const { createClient, requireUserAgent } = require('../seed/http');
const { createMusicBrainz } = require('../seed/musicbrainz');
const { PROFILES } = require('../seed/profiles');
const transform = require('../seed/transform');

const SEED_DIR = path.resolve(__dirname, '../seed');
const VARIOUS_ARTISTS_MBID = '89ad4ac3-39f7-470e-963a-56509c546377';
const MIN_KERALA_ALBUMS = 2;

// MusicBrainz placeholder artists are named in square brackets, like "[unknown]".
const isPlaceholder = (mbid, name) => mbid === VARIOUS_ARTISTS_MBID || /^\[.*\]$/.test(name);

async function writeList(file, artists) {
  await fs.writeFile(path.join(SEED_DIR, file), `${JSON.stringify(artists, null, 2)}\n`);
  console.log(`Wrote ${artists.length} artists to seed/${file}`);
}

async function buildEnglishList(userAgent, count) {
  const listenBrainz = createClient({ userAgent, minIntervalMs: 1000, log: (m) => console.log(`  ${m}`) });
  // Fetch extra, so there are still enough after dropping entries without an id and duplicates.
  const fetchCount = Math.min(1000, Math.ceil(count * 1.2));
  const data = await listenBrainz.getJson(
    `https://api.listenbrainz.org/1/stats/sitewide/artists?count=${fetchCount}&range=all_time`,
  );
  const entries = data?.payload?.artists ?? [];

  const seen = new Set();
  const artists = [];
  for (const entry of entries) {
    if (!entry.artist_mbid || seen.has(entry.artist_mbid) || isPlaceholder(entry.artist_mbid, entry.artist_name)) continue;
    seen.add(entry.artist_mbid);
    artists.push({ mbid: entry.artist_mbid, name: entry.artist_name });
    if (artists.length === count) break;
  }
  if (artists.length < count) console.log(`Warning: only ${artists.length} of ${count} artists available.`);
  return artists;
}

// Does a MusicBrainz search hit look like the Indian artist we mean, not a namesake elsewhere?
const INDIAN = /kerala|india|malayalam|tamil|kochi|cochin|thiruvananthapuram|trivandrum|chennai|mumbai|bangalore|bengaluru|karnataka/i;
function looksIndian(artist) {
  return (
    artist.country === 'IN' ||
    INDIAN.test(artist.area?.name ?? '') ||
    INDIAN.test(artist['begin-area']?.name ?? '') ||
    INDIAN.test(artist.disambiguation ?? '')
  );
}

async function buildMalayalamList(userAgent) {
  const musicBrainz = createMusicBrainz(
    createClient({ userAgent, minIntervalMs: 1100, maxAttempts: 10, log: (m) => console.log(`  ${m}`) }),
  );
  const { include: names, exclude } = require(path.join(SEED_DIR, 'malayalam-names.json'));
  const excluded = new Set(exclude.map((name) => name.toLowerCase()));
  const artists = [];
  const seen = new Set();
  const add = (artist, note) => {
    if (seen.has(artist.id) || isPlaceholder(artist.id, artist.name)) return;
    seen.add(artist.id);
    artists.push({ mbid: artist.id, name: artist.name });
    console.log(`  + ${artist.name}${artist.disambiguation ? ` [${artist.disambiguation}]` : ''} (${note})`);
  };

  console.log(`Resolving ${names.length} well-known names...`);
  const unresolved = [];
  for (const name of names) {
    const { artists: hits } = await musicBrainz.searchArtists(`artist:"${name.replaceAll('"', '')}"`, 8);
    // Prefer an Indian match; otherwise accept only an exact-name top hit and say so.
    const match = hits.find(looksIndian) ?? hits.find((hit) => hit.score === 100 && hit.name.toLowerCase() === name.toLowerCase());
    if (!match) {
      unresolved.push(name);
      console.log(`  ? ${name}: no confident match`);
      continue;
    }
    add(match, looksIndian(match) ? 'by name' : 'by name, unverified area');
  }

  console.log('Scanning MusicBrainz artists from Kerala...');
  const kerala = [];
  for (let offset = 0; ; offset += 100) {
    const { count, artists: page } = await musicBrainz.searchArtists('area:Kerala OR beginarea:Kerala', 100, offset);
    kerala.push(...page);
    if (kerala.length >= count || page.length === 0) break;
  }
  const profile = PROFILES.malayalam;
  for (const artist of kerala) {
    if (seen.has(artist.id) || !['Person', 'Group'].includes(artist.type)) continue;
    if (excluded.has(artist.name.toLowerCase())) continue;
    // One browse per artist: keep those with a real body of albums or EPs, which drops the
    // actors, lyricists, and one-single acts the area search also returns.
    const groups = await musicBrainz.browseAlbumGroups(artist.id, profile.browseTypes);
    const qualifying = transform.rankAlbumCandidates(groups, profile).length;
    if (qualifying >= MIN_KERALA_ALBUMS) add(artist, `${qualifying} albums/EPs, from Kerala`);
  }

  if (unresolved.length > 0) console.log(`Not found on MusicBrainz (check spelling): ${unresolved.join(', ')}`);
  return artists;
}

async function main() {
  const { values } = parseArgs({
    options: {
      list: { type: 'string', default: 'english' },
      count: { type: 'string', default: '200' },
    },
  });
  const profile = PROFILES[values.list];
  if (!profile) throw new Error(`--list must be one of: ${Object.keys(PROFILES).join(', ')}`);
  const count = Number(values.count);
  if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('--count must be between 1 and 1000');

  const userAgent = requireUserAgent(config.seed.userAgent);
  const artists = values.list === 'malayalam' ? await buildMalayalamList(userAgent) : await buildEnglishList(userAgent, count);
  await writeList(profile.list, artists);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
