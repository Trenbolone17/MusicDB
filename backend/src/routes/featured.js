const express = require('express');
const { z } = require('zod');
const { CATALOG_TYPES } = require('../catalogTypes');
const { query } = require('../db');
const { conflict, notFound } = require('../errors');
const { parseIdParam } = require('../middleware/idParam');
const { requireAdmin } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { ratingAverage } = require('../sql');

// 'artist' (what the client says) -> 'artists' (the catalog type key)
const TYPE_KEYS = { artist: 'artists', album: 'albums', track: 'tracks' };

// Featured rows of one type, newest first, shaped like chart rows plus the featured item's id.
function featuredSql(typeKey, limit) {
  const { table, alias, select, joins, reviewColumn } = CATALOG_TYPES[typeKey];
  return {
    text: `
      SELECT ${select},
             ${alias}.rating_count AS "ratingCount", ${ratingAverage(alias)} AS "ratingAverage",
             f.id AS "featuredId"
      FROM featured_items f
      JOIN ${table} ${alias} ON ${alias}.id = f.${reviewColumn}
      ${joins}
      ORDER BY f.created_at DESC, f.id DESC
      ${limit ? 'LIMIT $1' : ''}`,
    values: limit ? [limit] : [],
  };
}

async function listFeatured(typeKey, limit) {
  const { text, values } = featuredSql(typeKey, limit);
  const { rows } = await query(text, values);
  return rows;
}

const FeatureSchema = z.object({
  type: z.enum(['artist', 'album', 'track'], 'Use artist, album, or track'),
  id: z.number('Required').int().positive(),
});

const router = express.Router();

router.get('/featured', async (req, res) => {
  const [artists, albums, tracks] = await Promise.all(['artists', 'albums', 'tracks'].map((key) => listFeatured(key)));
  res.json({ artists, albums, tracks });
});

const admin = express.Router();
admin.use(requireAdmin);
parseIdParam(admin, 'Featured item');

admin.post('/', validateBody(FeatureSchema), async (req, res) => {
  const { reviewColumn } = CATALOG_TYPES[TYPE_KEYS[req.body.type]];
  let inserted;
  try {
    inserted = await query(
      `INSERT INTO featured_items (${reviewColumn}, created_by) VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [req.body.id, req.user.id],
    );
  } catch (err) {
    // 23503: the foreign key found no such artist, album, or track.
    if (err.code === '23503') throw notFound(`${req.body.type[0].toUpperCase()}${req.body.type.slice(1)} not found`);
    throw err;
  }
  if (inserted.rowCount === 0) throw conflict('Already featured');
  res.status(201).json({ featuredId: inserted.rows[0].id });
});

admin.delete('/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM featured_items WHERE id = $1', [req.id]);
  if (rowCount === 0) throw notFound('Featured item not found');
  res.status(204).end();
});

router.use('/admin/featured', admin);

module.exports = { router, listFeatured };
