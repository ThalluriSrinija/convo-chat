/**
 * axiosInstance.js — Convo's single, centralized Axios instance.
 *
 * All API modules import from here — never create a raw axios instance
 * anywhere else in the codebase.
 *
 * Configuration:
 *   baseURL      → VITE_API_BASE_URL (set in .env)
 *   timeout      → 15 000 ms
 *   withCredentials → true  (sends HTTP-only session cookies cross-origin)
 *
 * Request interceptor:
 *   Attaches an Authorization: Bearer <token> header when a token
 *   is stored in sessionStorage (key: convo_token).
 *   This supports both cookie-based AND token-based auth depending
 *   on which strategy the backend implements.
 *
 * Response interceptor:
 *   401 Unauthorized → clears local session and redirects to /login.
 *   All other errors → re-throws with a normalised .message for UI display.
 */

import axios from 'axios';

// ── Validate env var at startup ───────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!BASE_URL) {
  console.error(
    '[Convo] VITE_API_BASE_URL is not set.\n' +
    'Create a .env file (see .env.example) and restart the dev server.'
  );
}

// ── Create instance ───────────────────────────────────────────────────────────

const axiosInstance = axios.create({
  baseURL:         BASE_URL ?? 'http://localhost:5000',
  timeout:         15_000,
  withCredentials: true,                           // send cookies on cross-origin requests
  headers: {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  },
});

// ── Session storage key (mirrors AuthContext) ─────────────────────────────────
const SESSION_KEY = 'convo_user';
const TOKEN_KEY   = 'convo_token';                 // set by backend if using JWT

// ── Request interceptor — attach auth token ───────────────────────────────────

axiosInstance.interceptors.request.use(
  (config) => {
    // Option A: JWT Bearer token stored after login
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Option B: HTTP-only cookies are sent automatically via withCredentials.
    // No explicit header needed when using cookie-based sessions.

    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — normalise errors ───────────────────────────────────

axiosInstance.interceptors.response.use(
  // Success — pass through unchanged
  (response) => response,

  // Error — normalise and handle auth failures
  (error) => {
    const status  = error.response?.status;
    const message = error.response?.data?.message
      ?? error.response?.data?.error
      ?? error.message
      ?? 'An unexpected error occurred.';

    // 401 Unauthorized — session expired or invalid
    if (status === 401) {
      // Clear local session state
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(TOKEN_KEY);

      // Redirect to login if not already there
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    // Attach a clean .message to the error so UI components can do:
    //   catch (err) { setError(err.message); }
    const enhancedError = new Error(message);
    enhancedError.status   = status;
    enhancedError.response = error.response;
    enhancedError.original = error;

    return Promise.reject(enhancedError);
  }
);

export default axiosInstance;
