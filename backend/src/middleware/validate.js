const { validationError } = require('../errors');

// Checks req.body against a zod schema. On success req.body becomes the parsed value (trimmed,
// with defaults); on failure the client gets VALIDATION_ERROR with one message per field,
// e.g. details: { fields: { password: "Use at least 8 characters" } }.
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const fields = {};
      for (const issue of result.error.issues) {
        const field = issue.path.join('.') || 'body';
        fields[field] ??= issue.message;
      }
      next(validationError('Please fix the highlighted fields', { fields }));
      return;
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validateBody };
