'use strict';

/**
 * services/conversation.service.js
 *
 * Conversation Business Logic
 *
 * Manages one-to-one conversations between pairs of users.
 */

const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { createError } = require('../utils/createError');

/**
 * Formats a participant User document for conversation output.
 */
function formatParticipant(user) {
  if (!user) return null;
  return {
    _id:         user._id.toString(),
    name:        user.name,
    email:       user.email,
    phoneNumber: user.phoneNumber,
    phone:       user.phoneNumber,
    avatarColor: user.avatarColor || '#6c63ff',
  };
}

/**
 * Formats a Conversation document for API responses.
 */
function formatConversation(conv, currentUserId) {
  const currentUserIdStr = currentUserId.toString();
  const otherParticipant = conv.participants.find(
    (p) => p && p._id && p._id.toString() !== currentUserIdStr
  );

  const lastMsg = conv.lastMessage && (conv.lastMessage.text || conv.lastMessage.imageFileId || conv.lastMessage.sentAt)
    ? {
        text: conv.lastMessage.text || '',
        imageUrl: conv.lastMessage.imageFileId
          ? `/api/messages/image/${conv.lastMessage.imageFileId}`
          : undefined,
        messageType: conv.lastMessage.messageType || 'text',
        sentAt: conv.lastMessage.sentAt,
        isFromMe: conv.lastMessage.senderId
          ? conv.lastMessage.senderId.toString() === currentUserIdStr
          : false,
      }
    : null;

  return {
    _id:                    conv._id.toString(),
    conversationId:         conv._id.toString(),
    participant:            formatParticipant(otherParticipant),
    lastMessage:            lastMsg,
    latestMessage:          lastMsg?.text || (lastMsg?.imageUrl ? '[Image]' : ''),
    latestMessageTimestamp: lastMsg?.sentAt || conv.updatedAt,
    createdAt:              conv.createdAt,
    updatedAt:              conv.updatedAt,
  };
}

/**
 * Starts a new conversation or returns the existing one between two users.
 *
 * @param {string|mongoose.Types.ObjectId} currentUserId
 * @param {string|mongoose.Types.ObjectId} otherUserId
 * @returns {Promise<{ conversationId: string, isNew: boolean, conversation: object, participant: object }>}
 */
async function getOrCreateConversation(currentUserId, otherUserId) {
  if (!otherUserId) {
    throw createError(400, 'Other user ID is required.');
  }

  if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
    throw createError(400, 'Invalid user ID format.');
  }

  if (currentUserId.toString() === otherUserId.toString()) {
    throw createError(400, 'Cannot start a conversation with yourself.');
  }

  // Verify other user exists
  const otherUser = await User.findById(otherUserId).select('_id name email phoneNumber avatarColor');
  if (!otherUser) {
    throw createError(404, 'User not found.');
  }

  // Check if conversation already exists
  let conversation = await Conversation.findByParticipants(currentUserId, otherUserId);
  let isNew = false;

  if (conversation) {
    // If conversation was previously hidden via "Delete chat", restore it for user
    const currentUserIdStr = currentUserId.toString();
    if (conversation.deletedFor && conversation.deletedFor.some((id) => id && id.toString() === currentUserIdStr)) {
      conversation.deletedFor = conversation.deletedFor.filter((id) => id && id.toString() !== currentUserIdStr);
      await conversation.save();
    }
    // Populate participants if needed
    await conversation.populate('participants', '_id name email phoneNumber avatarColor');
  } else {
    // Create new conversation
    conversation = new Conversation({
      participants: [currentUserId, otherUserId],
    });
    await conversation.save();
    await conversation.populate('participants', '_id name email phoneNumber avatarColor');
    isNew = true;
  }

  const formatted = formatConversation(conversation, currentUserId);

  return {
    _id:            formatted._id,
    conversationId: formatted.conversationId,
    isNew,
    conversation:   formatted,
    participant:    formatted.participant,
  };
}

/**
 * Returns all conversations for the current user, sorted by updatedAt descending.
 * Filters out conversations that the user deleted ("Delete chat").
 *
 * @param {string|mongoose.Types.ObjectId} currentUserId
 * @returns {Promise<Array<object>>}
 */
async function getUserConversations(currentUserId) {
  const conversations = await Conversation.find({
    participants: currentUserId,
    deletedFor: { $ne: currentUserId },
  })
    .sort({ updatedAt: -1 })
    .populate('participants', '_id name email phoneNumber avatarColor')
    .lean();

  return conversations.map((conv) => formatConversation(conv, currentUserId));
}

/**
 * Returns metadata and details for a specific conversation by ID.
 *
 * @param {string|mongoose.Types.ObjectId} currentUserId
 * @param {string} conversationId
 * @returns {Promise<object>}
 */
async function getConversationById(currentUserId, conversationId) {
  if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
    throw createError(400, 'Invalid conversation ID format.');
  }

  const conversation = await Conversation.findById(conversationId)
    .populate('participants', '_id name email phoneNumber avatarColor')
    .lean();

  if (!conversation) {
    throw createError(404, 'Conversation not found.');
  }

  // Ensure current user is a participant
  const isParticipant = conversation.participants.some(
    (p) => p && p._id && p._id.toString() === currentUserId.toString()
  );

  if (!isParticipant) {
    throw createError(403, 'Forbidden: You are not a participant in this conversation.');
  }

  return formatConversation(conversation, currentUserId);
}

/**
 * Deletes a conversation for the current user ("Delete chat").
 * Also adds the user to `deletedFor` on all existing messages in that conversation,
 * so when reopening the chat, previously deleted message history stays cleared for them.
 *
 * @param {string|mongoose.Types.ObjectId} currentUserId
 * @param {string} conversationId
 * @returns {Promise<object>}
 */
async function deleteConversation(currentUserId, conversationId) {
  if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
    throw createError(400, 'Invalid conversation ID format.');
  }

  const conversation = await Conversation.findById(conversationId);
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

  // Mark conversation deleted for this user
  if (!conversation.deletedFor) {
    conversation.deletedFor = [];
  }
  if (!conversation.deletedFor.some((id) => id && id.toString() === currentUserIdStr)) {
    conversation.deletedFor.push(currentUserId);
    await conversation.save();
  }

  // Soft-delete all existing messages in this conversation for this user
  const { Message } = require('../models/Message');
  await Message.updateMany(
    { conversationId: conversation._id, deletedFor: { $ne: currentUserId } },
    { $addToSet: { deletedFor: currentUserId } }
  );

  // Notify user's socket room
  try {
    const { getIO } = require('../sockets');
    const io = getIO();
    if (io) {
      io.to(`user:${currentUserIdStr}`).emit('conversation:deleted', {
        conversationId: conversation._id.toString(),
      });
      io.to(`user:${currentUserIdStr}`).emit('conversation_deleted', {
        conversationId: conversation._id.toString(),
      });
    }
  } catch {}

  return {
    success: true,
    conversationId: conversation._id.toString(),
  };
}

module.exports = {
  getOrCreateConversation,
  getUserConversations,
  getConversationById,
  deleteConversation,
  formatConversation,
  formatParticipant,
};
