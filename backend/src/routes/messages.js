'use strict';

/**
 * routes/messages.js
 *
 * Message Routes (Protected)
 *
 * Provides compatibility with /api/messages endpoints.
 */

const express = require('express');
const messageController = require('../controllers/message.controller');
const { authenticate } = require('../middleware/auth');
const { uploadImage }  = require('../middleware/upload');

const router = express.Router();

router.use(authenticate);

router.get('/image/:fileId', messageController.getImage);
router.post('/image',        uploadImage, messageController.sendImage);
router.get('/:id',           messageController.getMessages);
router.post('/',             messageController.sendMessage);
router.put('/:id',           messageController.editMessage);
router.delete('/:id',        messageController.deleteMessage);
router.post('/:id/view',     messageController.recordView);

module.exports = router;
