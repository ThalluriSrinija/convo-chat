'use strict';

/**
 * utils/createError.js
 *
 * Factory for consistent HTTP errors throughout the application.
 *
 * Usage:
 *   throw createError(400, 'Email is required.');
 *   next(createError(403, 'Access denied.'));
 *
 * @param {number} statusCode
 * @param {string} message
 * @returns {Error}
 */
function createError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

module.exports = { createError };
