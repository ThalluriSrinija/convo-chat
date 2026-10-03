'use strict';

/**
 * routes/health.js
 *
 * GET /api/health
 *
 * Returns the current operational status of the server and MongoDB connection.
 * Used by:
 *   • Load balancers / uptime monitors
 *   • Development — quick sanity check that the server started correctly
 *   • CI/CD pipelines
 */

const express  = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/', (req, res) => {
  const dbState = mongoose.connection.readyState;

  // Mongoose readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  const dbStateLabel = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] ?? 'unknown';
  const dbOk = dbState === 1;

  const status = dbOk ? 'ok' : 'degraded';
  const httpStatus = dbOk ? 200 : 503;

  res.status(httpStatus).json({
    status,
    timestamp: new Date().toISOString(),
    uptime:    Math.floor(process.uptime()),   // seconds since server start
    environment: process.env.NODE_ENV || 'development',
    db: {
      status: dbStateLabel,
      name:   mongoose.connection.name || null,
    },
    version: process.env.npm_package_version || '1.0.0',
  });
});

module.exports = router;
