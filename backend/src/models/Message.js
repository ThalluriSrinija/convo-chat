'use strict';

const { Schema, model } = require('mongoose');

const MESSAGE_TYPES = Object.freeze({ TEXT: 'text', IMAGE: 'image' });

const messageSchema = new Schema(
  {
    conversationId: {
      type:     Schema.Types.ObjectId,
      ref:      'Conversation',
      required: [true, 'conversationId is required.'],
    },

    senderId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'senderId is required.'],
    },

    messageType: {
      type:     String,
      required: [true, 'messageType is required.'],
      enum: {
        values:  Object.values(MESSAGE_TYPES),
        message: 'messageType must be "text" or "image".',
      },
    },

    text: {
      type:      String,
      trim:      true,
      maxlength: [2000, 'Message text cannot exceed 2000 characters.'],
      default:   null,
    },

    imageFileId: {
      type:    Schema.Types.ObjectId,
      default: null,
      // Not a Mongoose ref — accessed via GridFSBucket API
    },

    // ── Instagram-like features ───────────────────────────────────────────────
    // Soft delete for individual user ("Delete for me")
    deletedFor: [{
      type: Schema.Types.ObjectId,
      ref:  'User',
    }],

    // Delete / unsend for everyone
    isDeletedForEveryone: {
      type:    Boolean,
      default: false,
    },

    // Edit message tracking
    isEdited: {
      type:    Boolean,
      default: false,
    },
    editedAt: {
      type:    Date,
      default: null,
    },

    // Disappearing ephemeral media: 'regular' | 'once' | 'twice'
    viewType: {
      type:    String,
      enum:    ['regular', 'once', 'twice'],
      default: 'regular',
    },
    viewLimit: {
      type:    Number, // null (regular/unlimited), 1 (view once), 2 (view twice)
      default: null,
    },
    // Array of view records per user
    viewedBy: [{
      userId: {
        type:     Schema.Types.ObjectId,
        ref:      'User',
        required: true,
      },
      viewCount: {
        type:    Number,
        default: 0,
      },
      lastViewedAt: {
        type:    Date,
        default: Date.now,
      },
    }],
  },
  {
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

// ── Cross-field validation ────────────────────────────────────────────────────
messageSchema.pre('validate', function (next) {
  if (this.messageType === MESSAGE_TYPES.TEXT) {
    if (!this.text?.trim()) {
      this.invalidate('text', 'text is required when messageType is "text".');
    }
    this.imageFileId = null;
  }
  if (this.messageType === MESSAGE_TYPES.IMAGE) {
    if (!this.imageFileId) {
      this.invalidate('imageFileId', 'imageFileId is required when messageType is "image".');
    }
  }
  next();
});

// ── Virtual — image serve URL ─────────────────────────────────────────────────
messageSchema.virtual('imageUrl').get(function () {
  if (this.messageType === MESSAGE_TYPES.IMAGE && this.imageFileId) {
    return `/api/images/${this.imageFileId}`;
  }
  return null;
});

// ── Indexes ───────────────────────────────────────────────────────────────────
messageSchema.index({ conversationId: 1, createdAt: 1 }, { name: 'idx_msg_history' });
messageSchema.index({ senderId: 1 },                     { name: 'idx_msg_sender' });

module.exports = { Message: model('Message', messageSchema), MESSAGE_TYPES };
