const os = require('node:os');
const path = require('node:path');

// Uploads made by tests go to a temp directory, never the real uploads folder. This must be
// set before config.js is first loaded in this test file.
process.env.UPLOADS_DIR = path.join(os.tmpdir(), 'songboard-test-uploads');

const { pool } = require('../../src/db');

// Each test file gets its own module registry, and so its own pool. Close it so Jest can exit.
afterAll(() => pool.end());
