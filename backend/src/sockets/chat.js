'use strict';

/**
 * sockets/chat.js
 *
 * Real-Time Chat & Room Events
 *
 * Requirements:
 *   1. Authenticate Socket.IO connections (performed in handshake middleware)
 *   2. Connect authenticated users
 *   3. Allow users to join only conversations they belong to
 *   4. Create conversation-specific rooms
 *   5. Send messages through Socket.IO
 *   6. Persist messages in MongoDB
 *   7. Emit persisted messages to the other participant
 *   8. Update the sender UI immediately
 *   9. Update the receiver UI immediately
 *   10. Handle disconnects
 *   11. Handle reconnects
 *   12. Handle socket errors
 *
 * Events:
 *   - join_conversation (alias: conversation:join)
 *   - leave_conversation (alias: conversation:leave)
 *   - send_message (alias: message:send)
 *   - new_message (emitted to the other participant in conversation room)
 *   - message_error (emitted on errors / unauthorized requests)
 *   - typing:start, typing:stop
 */

const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const messageService = require('../services/message.service');

function registerChatHandlers(io, socket) {
  const currentUserId = socket.user._id.toString();

  async function assertConversationParticipant(conversationId) {
    if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
      return { ok: false, errorMsg: 'Invalid conversation ID format.' };
    }

    const conv = await Conversation.findById(conversationId);
    if (!conv) {
      return { ok: false, errorMsg: 'Conversation not found.' };
    }

    const isParticipant = conv.participants.some(
      (p) => p && p.toString() === currentUserId
    );
    if (!isParticipant) {
      return { ok: false, errorMsg: 'Forbidden: You are not a participant in this conversation.' };
    }

    return { ok: true, conversation: conv };
  }

  /**
   * Helper: handles joining a conversation room with full authorization check.
   */
  async function handleJoinConversation(payload, ack) {
    try {
      const conversationId =
        typeof payload === 'object' && payload !== null
          ? payload.conversationId
          : payload;

      if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
        const errorMsg = 'Invalid conversation ID format.';
        socket.emit('message_error', {
          event: 'join_conversation',
          conversationId,
          message: errorMsg,
          error: errorMsg,
        });
        if (typeof ack === 'function') ack({ success: false, message: errorMsg, error: errorMsg });
        return;
      }

      const access = await assertConversationParticipant(conversationId);
      if (!access.ok) {
        const errorMsg = access.errorMsg;
        socket.emit('message_error', {
          event: 'join_conversation',
          conversationId,
          message: errorMsg,
          error: errorMsg,
        });
        if (typeof ack === 'function') ack({ success: false, message: errorMsg, error: errorMsg });
        return;
      }

      // Join both standard prefixed room and raw ID room for maximum compatibility
      const convIdStr = conversationId.toString();
      socket.join(`conversation:${convIdStr}`);
      socket.join(convIdStr);

      if (typeof ack === 'function') {
        ack({ success: true, conversationId: convIdStr });
      }
    } catch (_err) {
      const errorMsg = 'Failed to join conversation.';
      socket.emit('message_error', {
        event: 'join_conversation',
        message: errorMsg,
        error: errorMsg,
      });
      if (typeof ack === 'function') {
        ack({ success: false, message: errorMsg, error: errorMsg });
      }
    }
  }

  /**
   * Helper: handles leaving a conversation room.
   */
  function handleLeaveConversation(payload) {
    const conversationId =
      typeof payload === 'object' && payload !== null
        ? payload.conversationId
        : payload;

    if (conversationId) {
      const convIdStr = conversationId.toString();
      socket.leave(`conversation:${convIdStr}`);
      socket.leave(convIdStr);
    }
  }

  /**
   * Helper: handles sending a text message via Socket.IO.
   * Persists message in MongoDB and emits new_message to the other participant.
   */
  async function handleSendMessage(payload, ack) {
    try {
      if (!payload || typeof payload !== 'object') {
        const errorMsg = 'Invalid message payload.';
        socket.emit('message_error', {
          event: 'send_message',
          message: errorMsg,
          error: errorMsg,
        });
        if (typeof ack === 'function') ack({ success: false, message: errorMsg, error: errorMsg });
        return;
      }

      const { conversationId } = payload;
      const text = payload.text !== undefined ? payload.text : payload.message;

      if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
        const errorMsg = 'Invalid conversation ID format.';
        socket.emit('message_error', {
          event: 'send_message',
          conversationId,
          message: errorMsg,
          error: errorMsg,
        });
        if (typeof ack === 'function') ack({ success: false, message: errorMsg, error: errorMsg });
        return;
      }

      if (!text || typeof text !== 'string' || !text.trim()) {
        const errorMsg = 'Message text is required and cannot be empty.';
        socket.emit('message_error', {
          event: 'send_message',
          conversationId,
          message: errorMsg,
          error: errorMsg,
        });
        if (typeof ack === 'function') ack({ success: false, message: errorMsg, error: errorMsg });
        return;
      }

      // Persist in MongoDB — sendTextMessage handles authorization, validation, saving,
      // and emitting new_message to other participants (excluding senderSocketId).
      const message = await messageService.sendTextMessage(
        socket.user._id,
        conversationId,
        text,
        { senderSocketId: socket.id }
      );

      // Return acknowledged response with persisted message to the sender
      if (typeof ack === 'function') {
        ack({ success: true, message });
      }
    } catch (err) {
      const errorMsg = err.statusCode && err.statusCode < 500
        ? (err.message || 'Failed to send message.')
        : 'Failed to send message.';
      socket.emit('message_error', {
        event: 'send_message',
        conversationId: payload?.conversationId,
        message: errorMsg,
        error: errorMsg,
      });
      if (typeof ack === 'function') {
        ack({
          success: false,
          message: errorMsg,
          error: errorMsg,
        });
      }
    }
  }

  // Register primary event names
  socket.on('join_conversation', handleJoinConversation);
  socket.on('leave_conversation', handleLeaveConversation);
  socket.on('send_message', handleSendMessage);

  // Register aliases for full compatibility
  socket.on('conversation:join', handleJoinConversation);
  socket.on('conversation:leave', handleLeaveConversation);
  socket.on('message:send', handleSendMessage);

  async function emitTyping(conversationId, isTyping) {
    if (!conversationId) return;
    const access = await assertConversationParticipant(conversationId);
    if (!access.ok) return;

    socket.to(`conversation:${conversationId}`).emit('typing:user', {
      conversationId,
      userId: currentUserId,
      name:   socket.user.name,
      isTyping,
    });
  }

  // Typing indicators (participant-only)
  socket.on('typing:start', ({ conversationId }) => {
    emitTyping(conversationId, true);
  });

  socket.on('typing:stop', ({ conversationId }) => {
    emitTyping(conversationId, false);
  });

  // Edit message handler via socket
  socket.on('message_edit', async (payload, ack) => {
    try {
      const { messageId, text } = payload || {};
      const updated = await messageService.editMessage(socket.user._id, messageId, text);
      if (typeof ack === 'function') ack({ success: true, message: updated });
    } catch (err) {
      if (typeof ack === 'function') ack({ success: false, error: err.message });
    }
  });

  // Delete message handler via socket
  socket.on('message_delete', async (payload, ack) => {
    try {
      const { messageId, mode } = payload || {};
      const res = await messageService.deleteMessage(socket.user._id, messageId, mode || 'me');
      if (typeof ack === 'function') ack({ success: true, ...res });
    } catch (err) {
      if (typeof ack === 'function') ack({ success: false, error: err.message });
    }
  });

  // Ephemeral image view handler via socket
  socket.on('message_view', async (payload, ack) => {
    try {
      const { messageId } = payload || {};
      const res = await messageService.recordImageView(socket.user._id, messageId);
      if (typeof ack === 'function') ack({ success: true, ...res });
    } catch (err) {
      if (typeof ack === 'function') ack({ success: false, error: err.message });
    }
  });
}

module.exports = { registerChatHandlers };
