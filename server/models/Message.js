'use strict';

/**
 * Message model
 *
 * Represents a single message within a Convo conversation.
 * Supports two message types: plain TEXT and IMAGE (stored via GridFS).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Collection:  messages
 *
 * Relationships:
 *   Message.conversationId  →  Conversation._id  (N:1)
 *   Message.senderId        →  User._id          (N:1)
 *   Message.imageFileId     →  GridFS images.files._id  (N:1, image messages only)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { Schema, model } = require('mongoose');

// ── Enum ──────────────────────────────────────────────────────────────────────

/** Valid message types. Stored as lowercase strings in MongoDB. */
const MESSAGE_TYPES = Object.freeze({
  TEXT:  'text',
  IMAGE: 'image',
});

// ── Schema ────────────────────────────────────────────────────────────────────

const messageSchema = new Schema(
  {
    /**
     * conversationId — References the Conversation this message belongs to.
     * Required on every message; used as the primary query filter.
     * Indexed (see below) for efficient paginated message history queries.
     */
    conversationId: {
      type:     Schema.Types.ObjectId,
      ref:      'Conversation',
      required: [true, 'conversationId is required.'],
      index:    true,         // covered by the compound index below; explicit for intent
    },

    /**
     * senderId — References the User who sent this message.
     * Required; used by the frontend to distinguish "sent" vs "received" bubbles.
     * Not the full User document — populate when needed:
     *   Message.find(...).populate('senderId', 'name avatarColor')
     */
    senderId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'senderId is required.'],
    },

    /**
     * messageType — Discriminator for text vs image messages.
     * Determines which content field (text | imageFileId) is expected.
     * Stored lowercase to match the MESSAGE_TYPES enum.
     */
    messageType: {
      type:     String,
      required: [true, 'messageType is required.'],
      enum: {
        values:  Object.values(MESSAGE_TYPES),
        message: 'messageType must be "text" or "image".',
      },
    },

    /**
     * text — The message body for TEXT messages.
     *
     * Required when messageType === 'text', must be absent (or null) for 'image'.
     * Length capped to prevent abuse; the frontend also enforces this.
     *
     * Conditional requirement is enforced by the schema-level validator below.
     */
    text: {
      type:      String,
      trim:      true,
      maxlength: [2000, 'Message text cannot exceed 2000 characters.'],
      default:   null,
    },

    /**
     * imageFileId — GridFS file _id for IMAGE messages.
     *
     * Stores the ObjectId of the file document in the "images" GridFS bucket
     * (images.files collection). The actual binary data lives in images.chunks.
     *
     * To serve the image:
     *   GET /api/images/:imageFileId
     *   → opens a GridFS download stream → pipes to res
     *
     * Required when messageType === 'image'.
     * Conditional requirement enforced by the schema-level validator below.
     */
    imageFileId: {
      type:    Schema.Types.ObjectId,
      default: null,
      // NOT ref: 'images.files' — GridFS collections are not Mongoose models;
      // access via the GridFSBucket API (see config/gridfs.js).
    },
  },
  {
    /**
     * timestamps: true
     *   createdAt — immutable timestamp of when the message was stored.
     *               Used as the primary sort key for message history.
     *   updatedAt — present but not used in MVP; reserved for future
     *               "edited message" feature.
     *
     * Using createdAt instead of a custom sentAt field because:
     *   1. Mongoose manages it automatically.
     *   2. The client timestamp could be manipulated; server time is canonical.
     */
    timestamps: true,

    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ── Schema-level cross-field validator ───────────────────────────────────────

/**
 * Ensures that exactly the correct content field is populated
 * based on messageType:
 *   messageType === 'text'  → text must be non-empty, imageFileId must be null
 *   messageType === 'image' → imageFileId must be set, text may be null
 */
messageSchema.pre('validate', function (next) {
  if (this.messageType === MESSAGE_TYPES.TEXT) {
    if (!this.text || !this.text.trim()) {
      this.invalidate('text', 'text is required when messageType is "text".');
    }
    this.imageFileId = null; // clear any accidentally set value
  }

  if (this.messageType === MESSAGE_TYPES.IMAGE) {
    if (!this.imageFileId) {
      this.invalidate('imageFileId', 'imageFileId is required when messageType is "image".');
    }
    // text is optional for images (could be a caption — future feature)
  }

  next();
});

// ── Virtual ───────────────────────────────────────────────────────────────────

/**
 * imageUrl — Computed URL for serving an image message.
 * Avoids storing the URL in the database (which would break on domain changes).
 *
 * Usage in the API route:
 *   const msg = await Message.findById(id);
 *   // msg.imageUrl === '/api/images/<imageFileId>'
 *   // Prepend the server's base URL when sending to the client.
 */
messageSchema.virtual('imageUrl').get(function () {
  if (this.messageType === MESSAGE_TYPES.IMAGE && this.imageFileId) {
    return `/api/images/${this.imageFileId.toString()}`;
  }
  return null;
});

// ── Indexes ───────────────────────────────────────────────────────────────────

/**
 * idx_message_history
 * Primary query index — used by GET /messages/:conversationId.
 *
 * Query pattern:
 *   Message.find({ conversationId: id })
 *           .sort({ createdAt: 1 })
 *           .skip(offset)
 *           .limit(pageSize)
 *
 * Why compound { conversationId, createdAt }?
 *   • conversationId filters to one conversation (high cardinality reduction).
 *   • createdAt (ascending) enables sorted traversal in document insertion order.
 *   • MongoDB can satisfy both the filter and the sort from this single index
 *     without an in-memory sort step (efficient for large message histories).
 *
 * Why ascending on createdAt?
 *   Messages are displayed oldest-first in the chat view.
 *   For "load older messages" (scroll up), query with { createdAt: { $lt: cursor } }
 *   then reverse the result array before rendering.
 */
messageSchema.index(
  { conversationId: 1, createdAt: 1 },
  { name: 'idx_message_history' }
);

/**
 * idx_message_sender
 * Secondary index — supports future queries like "messages sent by user X".
 * Low cost to maintain; useful for user-facing analytics and message deletion.
 */
messageSchema.index(
  { senderId: 1 },
  { name: 'idx_message_sender' }
);

// ── Model export ──────────────────────────────────────────────────────────────

const Message = model('Message', messageSchema);

module.exports = { Message, MESSAGE_TYPES };
