'use strict';

/**
 * models/index.js — barrel export for all Mongoose models.
 *
 * Usage:
 *   const { User, Conversation, Message, MESSAGE_TYPES } = require('./models');
 */

const User         = require('./User');
const Conversation = require('./Conversation');
const { Message, MESSAGE_TYPES } = require('./Message');

module.exports = { User, Conversation, Message, MESSAGE_TYPES };
