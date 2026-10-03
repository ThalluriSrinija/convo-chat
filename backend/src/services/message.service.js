'use strict';

/**
 * services/message.service.js
 *
 * Message Business Logic
 *
 * Handles sending text & image messages, GridFS file storage,
 * and retrieving chronological message history & image streams.
 */

const mongoose = require('mongoose');
const { Message } = require('../models/Message');
const Conversation = require('../models/Conversation');
const { createError } = require('../utils/createError');
const {
  openUploadStream,
  openDownloadStream,
  getGridFSBucket,
} = require('../config/gridfs');

/**
 * Formats a message document for API responses.
 * Takes currentUserId to determine view count, expiration and deletion status.
 *
 * @param {object} m - Raw message document or lean object
 * @param {string|mongoose.Types.ObjectId} [currentUserId] - Optional viewer context
 * @returns {object} Formatted message object
 */
function formatMessage(m, currentUserId = null) {
  const convId = m.conversationId ? m.conversationId.toString() : '';
  const imgId  = m.imageFileId ? m.imageFileId.toString() : null;
  const currentUserIdStr = currentUserId ? currentUserId.toString() : null;

  // View count for this specific viewer
  let myViewCount = 0;
  if (currentUserIdStr && Array.isArray(m.viewedBy)) {
    const record = m.viewedBy.find((v) => v.userId && v.userId.toString() === currentUserIdStr);
    if (record) myViewCount = record.viewCount || 0;
  }

  const viewLimit = m.viewLimit || (m.viewType === 'once' ? 1 : m.viewType === 'twice' ? 2 : null);
  const isSender = currentUserIdStr && m.senderId && m.senderId.toString() === currentUserIdStr;
  // If viewLimit applies and viewer is not sender, check if expired
  const isExpired = Boolean(viewLimit && !isSender && myViewCount >= viewLimit);

  // If deleted for everyone
  const isDeletedForEveryone = Boolean(m.isDeletedForEveryone);

  return {
    _id:                  m._id.toString(),
    conversationId:       convId,
    senderId:             m.senderId ? m.senderId.toString() : '',
    messageType:          m.messageType,
    text:                 isDeletedForEveryone ? 'This message was unsent' : (m.text || null),
    imageFileId:          (isDeletedForEveryone || isExpired) ? null : imgId,
    imageUrl:             (isDeletedForEveryone || isExpired || !imgId)
                            ? null
                            : `/api/conversations/${convId}/images/${imgId}`,
    isDeletedForEveryone,
    isEdited:             Boolean(m.isEdited),
    editedAt:             m.editedAt || null,
    viewType:             m.viewType || 'regular',
    viewLimit:            viewLimit,
    viewCount:            myViewCount,
    isExpired,
    sentAt:               m.createdAt,
    createdAt:            m.createdAt,
    updatedAt:            m.updatedAt,
  };
}

/**
 * Broadcasts a newly created message to conversation room and participants.
 */
function notifyMessageCreated(conversation, message, senderSocketId = null) {
  try {
    const { getIO } = require('../sockets');
    const io = getIO();
    if (!io) return;

    const formatted = formatMessage(message);
    const convId = conversation._id.toString();

    const target = io.to(`conversation:${convId}`).to(convId);
    if (senderSocketId) {
      target.except(senderSocketId).emit('new_message', formatted);
    } else {
      target.emit('new_message', formatted);
    }

    // Notify each participant's personal room with updated conversation metadata
    conversation.participants.forEach((pId) => {
      io.to(`user:${pId.toString()}`).emit('conversation:updated', {
        conversationId: convId,
        lastMessage:    conversation.lastMessage,
        updatedAt:      conversation.updatedAt,
      });
    });
  } catch {
    // Socket not ready or running outside server
  }
}

/**
 * Sends a plain text message to a conversation.
 *
 * @param {string|mongoose.Types.ObjectId} currentUserId - Authenticated sender
 * @param {string} conversationId - Target conversation
 * @param {string} text - Message text
 * @param {object} [options] - Options (e.g. senderSocketId)
 * @returns {Promise<object>} Created message object
 */
