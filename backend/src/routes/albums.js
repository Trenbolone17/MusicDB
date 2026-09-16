const express = require('express');
const { query } = require('../db');
const { notFound } = require('../errors');
const { parseIdParam } = require('../middleware/idParam');
const { ratingAverage } = require('../sql');

const router = express.Router();
parseIdParam(router, 'Album');

const ALBUM_SQL = `
  SELECT al.id, al.mbid, al.title, al.release_year AS "releaseYear", al.cover_url AS "coverUrl",
         al.rating_count AS "ratingCount", ${ratingAverage('al')} AS "ratingAverage",
         json_build_object('id', ar.id, 'name', ar.name) AS artist
  FROM albums al
  JOIN artists ar ON ar.id = al.artist_id
  WHERE al.id = $1`;

const TRACKS_SQL = `
  SELECT t.id, t.disc_number AS "discNumber", t.track_number AS "trackNumber", t.title, t.credit,
         t.duration_ms AS "durationMs",
         t.rating_count AS "ratingCount", ${ratingAverage('t')} AS "ratingAverage"
  FROM tracks t
  WHERE t.album_id = $1
  ORDER BY t.disc_number, t.track_number`;

// The album with its artist and full tracklist, each track carrying its own rating.
router.get('/albums/:id', async (req, res) => {
  const { rows } = await query(ALBUM_SQL, [req.id]);
  if (rows.length === 0) throw notFound('Album not found');

  const tracks = await query(TRACKS_SQL, [req.id]);
  res.json({ ...rows[0], tracks: tracks.rows });
});

module.exports = router;
