const { Pool, types } = require('pg');
const config = require('./config');

// pg returns bigint (int8) and numeric as strings to avoid precision loss. Our ids and
// counts stay far below 2^53 and averages don't need exact decimals, so use JS numbers.
types.setTypeParser(types.builtins.INT8, (value) => Number.parseInt(value, 10));
types.setTypeParser(types.builtins.NUMERIC, (value) => Number.parseFloat(value));

const pool = new Pool({
  connectionString: config.databaseUrl,
  connectionTimeoutMillis: 5000,
  // Session settings sent at connection start-up. pg_trgm's word-similarity operator (<%), which
  // search uses on performer credits, defaults to a 0.6 cut-off: too strict for a one-letter
  // slip in a short name ("sitara" scores 0.5 against "Sithara"). 0.45 keeps such typos
  // matching while the trigram index stays usable.
  options: '-c pg_trgm.word_similarity_threshold=0.45',
});

function query(text, params) {
  return pool.query(text, params);
}

// Runs fn(client) between BEGIN and COMMIT. Any thrown error rolls the whole thing back.
// Use the client passed to fn for every query that must be part of the transaction.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