async function sendTextMessage(currentUserId, conversationId, text, options = {}) {
  if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
    throw createError(400, 'Invalid conversation ID format.');
  }

  // Reject empty or whitespace-only text
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw createError(400, 'Message text is required and cannot be empty.');
  }

  const trimmedText = text.trim();
  if (trimmedText.length > 2000) {
    throw createError(400, 'Message text cannot exceed 2000 characters.');
  }

  // Verify conversation exists
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw createError(404, 'Conversation not found.');
  }

  // Verify user belongs to the conversation
  const isParticipant = conversation.participants.some(
    (p) => p && p.toString() === currentUserId.toString()
  );

  if (!isParticipant) {
    throw createError(403, 'Forbidden: You are not a participant in this conversation.');
  }

  // Create message — NEVER trust senderId from client payload; always use currentUserId
  const message = new Message({
    conversationId: conversation._id,
    senderId: currentUserId,
    messageType: 'text',
    text: trimmedText,
  });

  await message.save();

  // Update conversation's lastMessage and updatedAt
  conversation.lastMessage = {
    text: message.text,
    messageType: 'text',
    sentAt: message.createdAt,
    senderId: currentUserId,
  };
  await conversation.save();

  notifyMessageCreated(conversation, message, options.senderSocketId);

  return formatMessage(message);
}

/**
 * Uploads an image to GridFS and creates an IMAGE message in the conversation.
 *
 * Requirements:
 *   - Authenticated user must belong to conversation
 *   - File binary is stored in GridFS, NOT in the message document
 *   - messageType is 'image'
 *   - Stores GridFS file ID in the message
 *
 * @param {string|mongoose.Types.ObjectId} currentUserId
 * @param {string} conversationId
 * @param {object} file - Multer file object with validated buffer, validatedMime, validatedExt
 * @returns {Promise<object>} Created message object
 */
async function sendImageMessage(currentUserId, conversationId, file, captionText = null, options = {}) {
  if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
    throw createError(400, 'Invalid conversation ID format.');
  }

  if (!file || !file.buffer) {
    throw createError(400, 'Image file data is required.');
  }

  // Verify conversation exists
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw createError(404, 'Conversation not found.');
  }

  // Verify user belongs to the conversation
  const isParticipant = conversation.participants.some(
    (p) => p && p.toString() === currentUserId.toString()
  );

  if (!isParticipant) {
    throw createError(403, 'Forbidden: You are not a participant in this conversation.');
  }

  // Determine viewType: 'regular' | 'once' | 'twice'
  let viewType = 'regular';
  let viewLimit = null;
  if (options.viewType === 'once' || options.viewLimit === 1) {
    viewType = 'once';
    viewLimit = 1;
  } else if (options.viewType === 'twice' || options.viewLimit === 2) {
    viewType = 'twice';
    viewLimit = 2;
  }

  // Generate unique filename
  const ext = file.validatedExt || 'jpg';
  const mimeType = file.validatedMime || 'image/jpeg';
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;

  // Stream binary to GridFS
  const uploadStream = openUploadStream(filename, {
    contentType:    mimeType,
    conversationId: conversation._id.toString(),
    senderId:       currentUserId.toString(),
  });

  await new Promise((resolve, reject) => {
    uploadStream.on('error', reject);
    uploadStream.on('finish', resolve);
    uploadStream.end(file.buffer);
  });

  const fileId = uploadStream.id;
  const trimmedCaption = typeof captionText === 'string' && captionText.trim() ? captionText.trim() : null;

  // Create message document referencing GridFS file ID (never storing raw binary in document)
  const message = new Message({
    conversationId: conversation._id,
    senderId:       currentUserId,
    messageType:    'image',
    imageFileId:    fileId,
    text:           trimmedCaption,
    viewType,
    viewLimit,
    viewedBy:       [],
  });

  await message.save();

  // Update conversation's lastMessage and updatedAt
  const lastMsgPreview = viewType === 'once' ? '📷 Photo (View once)' : viewType === 'twice' ? '📷 Photo (View twice)' : (trimmedCaption || '[Image]');
  conversation.lastMessage = {
    text:        lastMsgPreview,
    imageFileId: fileId,
    messageType: 'image',
    sentAt:      message.createdAt,
    senderId:    currentUserId,
  };
  await conversation.save();

  notifyMessageCreated(conversation, message);

  return formatMessage(message, currentUserId);
}

