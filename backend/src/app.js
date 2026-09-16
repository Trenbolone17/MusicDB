const cookieParser = require('cookie-parser');
const express = require('express');
const config = require('./config');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { createRateLimiter } = require('./middleware/rateLimits');
const albumRoutes = require('./routes/albums');
const artistRoutes = require('./routes/artists');
const { createAuthRouter } = require('./routes/auth');
const healthRoutes = require('./routes/health');
const { createReviewsRouter } = require('./routes/reviews');
const trackRoutes = require('./routes/tracks');

// Refresh runs on every page load and logging out is harmless, so both get a much looser
// limit than log-in and sign-up attempts.
const SESSION_REQUESTS_PER_WINDOW = 100;

// Builds the app without listening, so tests can drive it with Supertest. Each app gets fresh
// rate-limit counters, and tests can pass their own limits.
function createApp({ authRateLimit = config.rateLimits.auth, reviewRateLimit = config.rateLimits.review } = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Trust X-Forwarded-For only from a proxy on this machine (Vite in development), so req.ip is
  // the visitor's real address for rate limiting and remote clients can't spoof it.
  app.set('trust proxy', 'loopback');
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', healthRoutes);
  app.use(
    '/api/auth',
    createAuthRouter({
      signupLimiter: createRateLimiter(authRateLimit),
      loginLimiter: createRateLimiter({ ...authRateLimit, skipSuccessfulRequests: true }),
      sessionLimiter: createRateLimiter({ max: SESSION_REQUESTS_PER_WINDOW, windowMs: authRateLimit.windowMs }),
    }),
  );
  app.use('/api', artistRoutes);
  app.use('/api', albumRoutes);
  app.use('/api', trackRoutes);
  app.use(
    '/api',
    createReviewsRouter({
      // Review writes always run behind requireAuth, so they're counted per account rather
      // than per address: one busy household can't use up everyone else's ratings.
      reviewLimiter: createRateLimiter({ ...reviewRateLimit, keyGenerator: (req) => String(req.user.id) }),
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
