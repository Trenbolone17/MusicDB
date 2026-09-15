const express = require('express');
const { query } = require('../db');
const { AppError } = require('../errors');

const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
  } catch {
    throw new AppError(503, 'DB_UNAVAILABLE', 'Database is not reachable');
  }
  res.json({ status: 'ok' });
});

module.exports = router;
