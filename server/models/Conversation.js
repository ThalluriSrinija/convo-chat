'use strict';

/**
 * Conversation model
 *
 * Represents a one-to-one chat session between exactly two registered users.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Collection:  conversations
 *
 * Relationships:
 *   Conversation.participants[]  →  User._id   (2 participants per conversation)
 *   Conversation._id            ←  Message.conversationId  (1:M)
 *
 * Duplicate prevention:
 *   A pre-save hook sorts both participant ObjectIds into a canonical string
 *   (participantKey) and a unique index on that field prevents a second
 *   conversation between the same pair of users.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { Schema, model } = require('mongoose');

// ── Schema ────────────────────────────────────────────────────────────────────

const conversationSchema = new Schema(
  {
    /**
     * participants — Array of exactly two User _id references.
     *
     * Always exactly 2: enforced by both the array validator below
     * and at the service layer before calling save().
     *
     * Why an array and not two separate fields (user1Id / user2Id)?
     * Arrays allow consistent indexing regardless of insertion order
     * and make participant membership queries simpler:
     *   Conversation.find({ participants: currentUserId })
     */
    participants: {
      type: [
        {
          type:     Schema.Types.ObjectId,
          ref:      'User',
          required: true,
        },
      ],
      validate: {
        validator: (arr) => arr.length === 2,
        message:   'A conversation must have exactly two participants.',
      },
    },

    /**
     * participantKey — Canonical sorted string of both participant IDs.
     *
     * Format: "<smallerObjectId>_<largerObjectId>"
     * Example: "507f1f77bcf86cd799439011_507f191e810c19729de860ea"
     *
     * WHY this field exists:
     *   MongoDB cannot enforce uniqueness on "the set of values in an array".
     *   A unique index on `participants` would be a multikey index that
     *   enforces each individual element is unique across the collection —
     *   not that the combination of two elements is unique.
     *
     *   By sorting both IDs and joining them into a deterministic string,
     *   a unique index on participantKey correctly prevents duplicate
     *   conversations regardless of which order the participants are supplied.
     *
     * Set automatically by the pre-save hook below. Never set manually.
     */
    participantKey: {
      type:   String,
      unique: true,         // THE constraint that prevents duplicate conversations
      select: false,        // internal field — exclude from API responses
    },

    /**
     * lastMessage — Denormalised snapshot of the most recent message.
     *
     * WHY denormalised here?
     *   The Home page needs to show all recent chats sorted by last-message time.
     *   Without denormalisation this requires an $lookup aggregation over the
     *   entire messages collection on every page load.
     *   By caching the last message here, the recent-chats query is:
     *     Conversation.find({ participants: userId })
     *                 .sort({ 'lastMessage.sentAt': -1 })
     *   — a single indexed find, no joins.
     *
     * Updated atomically by the message service every time a new message is saved.
     *   await Conversation.findByIdAndUpdate(conversationId, {
     *     lastMessage: { text, sentAt, senderId, messageType }
     *   });
     */
    lastMessage: {
      text:        { type: String  },          // populated for TEXT messages
      imageFileId: { type: Schema.Types.ObjectId }, // populated for IMAGE messages
      messageType: {
        type: String,
        enum: ['text', 'image'],
      },
      sentAt:   { type: Date },
      senderId: { type: Schema.Types.ObjectId, ref: 'User' },
    },
  },
  {
    /**
     * timestamps: true
     *   createdAt — when the conversation was first started.
     *   updatedAt — updated whenever Mongoose .save() is called.
     *               NOTE: For lastMessage updates use findByIdAndUpdate
     *               which does NOT trigger Mongoose timestamps by default;
     *               pass { timestamps: true } in options if you want updatedAt
     *               to reflect the latest message time.
     */
    timestamps: true,

    toJSON: {
      transform: (_doc, ret) => {
        delete ret.participantKey; // internal — never expose
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ── Pre-save hook — build participantKey ──────────────────────────────────────

/**
 * Before every save, sort the two participant IDs lexicographically and
 * join them with "_" to produce a deterministic participantKey.
 *
 * This ensures that create({ participants: [A, B] }) and
 * create({ participants: [B, A] }) both produce the same key
 * and the unique index will reject the second insertion.
 */
conversationSchema.pre('save', function (next) {
  if (this.isNew || this.isModified('participants')) {
    const sorted = this.participants
      .map((id) => id.toString())
      .sort();                       // lexicographic sort of ObjectId strings

    this.participantKey = sorted.join('_');
  }
  next();
});

// ── Indexes ───────────────────────────────────────────────────────────────────

/**
 * idx_conversation_participants
 * Multikey index — enables efficient lookup of all conversations
 * a specific user is part of:
 *   Conversation.find({ participants: userId })
 */
conversationSchema.index(
  { participants: 1 },
  { name: 'idx_conversation_participants' }
);

/**
 * idx_conversation_participantKey_unique
 * Unique index — the primary mechanism preventing duplicate conversations.
 * (Mirrors the unique: true on the field itself; explicit for clarity.)
 */
conversationSchema.index(
  { participantKey: 1 },
  { unique: true, name: 'idx_conversation_participantKey_unique' }
);

/**
 * idx_conversation_recent_chats
 * Compound index — used by the recent-chats query on the Home page:
 *   Conversation.find({ participants: userId })
 *               .sort({ 'lastMessage.sentAt': -1 })
 *
 * Combining participants (equality) with lastMessage.sentAt (sort)
 * allows MongoDB to satisfy both the filter and the sort from the index.
 */
conversationSchema.index(
  { participants: 1, 'lastMessage.sentAt': -1 },
  { name: 'idx_conversation_recent_chats' }
);

// ── Static methods ────────────────────────────────────────────────────────────

/**
 * findByParticipants(userIdA, userIdB)
 * Find an existing conversation between two users, or return null.
 *
 * Usage:
 *   const existing = await Conversation.findByParticipants(user1._id, user2._id);
 *   if (!existing) { ... create a new one ... }
 *
 * @param {string|ObjectId} userIdA
 * @param {string|ObjectId} userIdB
 * @returns {Promise<ConversationDocument|null>}
 */
conversationSchema.statics.findByParticipants = function (userIdA, userIdB) {
  const key = [userIdA.toString(), userIdB.toString()].sort().join('_');
  return this.findOne({ participantKey: key });
};

// ── Model ─────────────────────────────────────────────────────────────────────

const Conversation = model('Conversation', conversationSchema);

module.exports = Conversation;
