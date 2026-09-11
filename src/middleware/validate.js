const { ZodError } = require('zod');

/**
 * Middleware to validate request body, query, or params using a Zod schema.
 * @param {Object} schemas - An object containing schemas for 'body', 'query', or 'params'.
 */
const validate = (schemas) => (req, res, next) => {
  try {
    if (schemas.body) {
      req.body = schemas.body.parse(req.body);
    }
    if (schemas.query) {
      req.query = schemas.query.parse(req.query);
    }
    if (schemas.params) {
      req.params = schemas.params.parse(req.params);
    }
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: err.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }))
      });
    }
    next(err);
  }
};

module.exports = validate;
