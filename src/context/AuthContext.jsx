import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchCurrentUser } from '../api/authApi.js';

/**
 * Convo — Authentication Context
 *
 * Provides global authentication state to the entire application.
 *
 * State shape:
 *   user            — current user object from the backend, or null
 *   isAuthenticated — true when a valid user session exists
 *   isLoading       — true during the initial session restoration from storage
 *
 * Methods:
 *   login(userData)   — store user in context + sessionStorage after successful login
 *   logout()          — clear user from context + sessionStorage
 *   updateUser(patch) — merge updates into the current user object (e.g. profile edits)
 *
 * Session storage key: 'convo_user'
 * The backend token/session handling will be added in Module 19 (Integration).
 *
 * Usage:
 *   const { user, isAuthenticated, isLoading, login, logout } = useAuth();
 */

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

const SESSION_KEY = 'convo_user';
const TOKEN_KEY   = 'convo_token';

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Restore session on mount (server-validated, not sessionStorage alone) ─
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const token = sessionStorage.getItem(TOKEN_KEY);
      if (!token) {
        sessionStorage.removeItem(SESSION_KEY);
        if (!cancelled) setIsLoading(false);
        return;
      }

      try {
        const data = await fetchCurrentUser();
        const validatedUser = data?.user;
        if (validatedUser && (validatedUser._id || validatedUser.id)) {
          if (!cancelled) setUser(validatedUser);
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(validatedUser));
        } else {
          sessionStorage.removeItem(SESSION_KEY);
          sessionStorage.removeItem(TOKEN_KEY);
        }
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── login ─────────────────────────────────────────────────────────────────
  /**
   * Called after a successful loginUser() or registerUser() API response.
   * Stores the user and token in React state and sessionStorage.
   *
   * @param {Object} userData  User object returned by the backend
   * @param {string} [token]   JWT token returned by the backend
   */
  const login = useCallback((userData, token) => {
    setUser(userData);
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(userData));
      if (token) {
        sessionStorage.setItem(TOKEN_KEY, token);
      }
    } catch {
      // sessionStorage may be unavailable (private mode edge case)
    }
  }, []);

  // ── logout ────────────────────────────────────────────────────────────────
  /**
   * Clears all client-side authentication state.
   * The caller is responsible for also calling logoutUser() API and navigating away.
   */
  const logout = useCallback(() => {
    setUser(null);
    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    } catch { /* ignore */ }
  }, []);

  // ── updateUser ────────────────────────────────────────────────────────────
  /**
   * Merges a partial update into the current user object.
   * Useful for future profile edit features.
   *
   * @param {Object} patch  Partial user fields to merge
   */
  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...patch };
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
      } catch { /* ignore */ }
      return updated;
    });
  }, []);

  // ── Context value ─────────────────────────────────────────────────────────
  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useAuth — consumes the AuthContext.
 * Must be called within a component that is a descendant of <AuthProvider>.
 *
 * @returns {{ user, isAuthenticated, isLoading, login, logout, updateUser }}
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used inside <AuthProvider>. Wrap your app in AuthProvider.');
  }
  return context;
}

export default AuthContext;
