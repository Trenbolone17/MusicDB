const express = require('express');
const { query } = require('../db');
const { notFound } = require('../errors');
const { parseIdParam } = require('../middleware/idParam');
const ranking = require('../ranking');
const { ratingAverage } = require('../sql');

const router = express.Router();
parseIdParam(router, 'Artist');

const GENRES_SHOWN = 6;
const TOP_TRACKS_SHOWN = 10;

const ARTIST_SQL = `
  SELECT a.id, a.mbid, a.name, a.disambiguation, a.artist_type AS "type", a.country, a.bio,
         a.wikipedia_url AS "wikipediaUrl", a.image_url AS "imageUrl",
         a.rating_count AS "ratingCount", ${ratingAverage('a')} AS "ratingAverage",
         ARRAY(SELECT g.name
                 FROM artist_genres ag JOIN genres g ON g.id = ag.genre_id
                WHERE ag.artist_id = a.id
                ORDER BY ag.vote_count DESC, g.name
                LIMIT $2) AS genres
  FROM artists a
  WHERE a.id = $1`;

const ALBUMS_SQL = `
  SELECT al.id, al.title, al.release_year AS "releaseYear", al.cover_url AS "coverUrl",
         al.rating_count AS "ratingCount", ${ratingAverage('al')} AS "ratingAverage",
         (SELECT count(*) FROM tracks t WHERE t.album_id = al.id) AS "trackCount"
  FROM albums al
  WHERE al.artist_id = $1
  ORDER BY al.release_year NULLS LAST, al.title`;

// The artist's rated tracks, ordered by the same weighted score as the Top Songs chart.
const TOP_TRACKS_SQL = `
  WITH ${ranking.globalMeanCte('tracks')}
  SELECT t.id, t.title, t.credit, t.duration_ms AS "durationMs",
         t.rating_count AS "ratingCount", ${ratingAverage('t')} AS "ratingAverage",
         json_build_object('id', al.id, 'title', al.title) AS album
  FROM tracks t
  JOIN albums al ON al.id = t.album_id
  CROSS JOIN global
  WHERE al.artist_id = $1 AND t.rating_count > 0
  ORDER BY ${ranking.topScoreSql('t')} DESC, t.rating_count DESC, t.id
  LIMIT $2`;

// Everything the artist page needs in one response: details, genres, discography, top tracks.
router.get('/artists/:id', async (req, res) => {
  const { rows } = await query(ARTIST_SQL, [req.id, GENRES_SHOWN]);
  if (rows.length === 0) throw notFound('Artist not found');

  const [albums, topTracks] = await Promise.all([
    query(ALBUMS_SQL, [req.id]),
    query(TOP_TRACKS_SQL, [req.id, TOP_TRACKS_SHOWN]),
  ]);
  res.json({ ...rows[0], albums: albums.rows, topTracks: topTracks.rows });
});

module.exports = router;
