'use strict';

/**
 * routes/users.js
 *
 * User Routes (Protected)
 *
 * Endpoints:
 *   GET /api/users        — Fetch all visible users (excluding current user)
 *   GET /api/users/search — Search users by name, email, or phone
 */

const express = require('express');
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

router.get('/search', userController.searchUsers);
router.get('/',       userController.getUsers);

module.exports = router;
