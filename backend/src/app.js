const express = require('express');
const healthRoutes = require('./routes/health');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// Builds the app without listening, so tests can drive it with Supertest.
function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', healthRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
