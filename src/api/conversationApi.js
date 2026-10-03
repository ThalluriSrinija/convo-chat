/**
 * conversationApi.js — Conversation API service
 *
 * All functions use the centralized axiosInstance (src/api/axiosInstance.js).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * API CONTRACT (for the backend developer)
 *
 *  GET    /conversations              getRecentChats()
 *  GET    /conversations/:id          getConversation(conversationId)
 *  POST   /conversations              createConversation(targetUserId)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NOTE: All endpoints require authentication.
 * All conversations in Convo MVP are one-to-one only.
 */

import axiosInstance from './axiosInstance.js';

// ── Get recent conversations ──────────────────────────────────────────────────

/**
 * Fetch all conversations for the authenticated user,
 * sorted by last message timestamp descending (newest first).
 *
 * Request  GET /conversations
 *   headers: Authorization: Bearer <token>  (or session cookie)
 *   (no body, no query params)
 *
 * Response 200
 *   Array<{
 *     _id:            string,
 *     conversationId: string,
 *     participant: {
 *       _id:         string,
 *       name:        string,
 *       avatarColor: string,
 *     },
 *     lastMessage: {
 *       text?:      string,       — present for text messages
 *       imageUrl?:  string,       — present for image messages
 *       sentAt:     string,       — ISO 8601 datetime
 *       isFromMe:   boolean,      — true if sent by the authenticated user
 *     },
 *   }>
 *
 * The backend MUST:
 *   • Return only conversations where the authenticated user is a participant.
 *   • Sort by lastMessage.sentAt descending.
 *   • Return an empty array (not 404) when the user has no conversations.
 *
 * Error responses
 *   401 — Unauthenticated
 *
 * @returns {Promise<Array<ConversationSummary>>}
 */
export async function getRecentChats() {
  const res = await axiosInstance.get('/conversations');
  return res.data;
}

// ── Get single conversation ───────────────────────────────────────────────────

/**
 * Fetch metadata for a specific conversation.
 * Used by the Chat page header to display the other participant's name.
 *
 * Request  GET /conversations/:conversationId
 *   headers: Authorization: Bearer <token>  (or session cookie)
 *   url param: conversationId — MongoDB ObjectId string
 *
 * Response 200
 *   {
 *     _id:            string,
 *     conversationId: string,
 *     participant: {
 *       _id:         string,
 *       name:        string,
 *       email:       string,
 *       phone:       string,
 *       avatarColor: string,
 *     },
 *     createdAt: string,   — ISO 8601
 *   }
 *
 * The backend MUST:
 *   • Return 403 if the authenticated user is not a participant.
 *
 * Error responses
 *   401 — Unauthenticated
 *   403 — Forbidden (not a participant)
 *   404 — Conversation not found
 *
 * @param {string} conversationId
 * @returns {Promise<ConversationDetail>}
 */
export async function getConversation(conversationId) {
  const res = await axiosInstance.get(`/conversations/${conversationId}`);
  return res.data;
}

// ── Create conversation ───────────────────────────────────────────────────────

/**
 * Start a new one-to-one conversation, or return the existing one.
 * Idempotent — calling twice with the same targetUserId returns the same conversation.
 *
 * Request  POST /conversations
 *   headers: Authorization: Bearer <token>  (or session cookie)
 *   body: {
 *     targetUserId: string   — _id of the user to start a conversation with
 *   }
 *
 * Response 200 (existing) or 201 (new)
 *   {
 *     conversationId: string,   — use this as the :conversationId route param
 *     isNew:          boolean,  — true if this is a freshly created conversation
 *   }
 *
 * The backend MUST:
 *   • Prevent self-conversation (targetUserId === authenticated user's _id → 400).
 *   • Prevent duplicate conversations (return existing if one already exists).
 *   • Return 404 if targetUserId does not correspond to a registered user.
 *
 * Error responses
 *   400 — Self-conversation or missing targetUserId  { message: string }
 *   401 — Unauthenticated
 *   404 — Target user not found                     { message: string }
 *
 * @param {string} targetUserId
 * @returns {Promise<{ conversationId: string, isNew: boolean }>}
 */
export async function createConversation(targetUserId) {
  const res = await axiosInstance.post('/conversations', { targetUserId });
  return res.data;
}

// ── Delete conversation ───────────────────────────────────────────────────────

/**
 * Delete a conversation for the current user ("Delete chat").
 *
 * @param {string} conversationId
 * @returns {Promise<{ success: boolean, conversationId: string }>}
 */
export async function deleteConversation(conversationId) {
  const res = await axiosInstance.delete(`/conversations/${conversationId}`);
  return res.data;
}

