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

// Album release groups worth importing under a profile (see profiles.js): the right primary
// type, no disallowed secondary type. Best-known first by MusicBrainz rating votes, then by
// date in the profile's direction. The seed walks this list until it has enough distinct albums.
function rankAlbumCandidates(releaseGroups, profile) {
  const allowedSecondary = new Set(profile.secondaryTypes);
  const byDate = (a, b) => {
    const order = dateSortKey(a['first-release-date']).localeCompare(dateSortKey(b['first-release-date']));
    // Missing dates always go last, whichever direction the profile sorts in.
    if (!a['first-release-date'] || !b['first-release-date']) return order;
    return profile.tieBreak === 'newest' ? -order : order;
  };
  return releaseGroups
    .filter(
      (group) =>
        profile.primaryTypes.includes(group['primary-type']) &&
        (group['secondary-types'] ?? []).every((type) => allowedSecondary.has(type)),
    )
    .sort(
      (a, b) =>
        (b.rating?.['votes-count'] ?? 0) - (a.rating?.['votes-count'] ?? 0) || byDate(a, b) || a.id.localeCompare(b.id),
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

// Profile rules that need the chosen release, not just the release group: a title pattern to
// skip, and an allowed-language list checked against the release's language code when set.
function albumAllowed(group, release, profile) {
  if (profile.excludeTitles?.test(group.title)) return false;
  const language = release['text-representation']?.language;
  if (profile.languages && language && !profile.languages.includes(language)) return false;
  return true;
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

// The performers of one track as MusicBrainz credits them, e.g. "K. J. Yesudas & K. S. Chithra",
// or null when the credit is just the album's own artist (the normal case for a band's album).
function trackCredit(track, albumArtistMbid) {
  const parts = track['artist-credit'] ?? track.recording?.['artist-credit'] ?? [];
  if (parts.length === 0) return null;
  if (parts.length === 1 && parts[0].artist?.id === albumArtistMbid) return null;
  const credit = parts.map((part) => `${part.name}${part.joinphrase ?? ''}`).join('').trim();
  return credit || null;
}

// One row per track on the release's audio media. A track is keyed by its recording id.
function tracksFromRelease(release, albumArtistMbid) {
  return audioMedia(release).flatMap((medium) =>
    medium.tracks
      .filter((track) => track.recording?.id)
      .map((track) => ({
        mbid: track.recording.id,
        title: track.recording.title || track.title,
        credit: trackCredit(track, albumArtistMbid),
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
  albumAllowed,
  trackCredit,
  tracksFromRelease,
  coverUrl,
  wikidataId,
  genresFrom,
};
