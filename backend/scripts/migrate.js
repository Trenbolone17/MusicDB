const fs = require('node:fs/promises');
const path = require('node:path');
const { pool } = require('../src/db');

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');
// Arbitrary fixed key for pg_advisory_lock, so two runners (say, dev server and tests)
// can never apply migrations at the same time.
const LOCK_KEY = 72413001;

async function listMigrationFiles() {
  const files = await fs.readdir(MIGRATIONS_DIR);
  // Zero-padded numeric prefixes (001_, 002_, ...) make plain sorting apply them in order.
  return files.filter((file) => /^\d+_[\w-]+\.sql$/.test(file)).sort();
}

// Applies every migration file not yet recorded in schema_migrations, each in its own
// transaction. Returns the filenames applied in this run.
async function runMigrations({ log = console.log } = {}) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);

    const { rows } = await client.query('SELECT filename FROM schema_migrations');
    const alreadyApplied = new Set(rows.map((row) => row.filename));
    const pending = (await listMigrationFiles()).filter((file) => !alreadyApplied.has(file));

    for (const file of pending) {
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        log(`applied ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        err.message = `${file}: ${err.message}`;
        throw err;
      }
    }

    if (pending.length === 0) log('no pending migrations');
    return pending;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => {});
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .catch((err) => {
      console.error(`Migration failed: ${err.message}`);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = { runMigrations };
