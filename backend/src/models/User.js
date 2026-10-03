'use strict';

const { Schema, model } = require('mongoose');
const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = () => Number(process.env.BCRYPT_ROUNDS) || 10;

const userSchema = new Schema(
  {
    name: {
      type:      String,
      required:  [true, 'Name is required.'],
      trim:      true,
      minlength: [2,  'Name must be at least 2 characters.'],
      maxlength: [60, 'Name cannot exceed 60 characters.'],
    },

    phoneNumber: {
      type:     String,
      required: [true, 'Phone number is required.'],
      unique:   true,
      trim:     true,
      match:    [/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format, e.g. +919876543210.'],
    },

    email: {
      type:      String,
      required:  [true, 'Email is required.'],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email is not valid.'],
    },

    passwordHash: {
      type:     String,
      required: [true, 'Password is required.'],
      select:   false,   // excluded from all queries by default
    },

    avatarColor: {
      type:  String,
      default: '#6c63ff',
      match: [/^#[0-9a-fA-F]{6}$/, 'avatarColor must be a valid hex colour.'],
    },

    /** Incremented on logout to invalidate outstanding JWTs for this account. */
    tokenVersion: {
      type:    Number,
      default: 0,
      min:     0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        ret.phone = ret.phoneNumber;
        return ret;
      },
    },
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
userSchema.index({ email: 1 },       { unique: true, name: 'idx_user_email' });
userSchema.index({ phoneNumber: 1 }, { unique: true, name: 'idx_user_phone' });
userSchema.index(
  { name: 'text', email: 'text', phoneNumber: 'text' },
  { name: 'idx_user_text_search', weights: { name: 10, email: 5, phoneNumber: 3 } }
);

// ── Instance methods ──────────────────────────────────────────────────────────
userSchema.methods.setPassword = async function (plainText) {
  this.passwordHash = await bcrypt.hash(plainText, BCRYPT_ROUNDS());
};

userSchema.methods.verifyPassword = async function (plainText) {
  return bcrypt.compare(plainText, this.passwordHash);
};

module.exports = model('User', userSchema);
