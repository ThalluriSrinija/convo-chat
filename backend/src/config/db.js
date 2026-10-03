'use strict';

/**
 * config/db.js — MongoDB connection manager
 *
 * Connects Mongoose to MongoDB using MONGODB_URI.
 * Initialises the GridFS bucket once the connection is open.
 */

const mongoose = require('mongoose');
const { initGridFSBucket } = require('./gridfs');

async function connectDB() {
  const uri = process.env.MONGODB_URI;

  await mongoose.connect(uri, {
    dbName: process.env.DB_NAME || 'convo',
  });

  // GridFS must be initialised after connection is established
  initGridFSBucket(mongoose.connection);

  console.log(`[DB]   MongoDB connected → ${mongoose.connection.host}/${mongoose.connection.name} ✓`);

  mongoose.connection.on('disconnected', () =>
    console.warn('[DB]   MongoDB disconnected. Reconnecting…')
  );
  mongoose.connection.on('reconnected', () =>
    console.log('[DB]   MongoDB reconnected ✓')
  );
  mongoose.connection.on('error', (err) =>
    console.error('[DB]   MongoDB error:', err.message)
  );
}

async function disconnectDB() {
  await mongoose.connection.close();
  console.log('[DB]   MongoDB connection closed.');
}

module.exports = { connectDB, disconnectDB };
