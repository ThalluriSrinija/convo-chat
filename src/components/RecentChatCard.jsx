import { useNavigate } from 'react-router-dom';
import { formatChatTime } from '../utils/formatTime.js';
import './RecentChatCard.css';

/**
 * RecentChatCard — one entry in the Recent Chats sidebar.
 *
 * @param {{
 *   _id: string,
 *   conversationId: string,
 *   participant: { _id: string, name: string, avatarColor: string },
 *   lastMessage: { text: string, sentAt: string, isFromMe: boolean }
 * }} chat
 */
function RecentChatCard({ chat, onDelete }) {
  const navigate = useNavigate();
  const { participant, lastMessage, conversationId } = chat;

  const pName = participant?.name || 'Unknown User';
  const initial  = pName?.[0]?.toUpperCase() ?? '?';
  const sentTime = lastMessage?.sentAt || chat.latestMessageTimestamp || chat.updatedAt;
  const timeStr  = formatChatTime(sentTime);
  const previewText = lastMessage?.text || chat.latestMessage || (lastMessage?.imageUrl ? '📷 Photo' : '');

  const handleClick = () => {
    navigate(`/chat/${conversationId}`);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(conversationId);
    }
  };

  return (
    <div className="recent-chat-card-wrap">
      <button
        className="recent-chat-card"
        onClick={handleClick}
        aria-label={`Open conversation with ${pName}. Last message: ${previewText || 'No messages'}`}
        id={`recent-chat-${chat._id}`}
        role="listitem"
      >
        {/* Avatar */}
        <div
          className="recent-chat-card__avatar"
          style={{ backgroundColor: participant?.avatarColor ?? 'var(--color-primary)' }}
          aria-hidden="true"
        >
          {initial}
        </div>

        {/* Text content */}
        <div className="recent-chat-card__content">
          <div className="recent-chat-card__top">
            <p className="recent-chat-card__name" title={pName}>
              {pName}
            </p>
            {timeStr && (
              <time className="recent-chat-card__time" dateTime={sentTime}>
                {timeStr}
              </time>
            )}
          </div>

          {previewText && (
            <p className="recent-chat-card__preview">
              {lastMessage?.isFromMe && (
                <span className="recent-chat-card__preview-you">You: </span>
              )}
              {previewText}
            </p>
          )}
        </div>
      </button>

      {/* Delete chat button */}
      {onDelete && (
        <button
          type="button"
          className="recent-chat-card__delete-btn"
          onClick={handleDelete}
          title="Delete chat"
          aria-label={`Delete chat with ${pName}`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default RecentChatCard;
