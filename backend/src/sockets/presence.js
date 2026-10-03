'use strict';

/**
 * sockets/presence.js
 *
 * User Presence Tracking
 *
 * Tracks which users have active socket connections and
 * broadcasts online/offline status changes.
 */

// Map of userId string -> Set of active socket IDs
const onlineUsers = new Map();

/**
 * Marks a user as online with the given socket ID.
 *
 * @param {string} userId
 * @param {string} socketId
 * @returns {boolean} True if this is the user's first active connection
 */
function userConnected(userId, socketId) {
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  const sockets = onlineUsers.get(userId);
  const wasOffline = sockets.size === 0;
  sockets.add(socketId);
  return wasOffline;
}

/**
 * Removes a socket ID for a user.
 *
 * @param {string} userId
 * @param {string} socketId
 * @returns {boolean} True if the user has no remaining active connections (is now offline)
 */
function userDisconnected(userId, socketId) {
  if (!onlineUsers.has(userId)) return false;

  const sockets = onlineUsers.get(userId);
  sockets.delete(socketId);

  if (sockets.size === 0) {
    onlineUsers.delete(userId);
    return true;
  }
  return false;
}

/**
 * Checks if a user is currently online.
 *
 * @param {string} userId
 * @returns {boolean}
 */
function isUserOnline(userId) {
  return onlineUsers.has(userId) && onlineUsers.get(userId).size > 0;
}

/**
 * Returns an array of all currently online user IDs.
 *
 * @returns {string[]}
 */
function getOnlineUserIds() {
  return Array.from(onlineUsers.keys());
}

module.exports = {
  userConnected,
  userDisconnected,
  isUserOnline,
  getOnlineUserIds,
};
