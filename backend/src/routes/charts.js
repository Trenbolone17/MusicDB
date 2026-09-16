const express = require('express');
const { query } = require('../db');
const { notFound, validationError } = require('../errors');
const { parsePage } = require('../pagination');
const ranking = require('../ranking');
const { ratingAverage } = require('../sql');

const PAGE_SIZE = 25;
const SORTS = ['top', 'trending'];

// What each chart lists and how its rows are shaped. The alias is used by the ranking SQL.
const CHART_TYPES = {
  tracks: {
    table: 'tracks',
    alias: 't',
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
    reviewColumn: 'album_id',
    targetType: 'album',
    select: `al.id, al.title, al.release_year AS "releaseYear", al.cover_url AS "coverUrl",
             json_build_object('id', ar.id, 'name', ar.name) AS artist`,
    joins: 'JOIN artists ar ON ar.id = al.artist_id',
  },
  artists: {
    table: 'artists',
    alias: 'ar',
    reviewColumn: 'artist_id',
    targetType: 'artist',
    select: 'ar.id, ar.name, ar.image_url AS "imageUrl"',
    joins: '',
  },
};

// Only items with at least one rating are listed; the rest would all tie at the global mean.
function topChartSql({ table, alias, select, joins }) {
  return `
    WITH ${ranking.globalMeanCte(table)}
    SELECT ${select},
           ${alias}.rating_count AS "ratingCount", ${ratingAverage(alias)} AS "ratingAverage",
           round((${ranking.topScoreSql(alias)})::numeric, 4) AS score,
           count(*) OVER () AS "totalCount"
    FROM ${table} ${alias}
    ${joins}
    CROSS JOIN global
    WHERE ${alias}.rating_count > 0
    ORDER BY ${ranking.topScoreSql(alias)} DESC, ${alias}.rating_count DESC, ${alias}.id
    LIMIT $1 OFFSET $2`;
}

// Only items rated inside the trending window appear; joining through "recent" does that.
function trendingChartSql({ table, alias, reviewColumn, targetType, select, joins }) {
  return `
    WITH ${ranking.globalMeanCte(table)},
         ${ranking.recentRatingsCte(reviewColumn, targetType)}
    SELECT ${select},
           ${alias}.rating_count AS "ratingCount", ${ratingAverage(alias)} AS "ratingAverage",
           round((${ranking.trendingScoreSql})::numeric, 4) AS score,
           count(*) OVER () AS "totalCount"
    FROM recent
    JOIN ${table} ${alias} ON ${alias}.id = recent.id
    ${joins}
    CROSS JOIN global
    ORDER BY ${ranking.trendingScoreSql} DESC, recent.weighted_count DESC, ${alias}.id
    LIMIT $1 OFFSET $2`;
}

const router = express.Router();

// GET /api/charts/tracks?sort=top|trending&page=N (also albums, artists)
router.get('/charts/:type', async (req, res) => {
  const chart = CHART_TYPES[req.params.type];
  if (!chart) throw notFound('Chart not found');

  const sort = req.query.sort ?? 'top';
  if (!SORTS.includes(sort)) {
    throw validationError('Unknown sort', { fields: { sort: `Use one of: ${SORTS.join(', ')}` } });
  }

  const page = parsePage(req.query.page);
  const offset = (page - 1) * PAGE_SIZE;
  const sql = sort === 'top' ? topChartSql(chart) : trendingChartSql(chart);
  const { rows } = await query(sql, [PAGE_SIZE, offset]);

  res.json({
    items: rows.map(({ totalCount, ...item }, index) => ({ rank: offset + index + 1, ...item })),
    page,
    pageSize: PAGE_SIZE,
    total: rows[0]?.totalCount ?? 0,
    sort,
  });
});

module.exports = router;
