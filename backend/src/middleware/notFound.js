'use strict';

/**
 * middleware/notFound.js
 *
 * Catches requests that didn't match any registered route
 * and forwards a structured 404 error to the error handler.
 */

const { createError } = require('../utils/createError');

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function notFound(req, res, next) {
  next(createError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

module.exports = notFound;
