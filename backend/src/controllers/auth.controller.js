'use strict';

/**
 * controllers/auth.controller.js
 *
 * Authentication Controller
 *
 * Handles HTTP requests for:
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   POST /api/auth/logout
 *   GET  /api/auth/me
 */

const authService = require('../services/auth.service');
const { asyncHandler } = require('../utils/asyncHandler');
const { createError } = require('../utils/createError');

/**
 * POST /api/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const phoneNumber = req.body.phoneNumber || req.body.phone;

  const { user, token } = await authService.registerUser({
    name,
    phoneNumber,
    email,
    password,
  });

  res.status(201).json({
    message: 'User registered successfully.',
    token,
    user,
  });
});

/**
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const identifier = req.body.identifier || req.body.email || req.body.phoneNumber || req.body.phone;

  const { user, token } = await authService.loginUser({
    identifier,
    password,
  });

  res.status(200).json({
    message: 'Login successful.',
    token,
    user,
  });
});

/**
 * POST /api/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  await authService.invalidateUserSessions(req.user._id);

  if (res.clearCookie) {
    res.clearCookie('token');
  }

  res.status(200).json({
    message: 'Logged out successfully.',
  });
});

/**
 * GET /api/auth/me
 */
const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    status: 'success',
    user: req.user.toJSON ? req.user.toJSON() : req.user,
  });
});

/**
 * POST /api/auth/forgot-password — not implemented (requires verified OTP channel).
 */
const forgotPassword = asyncHandler(async (_req, _res) => {
  throw createError(501, 'Password reset is not available yet. Please contact support.');
});

/**
 * POST /api/auth/reset-password — not implemented (requires verified OTP channel).
 */
const resetPassword = asyncHandler(async (_req, _res) => {
  throw createError(501, 'Password reset is not available yet. Please contact support.');
});

module.exports = {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
};
