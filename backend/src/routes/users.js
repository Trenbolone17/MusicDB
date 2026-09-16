const express = require('express');
const { query } = require('../db');
const { notFound } = require('../errors');
const { parsePage } = require('../pagination');
const { ratingAverage } = require('../sql');
const storage = require('../storage');

const TOP_TRACKS_SHOWN = 10;
const REVIEWS_PAGE_SIZE = 10;

const router = express.Router();

// Resolves :username (case-insensitively) to req.profileUserId, or answers 404.
router.param('username', async (req, res, next, username) => {
  const { rows } = await query('SELECT id FROM users WHERE lower(username) = lower($1)', [username]);
  if (rows.length === 0) throw notFound('User not found');
  req.profileUserId = rows[0].id;
  next();
});

// Public profile: never includes the email address.
router.get('/users/:username', async (req, res) => {
  const { rows } = await query(
    `SELECT u.username, u.display_name AS "displayName", u.bio, u.avatar_key AS "avatarKey",
            u.created_at AS "createdAt",
            (SELECT count(*) FROM reviews r WHERE r.user_id = u.id) AS "ratingCount",
            (SELECT round(avg(r.rating)::numeric, 1) FROM reviews r WHERE r.user_id = u.id) AS "averageGiven"
     FROM users u
     WHERE u.id = $1`,
    [req.profileUserId],
  );
  const { avatarKey, ...profile } = rows[0];
  res.json({ ...profile, avatarUrl: storage.urlFor(avatarKey) });
});

// The songs this person rated highest, with the song's overall rating alongside theirs.
router.get('/users/:username/top-tracks', async (req, res) => {
  const { rows } = await query(
    `SELECT t.id, t.title, t.credit, r.rating AS "givenRating",
            t.rating_count AS "ratingCount", ${ratingAverage('t')} AS "ratingAverage",
            json_build_object('id', al.id, 'title', al.title, 'coverUrl', al.cover_url) AS album,
            json_build_object('id', ar.id, 'name', ar.name) AS artist
     FROM reviews r
     JOIN tracks t ON t.id = r.track_id
     JOIN albums al ON al.id = t.album_id
     JOIN artists ar ON ar.id = al.artist_id
     WHERE r.user_id = $1
     ORDER BY r.rating DESC, r.updated_at DESC, t.id
     LIMIT $2`,
    [req.profileUserId, TOP_TRACKS_SHOWN],
  );
  res.json({ items: rows });
});

// Written reviews, newest first, each with a link-ready description of what it's about.
router.get('/users/:username/reviews', async (req, res) => {
  const page = parsePage(req.query.page);
  const { rows } = await query(
    `SELECT r.id, r.rating, r.body, r.created_at AS "createdAt", r.updated_at AS "updatedAt",
            json_build_object(
              'type', r.target_type,
              'id', coalesce(a.id, al.id, t.id),
              'title', coalesce(a.name, al.title, t.title),
              'subtitle', coalesce(ala.name, ta.name || ' · ' || tal.title),
              'coverUrl', coalesce(a.image_url, al.cover_url, tal.cover_url)
            ) AS target,
            count(*) OVER () AS "totalCount"
     FROM reviews r
     LEFT JOIN artists a ON a.id = r.artist_id
     LEFT JOIN albums al ON al.id = r.album_id
     LEFT JOIN artists ala ON ala.id = al.artist_id
     LEFT JOIN tracks t ON t.id = r.track_id
     LEFT JOIN albums tal ON tal.id = t.album_id
     LEFT JOIN artists ta ON ta.id = tal.artist_id
     WHERE r.user_id = $1 AND r.body IS NOT NULL
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT $2 OFFSET $3`,
    [req.profileUserId, REVIEWS_PAGE_SIZE, (page - 1) * REVIEWS_PAGE_SIZE],
  );
  res.json({
    items: rows.map(({ totalCount, ...review }) => review),
    page,
    pageSize: REVIEWS_PAGE_SIZE,
    total: rows[0]?.totalCount ?? 0,
  });
});

module.exports = router;
