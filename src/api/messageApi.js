/**
 * messageApi.js — Message API service
 *
 * All functions use the centralized axiosInstance (src/api/axiosInstance.js).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * API CONTRACT (for the backend developer)
 *
 *  GET    /messages/:conversationId            getMessages()
 *  POST   /messages                            sendMessage()    — text
 *  POST   /messages/image                      sendMessage()    — image (multipart)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NOTE: All endpoints require authentication.
 * The backend MUST verify that the authenticated user is a participant
 * in the requested conversation before returning or accepting messages.
 */

import axiosInstance from './axiosInstance.js';

// ── Fetch messages ────────────────────────────────────────────────────────────

/**
 * Fetch messages for a conversation, newest-last (chronological order).
 *
 * Request  GET /messages/:conversationId?page=1&limit=50
 *   headers: Authorization: Bearer <token>  (or session cookie)
 *   url param: conversationId   — MongoDB ObjectId string
 *   query params:
 *     page    number   — 1-indexed, default 1
 *     limit   number   — messages per page, default 50, max 100
 *
 * Response 200
 *   {
 *     messages: Array<{
 *       _id:        string,
 *       senderId:   string,       — _id of the sender
 *       text?:      string,       — present for text messages
 *       imageUrl?:  string,       — present for image messages (GridFS URL)
 *       sentAt:     string,       — ISO 8601 datetime
 *       readAt?:    string,       — ISO 8601, null if unread
 *     }>,
 *     pagination: {
 *       page:       number,
 *       limit:      number,
 *       totalPages: number,
 *       totalCount: number,
 *     }
 *   }
 *
 * The backend MUST:
 *   • Return messages in ascending sentAt order (oldest first).
 *   • Return 403 if the authenticated user is not a conversation participant.
 *
 * Error responses
 *   401 — Unauthenticated
 *   403 — Forbidden (not a participant)
 *   404 — Conversation not found
 *
 * @param {string} conversationId
 * @param {{ page?: number, limit?: number }} [options]
 * @returns {Promise<{ messages: Array<Message>, pagination: object }>}
 */
export async function getMessages(conversationId, options = {}) {
  const res = await axiosInstance.get(`/messages/${conversationId}`, {
    params: {
      page:  options.page  ?? 1,
      limit: options.limit ?? 50,
    },
  });
  return res.data;
}

// ── Send text message ─────────────────────────────────────────────────────────

/**
 * Send a plain text message to a conversation.
 *
 * Request  POST /messages
 *   headers:
 *     Authorization:  Bearer <token>  (or session cookie)
 *     Content-Type:   application/json
 *   body: {
 *     conversationId: string,   — target conversation
 *     text:           string,   — 1–2000 chars, trimmed
 *   }
 *
 * Response 201
 *   {
 *     _id:            string,
 *     conversationId: string,
 *     senderId:       string,
 *     text:           string,
 *     sentAt:         string,   — ISO 8601
 *   }
 *
 * The backend MUST:
 *   • Verify the sender is a participant.
 *   • Reject empty or whitespace-only text (400).
 *   • Emit a Socket.IO event to the other participant (Module 20).
 *
 * Error responses
 *   400 — Missing/empty text or conversationId  { message: string }
 *   401 — Unauthenticated
 *   403 — Forbidden (not a participant)
 *   404 — Conversation not found
 *
 * @param {{ conversationId: string, text: string }} payload
 * @returns {Promise<Message>}
 */
export async function sendMessage(payload) {
  const res = await axiosInstance.post('/messages', payload);
  return res.data;
}

export const sendTextMessage = sendMessage;

// ── Send image message ────────────────────────────────────────────────────────

/**
 * Upload an image and send it as a message (multipart/form-data).
 *
 * The FormData must be built by buildImageFormData() in src/utils/imageValidation.js:
 *   formData.append('image',          file);           — validated File object
 *   formData.append('conversationId', conversationId); — target conversation
 *
 * Request  POST /messages/image
 *   headers:
 *     Authorization:  Bearer <token>  (or session cookie)
 *     Content-Type:   multipart/form-data   ← set automatically by browser/axios
 *   body (FormData):
 *     image:          File    — JPG/JPEG/PNG/GIF, max 5 MB
 *     conversationId: string
 *
 * Response 201
 *   {
 *     _id:            string,
 *     conversationId: string,
 *     senderId:       string,
 *     imageUrl:       string,   — publicly accessible URL to the stored image
 *                                 (GridFS stream URL, e.g. /api/images/:fileId)
 *     sentAt:         string,   — ISO 8601
 *   }
 *
 * The backend MUST:
 *   • Validate file type (JPEG/PNG/GIF only) and size (≤ 5 MB) server-side.
 *   • Store the image in MongoDB GridFS.
 *   • Return a URL through which the image can be served
 *     (e.g. GET /api/images/:fileId  with appropriate auth).
 *   • Emit a Socket.IO event with the imageUrl to the other participant (Module 20).
 *
 * Error responses
 *   400 — Missing file or conversationId   { message: string }
 *   400 — Unsupported file type            { message: string }
 *   413 — File too large                   { message: string }
 *   401 — Unauthenticated
 *   403 — Forbidden (not a participant)
 *   404 — Conversation not found
 *
 * @param {FormData} formData      — built by buildImageFormData(file, conversationId)
 * @param {(percent: number) => void} [onProgress]  — upload progress callback
 * @returns {Promise<{ _id, conversationId, senderId, imageUrl, sentAt }>}
 */
export async function sendImageMessage(formData, onProgress) {
  const res = await axiosInstance.post('/messages/image', formData, {
    // Let the browser set the correct Content-Type boundary automatically
    headers: { 'Content-Type': 'multipart/form-data' },

    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percent);
      }
    },
  });
  return res.data;
}

// ── Edit message ─────────────────────────────────────────────────────────────

/**
 * Edit a sent text message.
 *
 * @param {string} messageId
 * @param {string} text
 * @returns {Promise<Message>}
 */
export async function editMessage(messageId, text) {
  const res = await axiosInstance.put(`/messages/${messageId}`, { text });
  return res.data;
}

// ── Delete message ───────────────────────────────────────────────────────────

/**
 * Delete a message (mode: 'me' or 'everyone').
 *
 * @param {string} messageId
 * @param {'me'|'everyone'} mode
 * @returns {Promise<object>}
 */
export async function deleteMessage(messageId, mode = 'me') {
  const res = await axiosInstance.delete(`/messages/${messageId}`, {
    params: { mode },
    data:   { mode },
  });
  return res.data;
}

// ── View ephemeral image ─────────────────────────────────────────────────────

/**
 * Record a view for an ephemeral (disappearing view-once / view-twice) image.
 *
 * @param {string} messageId
 * @returns {Promise<object>}
 */
export async function recordImageView(messageId) {
  const res = await axiosInstance.post(`/messages/${messageId}/view`);
  return res.data;
}