/**
 * Retrieves a download stream for an image stored in GridFS,
 * strictly verifying that the authenticated user participates in the conversation.
 *
 * @param {string|mongoose.Types.ObjectId} currentUserId
 * @param {string} fileId
 * @param {string} [conversationId]
 * @returns {Promise<{ stream: import('mongodb').GridFSBucketReadStream, contentType: string, filename: string, length: number }>}
 */
async function getImageStream(currentUserId, fileId, conversationId) {
  if (!fileId || !mongoose.Types.ObjectId.isValid(fileId)) {
    throw createError(400, 'Invalid image file ID format.');
  }

  // Find the message referencing this image
  const message = await Message.findOne({ imageFileId: fileId });
  if (!message) {
    throw createError(404, 'Image not found.');
  }

  // If message was unsent / deleted for everyone, or deleted for user
  if (message.isDeletedForEveryone) {
    throw createError(410, 'This image has been unsent.');
  }

  const currentUserIdStr = currentUserId.toString();
  if (message.deletedFor && message.deletedFor.some((id) => id && id.toString() === currentUserIdStr)) {
    throw createError(404, 'Image not found.');
  }

  // If conversationId is specified in URL, verify matching
  if (conversationId && message.conversationId.toString() !== conversationId.toString()) {
    throw createError(404, 'Image does not belong to this conversation.');
  }

  // Check conversation authorization
  const conversation = await Conversation.findById(message.conversationId);
  if (!conversation) {
    throw createError(404, 'Conversation not found.');
  }

  const isParticipant = conversation.participants.some(
    (p) => p && p.toString() === currentUserIdStr
  );

  if (!isParticipant) {
    throw createError(403, 'Forbidden: You are not authorized to view images from this conversation.');
  }

  // Check view limit for recipient (if not sender)
  const isSender = message.senderId.toString() === currentUserIdStr;
  const viewLimit = message.viewLimit || (message.viewType === 'once' ? 1 : message.viewType === 'twice' ? 2 : null);

  if (viewLimit && !isSender) {
    const userView = message.viewedBy?.find((v) => v.userId && v.userId.toString() === currentUserIdStr);
    const viewCount = userView ? userView.viewCount : 0;
    if (viewCount > viewLimit) {
      throw createError(410, 'This photo has expired.');
    }
  }

  // Find GridFS file metadata
  const bucket = getGridFSBucket();
  const fileObjectId = new mongoose.Types.ObjectId(fileId);
  const files = await bucket.find({ _id: fileObjectId }).toArray();
  if (!files || files.length === 0) {
    throw createError(404, 'Image data not found in storage.');
  }

  const fileDoc = files[0];
  const stream = openDownloadStream(fileObjectId);

  return {
    stream,
    contentType: fileDoc.contentType || fileDoc.metadata?.contentType || 'image/jpeg',
    filename:    fileDoc.filename || `image-${fileId}`,
    length:      fileDoc.length,
  };
}

/**
 * Fetches all messages for a conversation in chronological order (oldest first).
 * Excludes messages deleted by the current user ("Delete for me").
 *
 * @param {string|mongoose.Types.ObjectId} currentUserId - Authenticated user
 * @param {string} conversationId - Target conversation
 * @param {object} [options] - Optional pagination controls
 * @returns {Promise<Array<object>>} Chronological message list
 */
