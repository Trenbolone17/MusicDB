const { Pool, types } = require('pg');
const config = require('./config');

// pg returns bigint (int8) and numeric as strings to avoid precision loss. Our ids and
// counts stay far below 2^53 and averages don't need exact decimals, so use JS numbers.
types.setTypeParser(types.builtins.INT8, (value) => Number.parseInt(value, 10));
types.setTypeParser(types.builtins.NUMERIC, (value) => Number.parseFloat(value));

const pool = new Pool({
  connectionString: config.databaseUrl,
  connectionTimeoutMillis: 5000,
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
