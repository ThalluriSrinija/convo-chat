'use strict';

/**
 * services/user.service.js
 *
 * User Service
 *
 * Handles fetching visible users and searching users by
 * name, email, or phone number.
 */

const User = require('../models/User');
const { createError } = require('../utils/createError');

/**
 * Formats a raw user document or lean object for frontend consumption.
 *
 * @param {object} user - User document or lean object
 * @returns {object} Formatted user object
 */
function formatUser(user) {
  return {
    _id:         user._id.toString(),
    name:        user.name,
    email:       user.email,
    phoneNumber: user.phoneNumber,
    phone:       user.phoneNumber, // alias for frontend compatibility
    avatarColor: user.avatarColor || '#6c63ff',
    createdAt:   user.createdAt,
  };
}

/**
 * Fetches all registered users, excluding the current user.
 *
 * @param {string|import('mongoose').Types.ObjectId} currentUserId
 * @returns {Promise<Array<object>>}
 */
async function getAllUsers(currentUserId) {
  const users = await User.find({ _id: { $ne: currentUserId } })
    .select('_id name email phoneNumber avatarColor createdAt')
    .sort({ name: 1 })
    .lean();

  return users.map(formatUser);
}

/**
 * Searches users by name, email, or phone number.
 * Excludes the current user.
 *
 * @param {string|import('mongoose').Types.ObjectId} currentUserId
 * @param {string} query - Search term
 * @returns {Promise<Array<object>>}
 */
async function searchUsers(currentUserId, query) {
  if (query === undefined || query === null) {
    throw createError(400, 'Search query parameter "q" is required.');
  }

  const trimmedQuery = String(query).trim();
  if (trimmedQuery.length === 0) {
    return [];
  }

  // Escape special regex characters to prevent ReDoS and regex syntax errors
  const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const searchRegex = new RegExp(escapedQuery, 'i');

  const filter = {
    _id: { $ne: currentUserId },
    $or: [
      { name: searchRegex },
      { email: searchRegex },
      { phoneNumber: searchRegex },
    ],
  };

  const users = await User.find(filter)
    .select('_id name email phoneNumber avatarColor createdAt')
    .sort({ name: 1 })
    .limit(50)
    .lean();

  return users.map(formatUser);
}

module.exports = {
  getAllUsers,
  searchUsers,
  formatUser,
};
