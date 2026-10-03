'use strict';

/**
 * routes/conversations.js
 *
 * Conversation Routes (Protected)
 *
 * Endpoints:
 *   POST /api/conversations     — Create or retrieve 1-to-1 conversation
 *   GET  /api/conversations     — List current user's conversations (sorted by updatedAt desc)
 *   GET  /api/conversations/:id — Get specific conversation details
 */

const express = require('express');
const conversationController = require('../controllers/conversation.controller');
const messageController      = require('../controllers/message.controller');
const { authenticate } = require('../middleware/auth');
const { uploadImage }  = require('../middleware/upload');

const router = express.Router();

// All conversation routes require authentication
router.use(authenticate);

router.post('/',                   conversationController.createConversation);
router.get('/',                    conversationController.getConversations);
router.get('/:id',                 conversationController.getConversationById);
router.delete('/:id',              conversationController.deleteConversation);
router.get('/:id/messages',        messageController.getMessages);
router.post('/:id/messages',       messageController.sendMessage);
router.post('/:id/messages/image', uploadImage, messageController.sendImage);
router.post('/:id/image',          uploadImage, messageController.sendImage);
router.get('/:id/images/:fileId',  messageController.getImage);

module.exports = router;
