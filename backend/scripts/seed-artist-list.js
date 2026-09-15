// Builds seed/artists.json: the ~200 most-listened artists on ListenBrainz, with their
// MusicBrainz ids. The output is committed, so seeding is reproducible without re-running this.
const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('../src/config');
const { createClient, requireUserAgent } = require('../seed/http');

const OUTPUT_FILE = path.resolve(__dirname, '../seed/artists.json');
const TARGET_COUNT = 200;
// Fetch extra, so there are still enough after dropping entries without an id and duplicates.
const FETCH_COUNT = 300;
const VARIOUS_ARTISTS_MBID = '89ad4ac3-39f7-470e-963a-56509c546377';

// MusicBrainz placeholder artists are named in square brackets, like "[unknown]".
const isPlaceholder = (entry) => entry.artist_mbid === VARIOUS_ARTISTS_MBID || /^\[.*\]$/.test(entry.artist_name);

async function main() {
  const listenBrainz = createClient({
    userAgent: requireUserAgent(config.seed.userAgent),
    minIntervalMs: 1000,
    log: (message) => console.log(`  ${message}`),
  });

  const url = `https://api.listenbrainz.org/1/stats/sitewide/artists?count=${FETCH_COUNT}&range=all_time`;
  const data = await listenBrainz.getJson(url);
  const entries = data?.payload?.artists ?? [];

  const seen = new Set();
  const artists = [];
  for (const entry of entries) {
    if (!entry.artist_mbid || seen.has(entry.artist_mbid) || isPlaceholder(entry)) continue;
    seen.add(entry.artist_mbid);
    artists.push({ mbid: entry.artist_mbid, name: entry.artist_name });
    if (artists.length === TARGET_COUNT) break;
  }

  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(artists, null, 2)}\n`);
  console.log(`Wrote ${artists.length} artists (from ${entries.length} ListenBrainz entries) to seed/artists.json`);
  if (artists.length < TARGET_COUNT) console.log(`Warning: expected ${TARGET_COUNT} artists.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
