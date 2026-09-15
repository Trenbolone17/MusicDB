const { notFound } = require('../errors');

// Makes :id on this router a positive integer, available as req.id. Anything else, such as
// /artists/abc, is answered as "not found" without reaching the database.
function parseIdParam(router, resourceName) {
  router.param('id', (req, res, next, value) => {
    const id = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id === 0) {
      next(notFound(`${resourceName} not found`));
      return;
    }
    req.id = id;
    next();
  });
}

module.exports = { parseIdParam };
