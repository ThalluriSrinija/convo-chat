'use strict';

/**
 * sockets/index.js — Socket.IO Server Setup & Central Dispatcher
 *
 * Responsibilities:
 *   1. Initialise Socket.IO with CORS settings
 *   2. Authenticate connections via JWT handshake
 *   3. Manage personal user rooms ('user:<userId>')
 *   4. Track online/offline presence
 *   5. Register chat & typing handlers
 *   6. Provide getIO() for REST endpoints to emit real-time events
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { registerChatHandlers } = require('./chat');
const {
  userConnected,
  userDisconnected,
  isUserOnline,
  getOnlineUserIds,
} = require('./presence');

let _io = null;

function initSockets(httpServer) {
  if (_io) return _io;

  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

  _io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // ── Authentication Middleware ─────────────────────────────────────────────
  _io.use(async (socket, next) => {
    try {
      // Token must be in auth payload or Authorization header (not query — avoids log/referrer leaks)
      let token = socket.handshake.auth?.token;

      if (!token && socket.handshake.headers?.authorization) {
        const header = socket.handshake.headers.authorization;
        if (header.startsWith('Bearer ')) {
          token = header.split(' ')[1];
        }
      }

      if (!token) {
        return next(new Error('Authentication required. No token provided.'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded || !decoded.id) {
        return next(new Error('Invalid token payload.'));
      }

      const user = await User.findById(decoded.id).select('-passwordHash').lean();
      if (!user) {
        return next(new Error('User no longer exists.'));
      }

      const tokenVersion = decoded.tokenVersion ?? 0;
      if (tokenVersion !== (user.tokenVersion ?? 0)) {
        return next(new Error('Session expired. Please log in again.'));
      }

      socket.user = user;
      next();
    } catch (_err) {
      next(new Error('Authentication failed.'));
    }
  });

  // ── Connection Handler ───────────────────────────────────────────────────
  _io.on('connection', (socket) => {
    const userId = socket.user._id.toString();

    // Join user's individual room for personal notifications
    socket.join(`user:${userId}`);

    // Update presence
    const isFirstConnection = userConnected(userId, socket.id);
    if (isFirstConnection) {
      socket.broadcast.emit('user:online', {
        userId,
        name: socket.user.name,
      });
    }

    // Send current list of online users to the newly connected socket
    socket.emit('presence:list', {
      onlineUserIds: getOnlineUserIds(),
    });

    // Register chat & typing event handlers
    registerChatHandlers(_io, socket);

    // Socket error handler
    socket.on('error', (err) => {
      console.error(`[Socket.IO] Error on socket ${socket.id}:`, err?.message || err);
      socket.emit('message_error', {
        message: err?.message || 'Socket connection error',
        error: err?.message || 'Socket connection error',
      });
    });

    // Disconnect event
    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Client disconnected (${socket.id}): ${reason}`);
      const becameOffline = userDisconnected(userId, socket.id);
      if (becameOffline) {
        _io.emit('user:offline', {
          userId,
        });
      }
    });
  });

  console.log('[Socket.IO] Server initialised and listening for connections ✓');
  return _io;
}

function getIO() {
  if (!_io) {
    throw new Error('Socket.IO is not initialised yet. Call initSockets() first.');
  }
  return _io;
}

module.exports = {
  initSockets,
  getIO,
  isUserOnline,
  getOnlineUserIds,
};
