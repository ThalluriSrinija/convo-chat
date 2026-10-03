'use strict';

/**
 * middleware/auth.js
 *
 * JWT Authentication Middleware
 *
 * Verifies JWT token from Authorization header (Bearer <token>)
 * or optional auth cookie.
 * Attaches the authenticated user document to req.user (excluding passwordHash).
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createError } = require('../utils/createError');

async function authenticate(req, res, next) {
  try {
    let token = null;

    // 1. Check Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      // 2. Allow query parameter token (used by media streaming <img> tags)
      token = req.query.token;
    } else if (req.cookies && req.cookies.token) {
      // 3. Fallback to cookie if present
      token = req.cookies.token;
    }

    if (!token) {
      return next(createError(401, 'Authentication required. No token provided.'));
    }

    // 3. Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) {
      return next(createError(401, 'Invalid authentication token.'));
    }

    // 4. Fetch user from DB (excluding passwordHash)
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return next(createError(401, 'User associated with this token no longer exists.'));
    }

    const tokenVersion = decoded.tokenVersion ?? 0;
    if (tokenVersion !== (user.tokenVersion ?? 0)) {
      return next(createError(401, 'Session expired. Please log in again.'));
    }

    // 5. Attach user to request
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return next(createError(401, err.name === 'TokenExpiredError'
        ? 'Session expired. Please log in again.'
        : 'Invalid authentication token.'));
    }
    next(err);
  }
}

module.exports = { authenticate };