async function getConversationMessages(currentUserId, conversationId, options = {}) {
  if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
    throw createError(400, 'Invalid conversation ID format.');
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw createError(404, 'Conversation not found.');
  }

  // Verify user belongs to the conversation
  const isParticipant = conversation.participants.some(
    (p) => p && p.toString() === currentUserId.toString()
  );

  if (!isParticipant) {
    throw createError(403, 'Forbidden: You are not a participant in this conversation.');
  }

  // Filter out messages that current user deleted for themselves
  const filter = {
    conversationId: conversation._id,
    deletedFor: { $ne: currentUserId },
  };

  let query = Message.find(filter).sort({ createdAt: 1 });

  // Pagination hook structured for future activation
  if (options.limit && Number.isInteger(Number(options.limit))) {
    const limit = Math.min(Math.max(Number(options.limit), 1), 100);
    const page = options.page && Number.isInteger(Number(options.page))
      ? Math.max(Number(options.page), 1)
      : 1;
    const skip = (page - 1) * limit;
    query = query.skip(skip).limit(limit);
  }

  const messages = await query.lean();

  return messages.map((m) => formatMessage(m, currentUserId));
}

/**
 * Edits an existing text message.
 * Only the original sender may edit their text message.
 *
 * @param {string|mongoose.Types.ObjectId} currentUserId
 * @param {string} messageId
 * @param {string} newText
 * @returns {Promise<object>} Formatted updated message
 */
async function editMessage(currentUserId, messageId, newText) {
  if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
    throw createError(400, 'Invalid message ID format.');
  }

  if (!newText || typeof newText !== 'string' || !newText.trim()) {
    throw createError(400, 'Message text cannot be empty.');
  }

  const trimmedText = newText.trim();
  if (trimmedText.length > 2000) {
    throw createError(400, 'Message text cannot exceed 2000 characters.');
  }

  const message = await Message.findById(messageId);
  if (!message) {
    throw createError(404, 'Message not found.');
  }

  if (message.senderId.toString() !== currentUserId.toString()) {
    throw createError(403, 'Forbidden: You can only edit your own messages.');
  }

  if (message.messageType !== 'text') {
    throw createError(400, 'Only text messages can be edited.');
  }

  if (message.isDeletedForEveryone) {
    throw createError(400, 'Cannot edit an unsent message.');
  }

  message.text = trimmedText;
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();

  // If this was the last message in the conversation, update conversation.lastMessage
  const conversation = await Conversation.findById(message.conversationId);
  if (conversation && conversation.lastMessage?.sentAt?.getTime() === message.createdAt.getTime()) {
    conversation.lastMessage.text = trimmedText;
    await conversation.save();
  }

  // Notify real-time listeners via Socket.IO
  try {
    const { getIO } = require('../sockets');
    const io = getIO();
    if (io) {
      const convId = message.conversationId.toString();
      const updatedFormatted = formatMessage(message, currentUserId);
      io.to(`conversation:${convId}`).to(convId).emit('message_edited', updatedFormatted);
      io.to(`conversation:${convId}`).to(convId).emit('message:edited', updatedFormatted);
    }
  } catch {}

  return formatMessage(message, currentUserId);
}

/**
 * Deletes a message either "for me" or "for everyone" (unsend).
 *
 * @param {string|mongoose.Types.ObjectId} currentUserId
 * @param {string} messageId
 * @param {'me'|'everyone'} mode
 * @returns {Promise<object>} Status result and updated message/state
 */
