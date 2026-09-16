// How each seed list picks albums. Western catalogues are album-led, so the English profile
// takes studio albums only. Malayalam music is film-led: a "release" is usually the film's
// soundtrack or score, often catalogued as an EP, under the composer's name, and the recent
// films are the well-known ones. MusicBrainz ratings are sparse there, so ties break newest first.
const PROFILES = {
  english: {
    list: 'artists.json',
    browseTypes: 'album', // MusicBrainz release-group browse ?type=
    primaryTypes: ['Album'],
    secondaryTypes: ['Soundtrack', 'Mixtape/Street'], // allowed; anything else is skipped
    tieBreak: 'oldest',
    maxAlbums: null, // null = SEED_MAX_ALBUMS_PER_ARTIST from .env
  },
  malayalam: {
    list: 'artists-malayalam.json',
    browseTypes: 'album|ep',
    primaryTypes: ['Album', 'EP'],
    secondaryTypes: ['Soundtrack', 'Mixtape/Street'],
    tieBreak: 'newest',
    maxAlbums: 40,
    // Background-score albums are dozens of instrumental cues; the film's songs are on the
    // soundtrack release, which is kept.
    excludeTitles: /\b(background\s+)?score\b/i,
    // These composers also score Tamil and Telugu films. Keep releases MusicBrainz marks as
    // Malayalam (ISO 639-3 "mal") or leaves unmarked; skip ones marked as another language.
    languages: ['mal'],
  },
};

module.exports = { PROFILES };
