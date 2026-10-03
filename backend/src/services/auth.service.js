'use strict';

/**
 * services/auth.service.js
 *
 * Authentication Business Logic
 *
 * Handles user registration, credentials verification,
 * and JWT token generation.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createError } = require('../utils/createError');

/**
 * Generates a signed JWT for the given user.
 *
 * @param {object} user - User document
 * @returns {string} Signed JWT token
 */
function generateToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured.');
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      tokenVersion: user.tokenVersion ?? 0,
    },
    secret,
    { expiresIn }
  );
}

/**
 * Invalidates all existing JWTs for the user (e.g. on logout).
 *
 * @param {string|import('mongoose').Types.ObjectId} userId
 */
async function invalidateUserSessions(userId) {
  await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
}

/**
 * Registers a new user account.
 *
 * @param {object} data
 * @param {string} data.name
 * @param {string} data.phoneNumber
 * @param {string} data.email
 * @param {string} data.password
 * @returns {Promise<{ user: object, token: string }>}
 */
async function registerUser({ name, phoneNumber, email, password }) {
  // 1. Basic validation
  if (!name || !name.trim()) {
    throw createError(400, 'Name is required.');
  }
  if (!email || !email.trim()) {
    throw createError(400, 'Email is required.');
  }
  if (!phoneNumber || !phoneNumber.trim()) {
    throw createError(400, 'Phone number is required.');
  }
  if (!password) {
    throw createError(400, 'Password is required.');
  }

  const trimmedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phoneNumber.trim().replace(/\s+/g, '');

  if (trimmedName.length < 2 || trimmedName.length > 60) {
    throw createError(400, 'Name must be between 2 and 60 characters.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedEmail)) {
    throw createError(400, 'Please enter a valid email address.');
  }

  const phoneRegex = /^\+[1-9]\d{6,14}$/;
  if (!phoneRegex.test(normalizedPhone)) {
    throw createError(400, 'Phone must be in E.164 format, e.g. +919876543210.');
  }

  if (password.length < 8) {
    throw createError(400, 'Password must be at least 8 characters long.');
  }

  // 2. Check duplicate email
  const existingEmail = await User.findOne({ email: normalizedEmail });
  if (existingEmail) {
    throw createError(409, 'An account with this email already exists.');
  }

  // 3. Check duplicate phone number
  const existingPhone = await User.findOne({ phoneNumber: normalizedPhone });
  if (existingPhone) {
    throw createError(409, 'An account with this phone number already exists.');
  }

  // 4. Create user instance & hash password via model method
  const user = new User({
    name: trimmedName,
    email: normalizedEmail,
    phoneNumber: normalizedPhone,
  });

  await user.setPassword(password);
  await user.save();

  // 5. Generate token
  const token = generateToken(user);

  return {
    user: user.toJSON(),
    token,
  };
}

/**
 * Authenticates an existing user using email or phone number and password.
 *
 * @param {object} credentials
 * @param {string} credentials.identifier - Email or phone number
 * @param {string} credentials.password - Plaintext password
 * @returns {Promise<{ user: object, token: string }>}
 */
async function loginUser({ identifier, password }) {
  if (!identifier || !identifier.trim()) {
    throw createError(400, 'Email or phone number is required.');
  }
  if (!password) {
    throw createError(400, 'Password is required.');
  }

  const cleanIdentifier = identifier.trim();

  // Find user by email (case-insensitive) OR by phone number
  const query = {
    $or: [
      { email: cleanIdentifier.toLowerCase() },
      { phoneNumber: cleanIdentifier },
    ],
  };

  const user = await User.findOne(query).select('+passwordHash');
  if (!user) {
    throw createError(401, 'Invalid email/phone or password.');
  }

  const isPasswordValid = await user.verifyPassword(password);
  if (!isPasswordValid) {
    throw createError(401, 'Invalid email/phone or password.');
  }

  const token = generateToken(user);

  return {
    user: user.toJSON(),
    token,
  };
}

module.exports = {
  generateToken,
  registerUser,
  loginUser,
  invalidateUserSessions,
};
