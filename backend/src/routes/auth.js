'use strict';

/**
 * routes/auth.js
 *
 * Authentication Routes
 *
 * Endpoints:
 *   POST /api/auth/register — Register a new user
 *   POST /api/auth/login    — Log in with email or phone + password
 *   POST /api/auth/logout   — Log out current user
 *   GET  /api/auth/me       — Fetch authenticated current user profile
 */

const express = require('express');
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authenticate, authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
