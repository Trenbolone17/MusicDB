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

    // Lucene search, e.g. searchArtists('artist:"Sushin Shyam"') or 'area:Kerala'.
    async searchArtists(query, limit = 10, offset = 0) {
      const data = await get('artist', { query, limit, offset });
      return { count: data?.count ?? 0, artists: data?.artists ?? [] };
    },

    // `types` is the MusicBrainz ?type= filter ("album" or "album|ep"); it also matches live
    // albums, compilations, and so on, which transform.js filters.
    async browseAlbumGroups(artistMbid, types = 'album') {
      const groups = [];
      for (let page = 0; page < MAX_RELEASE_GROUP_PAGES; page++) {
        const data = await get('release-group', {
          artist: artistMbid,
          type: types,
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
    // is plenty to choose a canonical release from. artist-credits gives each track's performers.
    async browseOfficialReleases(releaseGroupMbid) {
      const data = await get('release', {
        'release-group': releaseGroupMbid,
        status: 'official',
        inc: 'media recordings artist-credits',
        limit: PAGE_SIZE,
      });
      return data?.releases ?? [];
    },
  };
}

module.exports = { createMusicBrainz };