async function deleteMessage(currentUserId, messageId, mode = 'me') {
  if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
    throw createError(400, 'Invalid message ID format.');
  }

  const message = await Message.findById(messageId);
  if (!message) {
    throw createError(404, 'Message not found.');
  }

  const conversation = await Conversation.findById(message.conversationId);
  if (!conversation) {
    throw createError(404, 'Conversation not found.');
  }

  const currentUserIdStr = currentUserId.toString();
  const isParticipant = conversation.participants.some(
    (p) => p && p.toString() === currentUserIdStr
  );
  if (!isParticipant) {
    throw createError(403, 'Forbidden: You are not a participant in this conversation.');
  }

  const convId = conversation._id.toString();

  if (mode === 'everyone') {
    // Only sender can delete for everyone (unsend)
    if (message.senderId.toString() !== currentUserIdStr) {
      throw createError(403, 'Forbidden: Only the sender can unsend this message.');
    }

    message.isDeletedForEveryone = true;
    message.text = 'This message was unsent';
    await message.save();

    // Update conversation lastMessage if it matches this message
    if (conversation.lastMessage?.sentAt?.getTime() === message.createdAt.getTime()) {
      conversation.lastMessage.text = 'This message was unsent';
      await conversation.save();
    }

    // Real-time broadcast to room
    try {
      const { getIO } = require('../sockets');
      const io = getIO();
      if (io) {
        const payload = {
          messageId: message._id.toString(),
          conversationId: convId,
          mode: 'everyone',
          message: formatMessage(message, currentUserId),
        };
        io.to(`conversation:${convId}`).to(convId).emit('message_deleted', payload);
        io.to(`conversation:${convId}`).to(convId).emit('message:deleted', payload);

        // Update conversation in user rooms
        conversation.participants.forEach((pId) => {
          io.to(`user:${pId.toString()}`).emit('conversation:updated', {
            conversationId: convId,
            lastMessage: conversation.lastMessage,
            updatedAt: conversation.updatedAt,
          });
        });
      }
    } catch {}

    return {
      success: true,
      mode: 'everyone',
      messageId: message._id.toString(),
      message: formatMessage(message, currentUserId),
    };
  } else {
    // mode === 'me'
    if (!message.deletedFor.some((id) => id.toString() === currentUserIdStr)) {
      message.deletedFor.push(currentUserId);
      await message.save();
    }

    // Real-time notify sender's user room
    try {
      const { getIO } = require('../sockets');
      const io = getIO();
      if (io) {
        io.to(`user:${currentUserIdStr}`).emit('message_deleted', {
          messageId: message._id.toString(),
          conversationId: convId,
          mode: 'me',
          deletedForUserId: currentUserIdStr,
        });
      }
    } catch {}

    return {
      success: true,
      mode: 'me',
      messageId: message._id.toString(),
    };
  }
}

/**
 * Records that a user opened/viewed an ephemeral image message.
 * Increments viewCount and marks if expired.
 *
 * @param {string|mongoose.Types.ObjectId} currentUserId
 * @param {string} messageId
 * @returns {Promise<object>} View status { viewCount, viewLimit, isExpired }
 */
async function recordImageView(currentUserId, messageId) {
  if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
    throw createError(400, 'Invalid message ID format.');
  }

  const message = await Message.findById(messageId);
  if (!message) {
    throw createError(404, 'Message not found.');
  }

  const currentUserIdStr = currentUserId.toString();
  const isSender = message.senderId.toString() === currentUserIdStr;

  // View limits apply only to recipient (or if designated)
  const viewLimit = message.viewLimit || (message.viewType === 'once' ? 1 : message.viewType === 'twice' ? 2 : null);

  if (!Array.isArray(message.viewedBy)) {
    message.viewedBy = [];
  }

  let userRecord = message.viewedBy.find((v) => v.userId && v.userId.toString() === currentUserIdStr);
  if (!userRecord) {
    userRecord = { userId: currentUserId, viewCount: 1, lastViewedAt: new Date() };
    message.viewedBy.push(userRecord);
  } else {
    userRecord.viewCount = (userRecord.viewCount || 0) + 1;
    userRecord.lastViewedAt = new Date();
  }

  await message.save();

  const isExpired = Boolean(viewLimit && !isSender && userRecord.viewCount >= viewLimit);

  // Real-time notify room so other participant can see "Opened" or "Expired"
  try {
    const { getIO } = require('../sockets');
    const io = getIO();
    if (io) {
      const convId = message.conversationId.toString();
      io.to(`conversation:${convId}`).to(convId).emit('message_viewed', {
        messageId: message._id.toString(),
        conversationId: convId,
        viewerId: currentUserIdStr,
        viewCount: userRecord.viewCount,
        viewLimit,
        isExpired,
      });
    }
  } catch {}

  return {
    messageId: message._id.toString(),
    viewCount: userRecord.viewCount,
    viewLimit,
    isExpired,
  };
}

module.exports = {
  sendTextMessage,
  sendImageMessage,
  getImageStream,
  getConversationMessages,
  editMessage,
  deleteMessage,
  recordImageView,
  formatMessage,
};
