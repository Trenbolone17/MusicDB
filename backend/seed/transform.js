// Pure functions that turn MusicBrainz responses into catalog rows. No I/O, so they're unit-tested.

const VIDEO_FORMAT = /dvd|blu-ray|vhs|video/i;

const positiveOrNull = (value) => (Number.isInteger(value) && value > 0 ? value : null);

// "1997-05-21" and "1997" give 1997; an empty or missing date gives null.
function releaseYear(date) {
  const year = Number.parseInt(date?.slice(0, 4), 10);
  return Number.isInteger(year) ? year : null;
}

// Sort key for MusicBrainz dates, which may be partial. A year-only date sorts as the end of
// that year, so an exact date in the same year wins. Missing dates sort after everything.
function dateSortKey(date) {
  if (!date) return '9999-12-31';
  const [year, month = '12', day = '31'] = date.split('-');
  return `${year}-${month}-${day}`;
}

// Secondary types that still count as a proper album. Soundtracks (A Hard Day's Night,
// Purple Rain) and mixtapes are core releases for many artists; live albums,
// compilations, remixes, demos, and interviews are not.
const ALBUM_SECONDARY_TYPES = new Set(['Soundtrack', 'Mixtape/Street']);

// Album release groups worth importing, best-known first by MusicBrainz rating votes, then
// oldest first. The seed walks this list until it has enough distinct albums.
function rankAlbumCandidates(releaseGroups) {
  return releaseGroups
    .filter(
      (group) =>
        group['primary-type'] === 'Album' &&
        (group['secondary-types'] ?? []).every((type) => ALBUM_SECONDARY_TYPES.has(type)),
    )
    .sort(
      (a, b) =>
        (b.rating?.['votes-count'] ?? 0) - (a.rating?.['votes-count'] ?? 0) ||
        dateSortKey(a['first-release-date']).localeCompare(dateSortKey(b['first-release-date'])) ||
        a.id.localeCompare(b.id),
    );
}

// Two albums are editions of each other (say, a US version of a UK album) when at least
// half the tracks of the shorter one are the same recordings.
function isSameAlbum(a, b) {
  if (a.tracks.length === 0 || b.tracks.length === 0) return false;
  const recordings = new Set(a.tracks.map((track) => track.mbid));
  const shared = b.tracks.filter((track) => recordings.has(track.mbid)).length;
  return shared >= Math.min(a.tracks.length, b.tracks.length) / 2;
}

// Returns `kept` plus `album`, unless album is an edition of one already kept. Of two
// editions, the one released first wins, since it's normally the original.
function addDistinctAlbum(kept, album) {
  const index = kept.findIndex((other) => isSameAlbum(other, album));
  if (index === -1) return [...kept, album];
  if (dateSortKey(album.firstReleaseDate) < dateSortKey(kept[index].firstReleaseDate)) {
    return kept.map((other, i) => (i === index ? album : other));
  }
  return kept;
}

// Media we can build a tracklist from: not video, and with tracks listed.
function audioMedia(release) {
  return (release.media ?? []).filter(
    (medium) => !VIDEO_FORMAT.test(medium.format ?? '') && (medium.tracks ?? []).length > 0,
  );
}

// The release whose tracklist represents the album: the earliest official one with audio
// tracks. Ties prefer front cover art, then fewer media (so not a box set). Null if none.
function pickCanonicalRelease(releases) {
  const candidates = releases.filter((release) => release.status === 'Official' && audioMedia(release).length > 0);
  const hasFront = (release) => (release['cover-art-archive']?.front ? 1 : 0);
  candidates.sort(
    (a, b) =>
      dateSortKey(a.date).localeCompare(dateSortKey(b.date)) ||
      hasFront(b) - hasFront(a) ||
      audioMedia(a).length - audioMedia(b).length ||
      a.id.localeCompare(b.id),
  );
  return candidates[0] ?? null;
}

// One row per track on the release's audio media. A track is keyed by its recording id.
function tracksFromRelease(release) {
  return audioMedia(release).flatMap((medium) =>
    medium.tracks
      .filter((track) => track.recording?.id)
      .map((track) => ({
        mbid: track.recording.id,
        title: track.recording.title || track.title,
        discNumber: medium.position ?? 1,
        trackNumber: track.position,
        durationMs: positiveOrNull(track.length) ?? positiveOrNull(track.recording.length),
      })),
  );
}

// Cover Art Archive URL for an album, when any of its releases has front art. The browser
// fetches the image on demand, so seeding never waits on the archive.
function coverUrl(releaseGroupMbid, releases) {
  const hasFront = releases.some((release) => release['cover-art-archive']?.front);
  return hasFront ? `https://coverartarchive.org/release-group/${releaseGroupMbid}/front-500` : null;
}

// "https://www.wikidata.org/wiki/Q44190" in the artist's url relations gives "Q44190".
function wikidataId(relations) {
  const relation = (relations ?? []).find((rel) => rel.type === 'wikidata');
  return relation?.url?.resource?.match(/\/(Q\d+)$/)?.[1] ?? null;
}

// Genres with at least one MusicBrainz vote.
function genresFrom(artist) {
  return (artist.genres ?? [])
    .filter((genre) => genre.count > 0)
    .map((genre) => ({ name: genre.name, votes: genre.count }));
}

module.exports = {
  releaseYear,
  rankAlbumCandidates,
  addDistinctAlbum,
  pickCanonicalRelease,
  tracksFromRelease,
  coverUrl,
  wikidataId,
  genresFrom,
};
