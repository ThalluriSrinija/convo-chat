/**
 * useHomeData — custom hooks for the Home page data layer.
 *
 * Responsibilities:
 *   - Call the live API functions (getUsers, searchUsers, getRecentChats)
 *   - Expose loading, error, and retry state to components
 *   - Handle empty states and network errors
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

import { getUsers, searchUsers } from '../api/userApi.js';
import { getRecentChats }        from '../api/conversationApi.js';
import { useDebounce }           from './useDebounce.js';

// ── useUsers ─────────────────────────────────────────────────────────────────

/**
 * Fetches all registered users and manages loading/error state.
 * Excludes the current user by ID (checked against both `_id` and `id`).
 *
 * @param {string|null} currentUserId
 * @returns {{ users, loading, error, reload }}
 */
export function useUsers(currentUserId) {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getUsers();
      setUsers(filterOutCurrentUser(data || [], currentUserId));
    } catch (err) {
      setError(
        err?.response?.data?.message ??
        err?.message ??
        'Failed to load users. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    load();
  }, [load]);

  return { users, loading, error, reload: load };
}

// ── useRecentChats ────────────────────────────────────────────────────────────

/**
 * Fetches recent conversations sorted by latest message (newest first).
 *
 * @returns {{ chats, loading, error, reload }}
 */
export function useRecentChats() {
  const [chats,   setChats]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getRecentChats();
      setChats(sortByLatestMessage(data || []));
    } catch (err) {
      setError(
        err?.response?.data?.message ??
        err?.message ??
        'Failed to load recent chats. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { chats, loading, error, reload: load };
}

// ── useUserSearch ─────────────────────────────────────────────────────────────

/**
 * Provides debounced search calling searchUsers API when query is entered,
 * or defaulting to the full user list when query is empty.
 *
 * @param {Array}  users       Full users list from useUsers()
 * @param {string} rawQuery    Raw (un-debounced) input value
 * @param {number} [delay=300] Debounce delay in ms
 *
 * @returns {{ filteredUsers, isSearching, debouncedQuery, searchError }}
 */
export function useUserSearch(users, rawQuery, delay = 300) {
  const debouncedQuery = useDebounce(rawQuery, delay);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingBackend, setIsSearchingBackend] = useState(false);
  const [searchError, setSearchError] = useState('');

  const isSearching = rawQuery !== debouncedQuery || isSearchingBackend;

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchError('');
      setIsSearchingBackend(false);
      return;
    }

    let isMounted = true;
    setIsSearchingBackend(true);
    setSearchError('');

    searchUsers(q)
      .then((data) => {
        if (isMounted) {
          setSearchResults(data || []);
        }
      })
      .catch((err) => {
        if (isMounted) {
          // If server search fails, fall back to local filtering of users list
          const lower = q.toLowerCase();
          const fallback = users.filter(
            (u) =>
              u.name?.toLowerCase().includes(lower) ||
              u.email?.toLowerCase().includes(lower) ||
              u.phone?.toLowerCase().includes(lower) ||
              u.phoneNumber?.toLowerCase().includes(lower)
          );
          setSearchResults(fallback);
          setSearchError(err?.message || 'Search failed');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsSearchingBackend(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery, users]);

  const filteredUsers = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return users;
    }
    return searchResults;
  }, [debouncedQuery, users, searchResults]);

  return { filteredUsers, isSearching, debouncedQuery, searchError };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function filterOutCurrentUser(users, currentUserId) {
  if (!currentUserId) return users;
  return users.filter((u) => u._id !== currentUserId && u.id !== currentUserId);
}

function sortByLatestMessage(chats) {
  return [...chats].sort((a, b) => {
    const tA = a.lastMessage?.sentAt
      ? new Date(a.lastMessage.sentAt).getTime()
      : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
    const tB = b.lastMessage?.sentAt
      ? new Date(b.lastMessage.sentAt).getTime()
      : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
    return tB - tA; // newest first
  });
}
