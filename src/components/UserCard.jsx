import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createConversation } from '../api/conversationApi.js';
import './UserCard.css';

/**
 * UserCard — single row in the All Users list.
 *
 * Shows: avatar · name · email · Chat button
 *
 * Chat button calls startConversation() (API stub).
 * While the backend is not connected, startConversation() throws,
 * which is displayed as an inline error below the name.
 *
 * In Module 19, startConversation() will return { conversationId }
 * and the user will be navigated to /chat/:conversationId.
 *
 * @param {{ _id, name, email, phone, avatarColor }} user
 */
function UserCard({ user }) {
  const navigate  = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleChat = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { conversationId } = await createConversation(user._id);
      navigate(`/chat/${conversationId}`);
    } catch (err) {
      setError(
        err?.response?.data?.message ??
        err?.message ??
        'Failed to start chat. Please try again.'
      );
      setLoading(false);
    }
  }, [user._id, navigate]);

  const initial = user.name?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="user-card" role="listitem">

      {/* Avatar */}
      <div
        className="user-card__avatar"
        style={{ backgroundColor: user.avatarColor ?? 'var(--color-primary)' }}
        aria-hidden="true"
      >
        {initial}
      </div>

      {/* Info */}
      <div className="user-card__info">
        <p className="user-card__name" title={user.name}>{user.name}</p>
        <p className="user-card__identifier" title={user.email}>{user.email}</p>
        {error && (
          <p className="user-card__error" role="alert">{error}</p>
        )}
      </div>

      {/* Chat button */}
      <button
        className={`user-card__chat-btn${loading ? ' user-card__chat-btn--loading' : ''}`}
        onClick={handleChat}
        disabled={loading}
        aria-label={`Start chat with ${user.name}`}
        id={`chat-btn-${user._id}`}
      >
        {loading ? (
          <span
            className="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
            style={{ width: '0.75rem', height: '0.75rem', borderWidth: '2px' }}
          />
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Chat
          </>
        )}
      </button>
    </div>
  );
}

export default UserCard;
