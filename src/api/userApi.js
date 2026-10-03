/**
 * userApi.js — User API service
 *
 * All functions use the centralized axiosInstance (src/api/axiosInstance.js).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * API CONTRACT (for the backend developer)
 *
 *  GET    /users               getUsers()
 *  GET    /users/search?q=     searchUsers(query)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NOTE: Both endpoints require authentication.
 * The backend MUST exclude the currently authenticated user from both responses.
 */

import axiosInstance from './axiosInstance.js';

// ── Get all users ─────────────────────────────────────────────────────────────

/**
 * Fetch all registered users visible to the current user.
 *
 * Request  GET /users
 *   headers: Authorization: Bearer <token>  (or session cookie)
 *   (no body, no query params)
 *
 * Response 200
 *   Array<{
 *     _id:         string,
 *     name:        string,
 *     email:       string,
 *     phone:       string,
 *     avatarColor: string,   — hex colour assigned on registration, e.g. "#6c63ff"
 *   }>
 *
 * The backend MUST:
 *   • Exclude the authenticated user from the list.
 *   • NOT include passwords or sensitive fields.
 *
 * Error responses
 *   401 — Unauthenticated (interceptor handles redirect)
 *
 * @returns {Promise<Array<{ _id, name, email, phone, avatarColor }>>}
 */
export async function getUsers() {
  const res = await axiosInstance.get('/users');
  return res.data;
}

// ── Search users ──────────────────────────────────────────────────────────────

/**
 * Search registered users by name, email, or phone number.
 *
 * Request  GET /users/search?q=<query>
 *   headers: Authorization: Bearer <token>  (or session cookie)
 *   query params: { q: string }   — partial match, min 1 char
 *
 * Response 200
 *   Array<{
 *     _id:         string,
 *     name:        string,
 *     email:       string,
 *     phone:       string,
 *     avatarColor: string,
 *   }>
 *
 * The backend MUST:
 *   • Perform case-insensitive partial matching on name, email, and phone.
 *   • Exclude the authenticated user from results.
 *   • Return an empty array (not 404) when no results match.
 *
 * Error responses
 *   400 — Missing q param  { message: string }
 *   401 — Unauthenticated
 *
 * @param {string} query   — search term (name / email / phone)
 * @returns {Promise<Array<{ _id, name, email, phone, avatarColor }>>}
 */
export async function searchUsers(query) {
  const res = await axiosInstance.get('/users/search', {
    params: { q: query.trim() },
  });
  return res.data;
}
