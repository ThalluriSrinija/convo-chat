'use strict';

/**
 * server.js — Application entry point
 *
 * Startup sequence:
 *   1. Load .env
 *   2. Validate required environment variables
 *   3. Connect to MongoDB
 *   4. Create Express app
 *   5. Create HTTP server
 *   6. Start listening
 *
 * Graceful shutdown:
 *   SIGTERM / SIGINT → close HTTP server → close MongoDB → exit 0
 */

// ── 1. Load environment variables ─────────────────────────────────────────────
require('dotenv').config();

// ── 2. Validate env vars ──────────────────────────────────────────────────────
const { validateEnv } = require('./config/env');
validateEnv();

// ── 3. Import everything else AFTER env is validated ─────────────────────────
const http            = require('http');
const { connectDB, disconnectDB } = require('./config/db');
const { createApp }   = require('./app');
const { initSockets } = require('./sockets');

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  try {
    // 3. Connect to MongoDB (also inits GridFS bucket)
    await connectDB();

    // 4. Create Express application
    const app = createApp();

    // 5. Create HTTP server (needed for Socket.IO)
    const httpServer = http.createServer(app);

    // 6. Initialise Socket.IO
    initSockets(httpServer);

    // 7. Start listening
    httpServer.listen(PORT, () => {
      console.log('');
      console.log('┌─────────────────────────────────────────┐');
      console.log(`│  🚀  Convo API server running            │`);
      console.log(`│      http://localhost:${PORT}               │`);
      console.log(`│      ENV: ${(process.env.NODE_ENV || 'development').padEnd(30)}│`);
      console.log('└─────────────────────────────────────────┘');
      console.log('');
      console.log(`[Health] GET http://localhost:${PORT}/api/health`);
      console.log('');
    });

    // ── Graceful shutdown ───────────────────────────────────────────────────
    const shutdown = async (signal) => {
      console.log(`\n[Server] ${signal} received — shutting down gracefully…`);

      httpServer.close(async () => {
        console.log('[Server] HTTP server closed.');
        await disconnectDB();
        console.log('[Server] Goodbye. 👋');
        process.exit(0);
      });

      // Force exit if graceful shutdown takes too long
      setTimeout(() => {
        console.error('[Server] Shutdown timed out — forcing exit.');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

  } catch (err) {
    console.error('[Server] ❌  Failed to start:', err.message);
    process.exit(1);
  }
}

startServer();
