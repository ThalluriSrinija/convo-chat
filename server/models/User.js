'use strict';

/**
 * User model
 *
 * Represents a registered Convo user.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Collection:  users
 *
 * Relationships:
 *   User._id  ←  Conversation.participants[]  (M:M through Conversation)
 *   User._id  ←  Message.senderId             (1:M)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { Schema, model } = require('mongoose');
const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;

// ── Schema ────────────────────────────────────────────────────────────────────

const userSchema = new Schema(
  {
    /**
     * name — Display name shown throughout the app.
     * Trimmed and limited to prevent layout issues.
     */
    name: {
      type:      String,
      required:  [true, 'Name is required.'],
      trim:      true,
      minlength: [2,  'Name must be at least 2 characters.'],
      maxlength: [60, 'Name cannot exceed 60 characters.'],
    },

    /**
     * phoneNumber — Primary login identifier alongside email.
     * Stored in E.164 format: "+919876543210".
     * Indexed as unique because it must identify exactly one account.
     */
    phoneNumber: {
      type:     String,
      required: [true, 'Phone number is required.'],
      unique:   true,         // unique index created below
      trim:     true,
      match:    [
        /^\+[1-9]\d{6,14}$/,
        'Phone number must be in E.164 format, e.g. +919876543210.',
      ],
    },

    /**
     * email — Used as login identifier and for notifications.
     * Stored lowercased so lookups are case-insensitive without
     * requiring a case-insensitive collation.
     */
    email: {
      type:      String,
      required:  [true, 'Email is required.'],
      unique:    true,        // unique index created below
      lowercase: true,
      trim:      true,
      match:     [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Email address is not valid.',
      ],
    },

    /**
     * passwordHash — bcrypt hash of the user's password.
     * Plain-text passwords are NEVER stored.
     * Set via the setPassword() instance method below.
     */
    passwordHash: {
      type:     String,
      required: [true, 'Password is required.'],
      select:   false,        // excluded from query results by default
    },

    /**
     * avatarColor — Hex colour assigned at registration.
     * Displayed as the user's avatar background when no photo is set.
     * Generated on the backend from a predefined palette.
     */
    avatarColor: {
      type:    String,
      default: '#6c63ff',
      match:   [/^#[0-9a-fA-F]{6}$/, 'avatarColor must be a valid hex colour.'],
    },
  },
  {
    /**
     * timestamps: true
     * Mongoose automatically manages:
     *   createdAt — set on document creation, never changed.
     *   updatedAt — updated on every save/update operation.
     */
    timestamps: true,

    /**
     * toJSON / toObject transforms:
     * Remove passwordHash and __v from any serialised output
     * so it is never accidentally exposed via res.json(user).
     */
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

// Unique indexes (duplicates the Schema-level unique: true but makes intent explicit)
userSchema.index({ email: 1 },       { unique: true, name: 'idx_user_email_unique' });
userSchema.index({ phoneNumber: 1 }, { unique: true, name: 'idx_user_phone_unique' });

// Text index for full-text search (used by GET /users/search)
// Enables: User.find({ $text: { $search: query } })
userSchema.index(
  { name: 'text', email: 'text', phoneNumber: 'text' },
  {
    name:    'idx_user_text_search',
    weights: { name: 10, email: 5, phoneNumber: 3 },  // name ranked highest
  }
);

// ── Instance methods ──────────────────────────────────────────────────────────

/**
 * setPassword(plainText)
 * Hashes the plain-text password and stores it as passwordHash.
 * Call before save: await user.setPassword(req.body.password);
 *
 * @param {string} plainText
 * @returns {Promise<void>}
 */
userSchema.methods.setPassword = async function setPassword(plainText) {
  this.passwordHash = await bcrypt.hash(plainText, BCRYPT_ROUNDS);
};

/**
 * verifyPassword(plainText)
 * Compares a plain-text password against the stored bcrypt hash.
 * Returns true if the password matches, false otherwise.
 *
 * Must explicitly select passwordHash when needed:
 *   const user = await User.findOne({ email }).select('+passwordHash');
 *
 * @param {string} plainText
 * @returns {Promise<boolean>}
 */
userSchema.methods.verifyPassword = async function verifyPassword(plainText) {
  return bcrypt.compare(plainText, this.passwordHash);
};

// ── Model ─────────────────────────────────────────────────────────────────────

const User = model('User', userSchema);

module.exports = User;
