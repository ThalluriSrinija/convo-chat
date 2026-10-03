'use strict';

/**
 * routes/index.js — Route aggregator
 *
 * Mounts all API route modules under /api.
 * Add new route modules here as they are implemented.
 *
 * Current routes:
 *   GET  /api/health           — Server + DB health check
 *
 * Coming in future modules:
 *   POST /api/auth/register    — Module 14
 *   POST /api/auth/login       — Module 14
 *   POST /api/auth/logout      — Module 14
 *   GET  /api/users            — Module 15
 *   GET  /api/users/search     — Module 15
 *   POST /api/conversations    — Module 16
 *   GET  /api/conversations    — Module 16
 *   GET  /api/messages/:id     — Module 17
 *   POST /api/messages         — Module 17
 *   POST /api/messages/image   — Module 17
 */

const express = require('express');

const healthRouter       = require('./health');
const authRouter         = require('./auth');
const userRouter         = require('./users');
const conversationRouter = require('./conversations');
const messageRouter      = require('./messages');

const router = express.Router();

// ── Mounted routes ────────────────────────────────────────────────────────────
router.use('/health',        healthRouter);
router.use('/auth',          authRouter);
router.use('/users',         userRouter);
router.use('/conversations', conversationRouter);
router.use('/messages',      messageRouter);

module.exports = router;
