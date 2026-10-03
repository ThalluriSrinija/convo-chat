'use strict';

/**
 * controllers/conversation.controller.js
 *
 * Conversation Controller
 *
 * Handles HTTP requests for:
 *   POST /api/conversations
 *   GET  /api/conversations
 *   GET  /api/conversations/:id
 */

const conversationService = require('../services/conversation.service');
const { asyncHandler } = require('../utils/asyncHandler');

/**
 * POST /api/conversations
 * Creates or retrieves a conversation with another user.
 */
const createConversation = asyncHandler(async (req, res) => {
  const otherUserId =
    req.body.otherUserId ||
    req.body.targetUserId ||
    req.body.userId ||
    req.body.recipientId;

  const result = await conversationService.getOrCreateConversation(
    req.user._id,
    otherUserId
  );

  const statusCode = result.isNew ? 201 : 200;
  res.status(statusCode).json(result);
});

/**
 * GET /api/conversations
 * Fetches recent conversations for the authenticated user, sorted by updatedAt descending.
 */
const getConversations = asyncHandler(async (req, res) => {
  const conversations = await conversationService.getUserConversations(
    req.user._id
  );
  res.status(200).json(conversations);
});

/**
 * GET /api/conversations/:id
 * Fetches conversation details by ID, verifying participant membership.
 */
const getConversationById = asyncHandler(async (req, res) => {
  const conversation = await conversationService.getConversationById(
    req.user._id,
    req.params.id
  );
  res.status(200).json(conversation);
});

/**
 * DELETE /api/conversations/:id
 * Deletes a conversation for the current user ("Delete chat").
 */
const deleteConversation = asyncHandler(async (req, res) => {
  const result = await conversationService.deleteConversation(
    req.user._id,
    req.params.id
  );
  res.status(200).json(result);
});

module.exports = {
  createConversation,
  getConversations,
  getConversationById,
  deleteConversation,
};
