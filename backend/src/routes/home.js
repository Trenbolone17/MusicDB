const express = require('express');
const { CATALOG_TYPES } = require('../catalogTypes');
const { query } = require('../db');
const { topChartSql } = require('./charts');
const { listFeatured } = require('./featured');

const FEATURED_SHOWN = 6;
const TOP_SHOWN = 5;

async function topFive(typeKey) {
  const { rows } = await query(topChartSql(CATALOG_TYPES[typeKey]), [TOP_SHOWN, 0]);
  return rows.map(({ totalCount, ...item }, index) => ({ rank: index + 1, ...item }));
}

const router = express.Router();

// Everything the home page shows, in one response.
router.get('/home', async (req, res) => {
  const [featuredTracks, featuredArtists, topTracks, topAlbums, topArtists] = await Promise.all([
    listFeatured('tracks', FEATURED_SHOWN),
    listFeatured('artists', FEATURED_SHOWN),
    topFive('tracks'),
    topFive('albums'),
    topFive('artists'),
  ]);
  res.json({
    featured: { tracks: featuredTracks, artists: featuredArtists },
    top: { tracks: topTracks, albums: topAlbums, artists: topArtists },
  });
});

module.exports = router;
