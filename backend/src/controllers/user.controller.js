'use strict';

/**
 * controllers/user.controller.js
 *
 * User Controller
 *
 * Handles HTTP requests for:
 *   GET /api/users
 *   GET /api/users/search?q=<query>
 */

const userService = require('../services/user.service');
const { asyncHandler } = require('../utils/asyncHandler');
const { createError } = require('../utils/createError');

/**
 * GET /api/users
 * Fetches all users excluding the currently authenticated user.
 */
const getUsers = asyncHandler(async (req, res) => {
  const users = await userService.getAllUsers(req.user._id);
  res.status(200).json(users);
});

/**
 * GET /api/users/search
 * Searches users by name, email, or phone number.
 */
const searchUsers = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (q === undefined) {
    throw createError(400, 'Search query parameter "q" is required.');
  }

  const users = await userService.searchUsers(req.user._id, q);
  res.status(200).json(users);
});

module.exports = {
  getUsers,
  searchUsers,
};
