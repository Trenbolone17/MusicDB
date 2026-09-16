const { rateLimit } = require('express-rate-limit');
const { AppError } = require('../errors');

// Allows `max` requests per client IP within `windowMs`, then answers with the standard error
// shape. With skipSuccessfulRequests, only requests that end in an error count toward the
// limit. Each call creates its own in-memory counter, so every app instance starts fresh.
function createRateLimiter({ max, windowMs, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit: max,
    skipSuccessfulRequests,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res, next) => {
      next(new AppError(429, 'RATE_LIMITED', 'Too many attempts. Please wait a few minutes and try again.'));
    },
  });
}

module.exports = { createRateLimiter };
