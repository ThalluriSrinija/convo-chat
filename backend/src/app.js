'use strict';

/**
 * app.js — Express application factory
 *
 * Creates and configures the Express app:
 *   1. Security headers (helmet)
 *   2. CORS
 *   3. Body parsers
 *   4. Request logger (morgan)
 *   5. API routes
 *   6. 404 handler
 *   7. Global error handler
 *
 * Exported as a factory so it can be used by both server.js (real server)
 * and future test suites (supertest) without starting a listening socket.
 */

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const requestLogger = require('./middleware/requestLogger');
const notFound     = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const apiRoutes    = require('./routes/index');

function createApp() {
  const app = express();

  // ── 1. Security headers ─────────────────────────────────────────────────────
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // ── 2. CORS ─────────────────────────────────────────────────────────────────
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. curl, mobile apps, Postman)
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin "${origin}" is not allowed.`));
        }
      },
      credentials: true,   // allow cookies / Authorization headers cross-origin
      methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // ── 3. Body parsers ─────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));             // JSON bodies
  app.use(express.urlencoded({ extended: true, limit: '1mb' })); // form bodies

  // ── 4. Request logger ───────────────────────────────────────────────────────
  app.use(requestLogger);

  // ── 5. API routes ───────────────────────────────────────────────────────────
  app.use('/api', apiRoutes);
  app.use('/',    apiRoutes);

  // ── 6. 404 for unmatched routes ─────────────────────────────────────────────
  app.use(notFound);

  // ── 7. Global error handler (must be last) ───────────────────────────────────
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
