const { AppError, notFound } = require('../errors');

// Registered after all routers: any request nothing handled becomes a normal NOT_FOUND error.
function notFoundHandler(req, res, next) {
  next(notFound(`No route for ${req.method} ${req.path}`));
}

function toAppError(err) {
  if (err instanceof AppError) return err;
  // express.json() throws these for malformed or oversized bodies.
  if (err.type === 'entity.parse.failed') {
    return new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON');
  }
  if (err.type === 'entity.too.large') {
    return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }
  return new AppError(500, 'INTERNAL', 'Something went wrong');
}

// Every error leaves the API in one shape: { error: { code, message, details? } }.
// Express 5 forwards rejected promises from async handlers here automatically.
// eslint-disable-next-line no-unused-vars -- Express only treats 4-argument middleware as an error handler
function errorHandler(err, req, res, next) {
  const appError = toAppError(err);
  // Expected errors are part of normal operation; only log the ones we didn't anticipate.
  if (appError.code === 'INTERNAL') console.error(err);

  const body = { code: appError.code, message: appError.message };
  if (appError.details !== undefined) body.details = appError.details;
  res.status(appError.status).json({ error: body });
}

module.exports = { notFoundHandler, errorHandler };
