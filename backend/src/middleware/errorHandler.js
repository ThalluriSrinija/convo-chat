'use strict';

/**
 * middleware/errorHandler.js
 *
 * Centralised Express error handler.
 * Must be registered LAST with app.use() (after all routes).
 *
 * Handles:
 *   • Structured errors created by createError() (statusCode + message)
 *   • Mongoose ValidationError  → 400
 *   • Mongoose CastError        → 400 (invalid ObjectId in URL param)
 *   • MongoDB duplicate-key     → 409
 *   • JWT errors                → 401
 *   • All other errors          → 500
 *
 * Response format (always JSON):
 *   {
 *     status:  'error',
 *     message: string,
 *     ...(development only: stack trace)
 *   }
 */

const isDev = () => process.env.NODE_ENV !== 'production';

/**
 * @param {Error} err
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || err.status || 500;
  let message    = err.message    || 'An unexpected error occurred.';

  // ── Mongoose ValidationError ──────────────────────────────────────────────
  if (err.name === 'ValidationError') {
    statusCode = 400;
    // Collect all field messages into a single string
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  }

  // ── Mongoose CastError (invalid ObjectId) ─────────────────────────────────
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for field "${err.path}".`;
  }

  // ── MongoDB duplicate key ─────────────────────────────────────────────────
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    message = `${field} is already registered.`;
  }

  // ── JWT errors ────────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = err.name === 'TokenExpiredError'
      ? 'Session expired. Please log in again.'
      : 'Invalid authentication token.';
  }

  // Log 5xx errors (server-side bugs should always be logged)
  if (statusCode >= 500) {
    console.error(`[Error] ${req.method} ${req.originalUrl} →`, err);
    if (!isDev()) {
      message = 'An unexpected error occurred.';
    }
  }

  const body = {
    status:  'error',
    message,
  };

  // Include stack trace in development for easier debugging
  if (isDev() && err.stack) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}

module.exports = errorHandler;
