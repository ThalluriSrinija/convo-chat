'use strict';

const { Schema, model } = require('mongoose');

const conversationSchema = new Schema(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
      validate: {
        validator: (arr) => arr.length === 2,
        message: 'A conversation must have exactly two participants.',
      },
    },

    /**
     * participantKey — sorted canonical string "<idA>_<idB>".
     * The unique index on this field prevents duplicate conversations.
     * Set automatically by the pre-save hook; never set manually.
     */
    participantKey: {
      type:   String,
      unique: true,
      select: false,   // internal — excluded from API responses
    },

    /**
     * lastMessage — denormalised for efficient recent-chats queries.
     * Updated every time a new message is saved to this conversation.
     */
    lastMessage: {
      text:        { type: String },
      imageFileId: { type: Schema.Types.ObjectId },
      messageType: { type: String, enum: ['text', 'image'] },
      sentAt:      { type: Date },
      senderId:    { type: Schema.Types.ObjectId, ref: 'User' },
    },

    /**
     * deletedFor — array of user IDs who deleted this conversation from their view ("Delete chat").
     */
    deletedFor: [{
      type: Schema.Types.ObjectId,
      ref:  'User',
    }],
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.participantKey;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ── Pre-save — build participantKey ───────────────────────────────────────────
conversationSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('participants')) {
    const sorted = this.participants.map((id) => id.toString()).sort();
    this.participantKey = sorted.join('_');
  }
  next();
});

// ── Indexes ───────────────────────────────────────────────────────────────────
conversationSchema.index({ participants: 1 },               { name: 'idx_conv_participants' });
conversationSchema.index({ participantKey: 1 },             { unique: true, name: 'idx_conv_participantKey' });
conversationSchema.index({ participants: 1, 'lastMessage.sentAt': -1 }, { name: 'idx_conv_recent_chats' });

// ── Statics ───────────────────────────────────────────────────────────────────
conversationSchema.statics.findByParticipants = function (idA, idB) {
  const key = [idA.toString(), idB.toString()].sort().join('_');
  return this.findOne({ participantKey: key });
};

module.exports = model('Conversation', conversationSchema);
