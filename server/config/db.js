'use strict';

/**
 * db.js — MongoDB connection manager
 *
 * Establishes and maintains a single Mongoose connection.
 * Initialises the GridFS bucket for image storage once the connection is open.
 *
 * Usage:
 *   const { connectDB } = require('./config/db');
 *   await connectDB();
 *
 * After connectDB() resolves, the GridFS bucket is available via:
 *   const { getGridFSBucket } = require('./config/gridfs');
 */

const mongoose = require('mongoose');
const { initGridFSBucket } = require('./gridfs');

/**
 * Connect to MongoDB using the MONGODB_URI environment variable.
 * Registers event listeners for connection health monitoring.
 *
 * @returns {Promise<void>}
 * @throws If MONGODB_URI is not set or if the initial connection fails.
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      '[DB] MONGODB_URI is not set. ' +
      'Create server/.env from server/.env.example and restart.'
    );
  }

  // Mongoose 8 default options are production-safe; no need to pass useNewUrlParser etc.
  await mongoose.connect(uri, {
    dbName: process.env.DB_NAME || 'convo',
  });

  // Initialise GridFS bucket on the native connection (must happen after connect)
  initGridFSBucket(mongoose.connection);

  console.log(`[DB] Connected to MongoDB: ${mongoose.connection.host}`);

  // ── Connection event listeners ────────────────────────────────────────────

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB disconnected. Attempting to reconnect…');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[DB] MongoDB reconnected.');
  });

  mongoose.connection.on('error', (err) => {
    console.error('[DB] MongoDB connection error:', err.message);
  });
}

/**
 * Gracefully close the MongoDB connection.
 * Call this before process exit (e.g. SIGTERM handler).
 *
 * @returns {Promise<void>}
 */
async function disconnectDB() {
  await mongoose.connection.close();
  console.log('[DB] MongoDB connection closed.');
}

module.exports = { connectDB, disconnectDB };
