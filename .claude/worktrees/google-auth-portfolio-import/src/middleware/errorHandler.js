/**
 * Global error handler middleware.
 * Ensures that errors are caught and returned as consistent JSON responses.
 */
const errorHandler = (err, req, res, next) => {
  console.error(`[Error] ${err.stack || err}`);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // In production, don't leak the stack trace.
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

module.exports = errorHandler;
