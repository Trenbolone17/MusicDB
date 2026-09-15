// Runs once before the whole test run: bring the test database's schema up to date.
// config.js has already refused to continue unless the database name ends in "_test".
module.exports = async function globalSetup() {
  const { runMigrations } = require('../../scripts/migrate');
  const { pool } = require('../../src/db');
  try {
    await runMigrations({ log: () => {} });
  } finally {
    await pool.end();
  }
};
