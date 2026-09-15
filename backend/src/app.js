const express = require('express');
const healthRoutes = require('./routes/health');
const artistRoutes = require('./routes/artists');
const albumRoutes = require('./routes/albums');
const trackRoutes = require('./routes/tracks');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// Builds the app without listening, so tests can drive it with Supertest.
function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', healthRoutes);
  app.use('/api', artistRoutes);
  app.use('/api', albumRoutes);
  app.use('/api', trackRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
