const { pool } = require('../../src/db');

// Each test file gets its own module registry, and so its own pool. Close it so Jest can exit.
afterAll(() => pool.end());
