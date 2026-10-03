'use strict';

/**
 * controllers/message.controller.js
 *
 * Message Controller
 *
 * Handles HTTP requests for:
 *   POST /api/conversations/:id/messages       (text)
 *   POST /api/conversations/:id/messages/image (image)
 *   GET  /api/conversations/:id/messages       (history)
 *   GET  /api/conversations/:id/images/:fileId (image stream)
 */

const messageService = require('../services/message.service');
const { asyncHandler } = require('../utils/asyncHandler');

/**
 * POST /api/conversations/:id/messages
 * Sends a text message to the specified conversation.
 */
const sendMessage = asyncHandler(async (req, res) => {
  const conversationId = req.params.id || req.body.conversationId;
  const { text } = req.body;

  const message = await messageService.sendTextMessage(
    req.user._id,
    conversationId,
    text
  );

  res.status(201).json(message);
});

/**
 * POST /api/conversations/:id/messages/image
 * Uploads an image to GridFS and creates an IMAGE message.
 */
const sendImage = asyncHandler(async (req, res) => {
  const conversationId = req.params.id || req.body.conversationId;
  const viewType = req.body.viewType || (req.body.viewLimit == 1 ? 'once' : req.body.viewLimit == 2 ? 'twice' : 'regular');
  const viewLimit = req.body.viewLimit ? Number(req.body.viewLimit) : (viewType === 'once' ? 1 : viewType === 'twice' ? 2 : null);

  const message = await messageService.sendImageMessage(
    req.user._id,
    conversationId,
    req.file,
    req.body.text || req.body.caption,
    { viewType, viewLimit }
  );

  res.status(201).json(message);
});

/**
 * GET /api/conversations/:id/messages
 * Retrieves chronological message history for a conversation.
 */
const getMessages = asyncHandler(async (req, res) => {
  const conversationId = req.params.id;
  const messages = await messageService.getConversationMessages(
    req.user._id,
    conversationId,
    req.query
  );

  res.status(200).json(messages);
});

/**
 * PUT /api/messages/:id
 * Edits a sent text message.
 */
const editMessage = asyncHandler(async (req, res) => {
  const messageId = req.params.id;
  const { text } = req.body;

  const updatedMessage = await messageService.editMessage(
    req.user._id,
    messageId,
    text
  );

  res.status(200).json(updatedMessage);
});

/**
 * DELETE /api/messages/:id
 * Deletes a message for me or for everyone (unsend).
 */
const deleteMessage = asyncHandler(async (req, res) => {
  const messageId = req.params.id;
  const mode = req.query.mode || req.body.mode || 'me';

  const result = await messageService.deleteMessage(
    req.user._id,
    messageId,
    mode
  );

  res.status(200).json(result);
});

/**
 * POST /api/messages/:id/view
 * Records a view for an ephemeral (disappearing) image message.
 */
const recordView = asyncHandler(async (req, res) => {
  const messageId = req.params.id;

  const result = await messageService.recordImageView(
    req.user._id,
    messageId
  );

  res.status(200).json(result);
});

/**
 * GET /api/conversations/:id/images/:fileId
 * Streams an image from GridFS with authorization check.
 */
const getImage = asyncHandler(async (req, res) => {
  const { fileId, id: conversationId } = req.params;

  const { stream, contentType, filename, length } =
    await messageService.getImageStream(req.user._id, fileId, conversationId);

  res.setHeader('Content-Type', contentType);
  if (length) {
    res.setHeader('Content-Length', length);
  }
  const safeFilename = String(filename).replace(/[^\w.\-]/g, '_').slice(0, 200) || 'image';
  res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'private, max-age=86400');

  stream.on('error', (_err) => {
    if (!res.headersSent) {
      res.status(500).json({ status: 'error', message: 'Error streaming image.' });
    }
  });

  stream.pipe(res);
});

module.exports = {
  sendMessage,
  sendImage,
  getMessages,
  editMessage,
  deleteMessage,
  recordView,
  getImage,
};
