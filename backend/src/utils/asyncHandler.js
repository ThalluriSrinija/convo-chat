'use strict';

/**
 * utils/asyncHandler.js
 *
 * Wraps async route handlers / controller functions so uncaught promise
 * rejections are automatically forwarded to Express's error handler.
 *
 * Without this wrapper, an unhandled rejection in an async route
 * crashes the process in Node < 15, or silently swallows the error in Express 4.
 *
 * Usage:
 *   router.get('/example', asyncHandler(async (req, res) => {
 *     const data = await SomeService.fetch();
 *     res.json(data);
 *   }));
 *
 * @param {Function} fn  — async (req, res, next) => Promise<void>
 * @returns {Function}   — standard Express (req, res, next) handler
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
