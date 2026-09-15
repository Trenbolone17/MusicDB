const BASE_URL = 'https://musicbrainz.org/ws/2';
const PAGE_SIZE = 100;
// Some artists have well over a thousand live and bootleg "album" entries. Cap the paging
// so one of them can't stall the whole run.
const MAX_RELEASE_GROUP_PAGES = 10;

// Wraps a client from seed/http.js with the few MusicBrainz calls the seed needs.
function createMusicBrainz(client) {
  // URLSearchParams encodes spaces as "+", which is how MusicBrainz separates inc= values.
  const get = (path, params) =>
    client.getJson(`${BASE_URL}/${path}?${new URLSearchParams({ ...params, fmt: 'json' })}`);

  return {
    lookupArtist(mbid) {
      return get(`artist/${mbid}`, { inc: 'genres url-rels' });
    },

    // type=album also matches live albums, compilations, and so on; transform.js filters those.
    async browseAlbumGroups(artistMbid) {
      const groups = [];
      for (let page = 0; page < MAX_RELEASE_GROUP_PAGES; page++) {
        const data = await get('release-group', {
          artist: artistMbid,
          type: 'album',
          inc: 'ratings',
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        });
        const batch = data?.['release-groups'] ?? [];
        groups.push(...batch);
        if (batch.length < PAGE_SIZE || groups.length >= data['release-group-count']) break;
      }
      return groups;
    },

    // With inc=recordings MusicBrainz returns fewer releases than requested, but one page
    // is plenty to choose a canonical release from.
    async browseOfficialReleases(releaseGroupMbid) {
      const data = await get('release', {
        'release-group': releaseGroupMbid,
        status: 'official',
        inc: 'media recordings',
        limit: PAGE_SIZE,
      });
      return data?.releases ?? [];
    },
  };
}

module.exports = { createMusicBrainz };
