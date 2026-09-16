// How each catalog type is listed in charts and search results: which table, the alias the
// ranking SQL uses, the name column that search matches, and the row shape. Everything here
// is our own SQL, never user input.
const CATALOG_TYPES = {
  tracks: {
    table: 'tracks',
    alias: 't',
    nameColumn: 'title',
    reviewColumn: 'track_id',
    targetType: 'track',
    select: `t.id, t.title,
             json_build_object('id', al.id, 'title', al.title, 'coverUrl', al.cover_url) AS album,
             json_build_object('id', ar.id, 'name', ar.name) AS artist`,
    joins: 'JOIN albums al ON al.id = t.album_id JOIN artists ar ON ar.id = al.artist_id',
  },
  albums: {
    table: 'albums',
    alias: 'al',
    nameColumn: 'title',
    reviewColumn: 'album_id',
    targetType: 'album',
    select: `al.id, al.title, al.release_year AS "releaseYear", al.cover_url AS "coverUrl",
             json_build_object('id', ar.id, 'name', ar.name) AS artist`,
    joins: 'JOIN artists ar ON ar.id = al.artist_id',
  },
  artists: {
    table: 'artists',
    alias: 'ar',
    nameColumn: 'name',
    reviewColumn: 'artist_id',
    targetType: 'artist',
    select: 'ar.id, ar.name, ar.image_url AS "imageUrl"',
    joins: '',
  },
};

module.exports = { CATALOG_TYPES };
