// An error the API can show to clients as-is. Anything else becomes a generic 500.
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const validationError = (message, details) => new AppError(400, 'VALIDATION_ERROR', message, details);
const unauthorized = (message = 'Authentication required') => new AppError(401, 'UNAUTHORIZED', message);
const forbidden = (message = 'You are not allowed to do that') => new AppError(403, 'FORBIDDEN', message);
const notFound = (message = 'Not found') => new AppError(404, 'NOT_FOUND', message);
const conflict = (message) => new AppError(409, 'CONFLICT', message);

module.exports = { AppError, validationError, unauthorized, forbidden, notFound, conflict };
