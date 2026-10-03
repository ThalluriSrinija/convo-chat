/**
 * authApi.js — Authentication API service
 *
 * All functions use the centralized axiosInstance (src/api/axiosInstance.js).
 * The backend is expected at the base URL defined by VITE_API_BASE_URL.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * API CONTRACT (for the backend developer)
 *
 *  POST   /auth/register         registerUser()
 *  POST   /auth/login            loginUser()
 *  POST   /auth/logout           logoutUser()
 *  POST   /auth/forgot-password  requestPasswordReset()
 *  POST   /auth/reset-password   resetPassword()
 * ─────────────────────────────────────────────────────────────────────────────
 */

import axiosInstance from './axiosInstance.js';

// ── Register ──────────────────────────────────────────────────────────────────

/**
 * Register a new user account.
 *
 * Request  POST /auth/register
 *   body: {
 *     name:            string   — full display name
 *     phone:           string   — E.164 format, e.g. "+919876543210"
 *     email:           string   — valid email address
 *     password:        string   — min 8 chars, upper + lower + digit
 *   }
 *
 * Response 201
 *   {
 *     message: string,
 *     user: {
 *       _id:   string,
 *       name:  string,
 *       email: string,
 *       phone: string,
 *     }
 *   }
 *
 * Error responses
 *   400 — Validation error  { message: string }
 *   409 — Email/phone already registered  { message: string }
 *
 * @param {{ name: string, phone: string, email: string, password: string }} userData
 * @returns {Promise<{ message: string, user: object }>}
 */
export async function registerUser(userData) {
  const res = await axiosInstance.post('/auth/register', userData);
  return res.data;
}

// ── Login ─────────────────────────────────────────────────────────────────────

/**
 * Authenticate an existing user.
 *
 * Request  POST /auth/login
 *   body: {
 *     identifier:  string   — email address OR phone number
 *     password:    string
 *   }
 *
 * Response 200
 *   {
 *     token?: string,        — JWT if using token-based auth (optional)
 *     user: {
 *       _id:   string,
 *       name:  string,
 *       email: string,
 *       phone: string,
 *     }
 *   }
 *   — If using HTTP-only cookies, the Set-Cookie header is set here.
 *   — If using JWT, the token is included in the response body.
 *
 * Error responses
 *   400 — Missing fields        { message: string }
 *   401 — Invalid credentials   { message: string }
 *
 * @param {{ identifier: string, password: string }} credentials
 * @returns {Promise<{ token?: string, user: object }>}
 */
export async function loginUser(credentials) {
  const res = await axiosInstance.post('/auth/login', credentials);
  return res.data;
}

// ── Logout ────────────────────────────────────────────────────────────────────

/**
 * Terminate the current session.
 *
 * Request  POST /auth/logout
 *   (no body required)
 *   — Sends cookies automatically via withCredentials.
 *   — If using JWT, the frontend discards the token after this call.
 *
 * Response 200
 *   { message: string }  — e.g. "Logged out successfully."
 *
 * Error responses
 *   401 — Not authenticated (interceptor handles redirect)
 *
 * @returns {Promise<{ message: string }>}
 */
export async function logoutUser() {
  const res = await axiosInstance.post('/auth/logout');
  return res.data;
}

/**
 * Validates the stored JWT with the backend and returns the current user profile.
 *
 * Request  GET /auth/me
 *
 * @returns {Promise<{ user: object }>}
 */
export async function fetchCurrentUser() {
  const res = await axiosInstance.get('/auth/me');
  return res.data;
}

// ── Forgot password — step 1 ──────────────────────────────────────────────────

/**
 * Request a password reset by submitting the account phone number.
 * The backend sends an OTP or verification token via SMS.
 *
 * Request  POST /auth/forgot-password
 *   body: {
 *     phone: string   — E.164 format, e.g. "+919876543210"
 *   }
 *
 * Response 200
 *   {
 *     message:    string,   — e.g. "Verification code sent."
 *     resetToken: string,   — short-lived server-issued token (NOT the OTP itself)
 *                             The frontend passes this back in resetPassword().
 *   }
 *
 * Security note:
 *   The backend MUST NOT advance to password change without verifying
 *   the OTP entered by the user. The resetToken alone is not sufficient.
 *
 * Error responses
 *   400 — Invalid or missing phone  { message: string }
 *   404 — Phone not registered      { message: string }
 *   429 — Rate limit exceeded       { message: string }
 *
 * @param {string} phoneNumber
 * @returns {Promise<{ message: string, resetToken: string }>}
 */
export async function requestPasswordReset(phoneNumber) {
  const res = await axiosInstance.post('/auth/forgot-password', { phone: phoneNumber });
  return res.data;
}

// ── Forgot password — step 2 ──────────────────────────────────────────────────

/**
 * Set a new password after verifying the OTP / reset token.
 *
 * Request  POST /auth/reset-password
 *   body: {
 *     phone:       string   — the phone number from step 1
 *     resetToken:  string   — the token returned by requestPasswordReset()
 *     newPassword: string   — must meet password policy (min 8, upper + lower + digit)
 *   }
 *
 * Response 200
 *   { message: string }   — e.g. "Password updated successfully."
 *
 * Security note:
 *   The backend MUST validate that resetToken is unexpired, single-use,
 *   and bound to the given phone number before updating the password.
 *
 * Error responses
 *   400 — Validation error / weak password   { message: string }
 *   401 — Invalid or expired resetToken      { message: string }
 *   404 — Phone not found                    { message: string }
 *
 * @param {{ phone: string, resetToken: string, newPassword: string }} data
 * @returns {Promise<{ message: string }>}
 */
export async function resetPassword(data) {
  const res = await axiosInstance.post('/auth/reset-password', data);
  return res.data;
}
