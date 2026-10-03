import { useState } from 'react';

import { useAuth } from '../context/AuthContext.jsx';
import { useUsers, useRecentChats, useUserSearch } from '../hooks/useHomeData.js';
import { deleteConversation } from '../api/conversationApi.js';

import UserCard       from '../components/UserCard.jsx';
import RecentChatCard from '../components/RecentChatCard.jsx';

import './Home.css';

// ── Skeleton loaders ──────────────────────────────────────────────────────────

function UserSkeleton({ count = 5 }) {
  return (
    <div className="home-skeleton-list" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="home-skeleton-item">
          <div className="home-skeleton-avatar" />
          <div className="home-skeleton-text">
            <div className="home-skeleton-line home-skeleton-line--name" />
            <div className="home-skeleton-line home-skeleton-line--sub"  />
          </div>
          <div className="home-skeleton-btn" />
        </div>
      ))}
    </div>
  );
}

function ChatSkeleton({ count = 4 }) {
  return (
    <div className="home-skeleton-list" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="home-skeleton-item">
          <div className="home-skeleton-avatar" />
          <div className="home-skeleton-text">
            <div className="home-skeleton-line home-skeleton-line--name" />
            <div className="home-skeleton-line home-skeleton-line--sub"  />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Empty states ──────────────────────────────────────────────────────────────

function EmptyUsers({ query }) {
  return (
    <div className="home-empty" role="status" aria-live="polite">
      <div className="home-empty__icon" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round">
          {query
            ? <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>
            : <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>
          }
        </svg>
      </div>
      <p className="home-empty__title">
        {query ? 'No users found' : 'No other users yet'}
      </p>
      <p className="home-empty__subtitle">
        {query
          ? <>No one matches <strong>&ldquo;{query}&rdquo;</strong>.<br />Try a different name, email, or phone.</>
          : 'Once others register, they will appear here.'}
      </p>
    </div>
  );
}

function EmptyChats() {
  return (
    <div className="home-empty" role="status">
      <div className="home-empty__icon" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <p className="home-empty__title">No conversations yet</p>
      <p className="home-empty__subtitle">
        Start a chat by clicking <strong>Chat</strong> next to any user.
      </p>
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────

function SectionError({ message, onRetry }) {
  return (
    <div className="home-error" role="alert">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="var(--color-error)" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p className="home-error__text">{message}</p>
      {onRetry && (
        <button className="home-error__retry" onClick={onRetry} type="button">
          Try again
        </button>
      )}
    </div>
  );
}

// ── Search input ──────────────────────────────────────────────────────────────

function SearchInput({ value, onChange, isSearching }) {
  return (
    <div className="home-search" role="search">
      {/* Icon — spinner when debounce is in progress */}
      <span className="home-search__icon" aria-hidden="true">
        {isSearching
          ? <span
              className="spinner-border"
              role="status"
              style={{ width: '13px', height: '13px', borderWidth: '2px', color: 'var(--color-primary)' }}
            />
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
        }
      </span>

      <input
        id="home-user-search"
        className="home-search__input"
        type="search"
        placeholder="Search by name, email, or phone…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        aria-label="Search users by name, email, or phone"
        aria-busy={isSearching}
      />

      {value && (
        <button
          className="home-search__clear"
          onClick={() => onChange('')}
          type="button"
          aria-label="Clear search"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Count badge ───────────────────────────────────────────────────────────────

function CountBadge({ count, label }) {
  if (!count) return null;
  return (
    <span className="home-count-badge" aria-label={`${count} ${label}`}>
      {count}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function Home() {
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?._id ?? currentUser?.id ?? null;

  // ── Data via hooks ────────────────────────────────────────
  const { users,  loading: usersLoading,  error: usersError,  reload: reloadUsers }  = useUsers(currentUserId);
  const { chats,  loading: chatsLoading,  error: chatsError,  reload: reloadChats }  = useRecentChats();

  // ── Search state ──────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const { filteredUsers, isSearching, debouncedQuery } = useUserSearch(users, searchQuery);

  const handleDeleteChat = async (convId) => {
    if (!window.confirm('Are you sure you want to delete this chat?')) return;
    try {
      await deleteConversation(convId);
      reloadChats();
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to delete chat');
    }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="home-page">

      {/* ── LEFT SIDEBAR — Recent Chats ─────────────────── */}
      <aside className="home-sidebar" aria-label="Recent conversations">

        <div className="home-section-header">
          <div className="home-section-title-row">
            <h2 className="home-section-title">Recent Chats</h2>
            {!chatsLoading && !chatsError && (
              <CountBadge count={chats.length} label="conversations" />
            )}
          </div>
        </div>

        <div className="home-list" role="list" aria-label="Recent conversations list">
          {chatsLoading && <ChatSkeleton />}

          {!chatsLoading && chatsError && (
            <SectionError message={chatsError} onRetry={reloadChats} />
          )}

          {!chatsLoading && !chatsError && chats.length === 0 && (
            <EmptyChats />
          )}

          {!chatsLoading && !chatsError && chats.map((chat) => (
            <RecentChatCard key={chat._id} chat={chat} onDelete={handleDeleteChat} />
          ))}
        </div>
      </aside>

      {/* ── RIGHT MAIN — All Registered Users ────────────── */}
      <section className="home-main" aria-label="Registered users">

        <div className="home-section-header">
          <div className="home-section-title-row">
            <h2 className="home-section-title">All Users</h2>
            {!usersLoading && !usersError && (
              <CountBadge
                count={filteredUsers.length}
                label={debouncedQuery ? 'results' : 'users'}
              />
            )}
          </div>

          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            isSearching={isSearching}
          />
        </div>

        <div
          className="home-list"
          role="list"
          aria-label="Registered users list"
          aria-live="polite"
          aria-busy={usersLoading || isSearching}
        >
          {usersLoading && <UserSkeleton />}

          {!usersLoading && usersError && (
            <SectionError message={usersError} onRetry={reloadUsers} />
          )}

          {!usersLoading && !usersError && filteredUsers.length === 0 && (
            <EmptyUsers query={debouncedQuery} />
          )}

          {!usersLoading && !usersError && filteredUsers.map((user) => (
            <UserCard key={user._id} user={user} />
          ))}
        </div>
      </section>
    </div>
  );
}

export default Home;
