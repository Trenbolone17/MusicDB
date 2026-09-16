const express = require('express');
const { query } = require('../db');
const { notFound } = require('../errors');
const { parseIdParam } = require('../middleware/idParam');
const { ratingAverage } = require('../sql');

const router = express.Router();
parseIdParam(router, 'Track');

const TRACK_SQL = `
  SELECT t.id, t.mbid, t.title, t.credit, t.disc_number AS "discNumber", t.track_number AS "trackNumber",
         t.duration_ms AS "durationMs",
         t.rating_count AS "ratingCount", ${ratingAverage('t')} AS "ratingAverage",
         json_build_object('id', al.id, 'title', al.title, 'releaseYear', al.release_year,
                           'coverUrl', al.cover_url) AS album,
         json_build_object('id', ar.id, 'name', ar.name) AS artist
  FROM tracks t
  JOIN albums al ON al.id = t.album_id
  JOIN artists ar ON ar.id = al.artist_id
  WHERE t.id = $1`;

router.get('/tracks/:id', async (req, res) => {
  const { rows } = await query(TRACK_SQL, [req.id]);
  if (rows.length === 0) throw notFound('Track not found');
  res.json(rows[0]);
});

module.exports = router;
