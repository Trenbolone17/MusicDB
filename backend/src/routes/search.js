const express = require('express');
const { CATALOG_TYPES } = require('../catalogTypes');
const { query } = require('../db');
const { validationError } = require('../errors');
const { parsePage } = require('../pagination');
const { ratingAverage } = require('../sql');

const GROUP_LIMIT = 5; // results per type in the grouped (type=all) view
const PAGE_SIZE = 25; // results per page when one type is chosen
const MAX_QUERY_LENGTH = 100;
const TYPES = ['artists', 'albums', 'tracks'];

// "para and" -> "para:* & and:*", so each word matches as a prefix while the user is still
// typing. Punctuation is stripped because it has meaning in tsquery syntax. Returns '' when
// nothing is left, in which case only the trigram match below applies.
function toPrefixTsquery(text) {
  return text
    .split(/\s+/)
    .map((term) => term.replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter(Boolean)
    .map((term) => `${term}:*`)
    .join(' & ');
}

// Two ways to match, both accent-insensitive: full-text prefix search on words, or trigram
// similarity (the % operator) for typos like "radiohed". Exact name matches come first, then
// whichever of the two scores is higher, then popularity.
//   $1 = the raw query, $2 = the tsquery text, $3 = limit, $4 = offset
function searchSql({ table, alias, nameColumn, select, joins }) {
  const name = `f_unaccent(${alias}.${nameColumn})`;
  return `
    SELECT ${select},
           ${alias}.rating_count AS "ratingCount", ${ratingAverage(alias)} AS "ratingAverage",
           count(*) OVER () AS "totalCount"
    FROM ${table} ${alias}
    ${joins}
    WHERE ($2 <> '' AND ${alias}.search_vector @@ to_tsquery('simple', f_unaccent($2)))
       OR ${name} % f_unaccent($1)
    ORDER BY (lower(${name}) = lower(f_unaccent($1))) DESC,
             greatest(
               CASE WHEN $2 <> '' THEN ts_rank(${alias}.search_vector, to_tsquery('simple', f_unaccent($2))) ELSE 0 END,
               similarity(${name}, f_unaccent($1))
             ) DESC,
             ${alias}.rating_count DESC, ${alias}.id
    LIMIT $3 OFFSET $4`;
}

async function searchType(type, text, tsquery, limit, offset) {
  const { rows } = await query(searchSql(CATALOG_TYPES[type]), [text, tsquery, limit, offset]);
  return {
    items: rows.map(({ totalCount, ...item }) => item),
    total: rows[0]?.totalCount ?? 0,
  };
}

const router = express.Router();

// GET /api/search?q=text[&type=artists|albums|tracks][&page=N]
router.get('/search', async (req, res) => {
  const text = String(req.query.q ?? '').trim();
  if (!text) throw validationError('Type something to search for', { fields: { q: 'Required' } });
  if (text.length > MAX_QUERY_LENGTH) {
    throw validationError('That search is too long', { fields: { q: `Use at most ${MAX_QUERY_LENGTH} characters` } });
  }

  const type = req.query.type ?? 'all';
  if (type !== 'all' && !TYPES.includes(type)) {
    throw validationError('Unknown type', { fields: { type: `Use one of: all, ${TYPES.join(', ')}` } });
  }

  const tsquery = toPrefixTsquery(text);

  if (type === 'all') {
    const groups = await Promise.all(TYPES.map((each) => searchType(each, text, tsquery, GROUP_LIMIT, 0)));
    res.json({ query: text, ...Object.fromEntries(TYPES.map((each, index) => [each, groups[index]])) });
    return;
  }

  const page = parsePage(req.query.page);
  const { items, total } = await searchType(type, text, tsquery, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  res.json({ query: text, type, items, page, pageSize: PAGE_SIZE, total });
});

module.exports = router;
