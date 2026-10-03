import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { getConversation, deleteConversation } from '../api/conversationApi.js';
import {
  getMessages,
  sendTextMessage,
  sendImageMessage,
  editMessage as editMessageApi,
  deleteMessage as deleteMessageApi,
  recordImageView as recordImageViewApi,
} from '../api/messageApi.js';
import ImagePicker from '../components/ImagePicker/ImagePicker.jsx';
import { formatChatTime } from '../utils/formatTime.js';

import './Chat.css';

/**
 * Chat page — route: /chat/:conversationId
 *
 * Connected modules:
 *   - Fetch conversation details & other participant
 *   - Fetch chronological message history (REST API initial source of truth)
 *   - Real-time messaging via Socket.IO (send_message / new_message)
 *   - Real-time message edit / delete / ephemeral view events
 *   - Instagram-like: Delete Chat, Delete for Me, Unsend for Everyone, Edit Message, View Once / Twice
 */
function Chat() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const currentUserId = user?._id || user?.id;

  // ── Conversation & Messages state ──────────────────────────
  const [conversation, setConversation] = useState(null);
  const [messages,     setMessages]     = useState([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [loadError,    setLoadError]    = useState('');

  // ── Text input state ───────────────────────────────────────
  const [textValue,   setTextValue]   = useState('');
  const [isSending,   setIsSending]   = useState(false);
  const [sendError,   setSendError]   = useState('');

  // ── Image state (controlled by ImagePicker callbacks) ──────
  const [pendingFile,     setPendingFile]     = useState(null);
  const [pendingFormData, setPendingFormData] = useState(null);
  const [isUploading,     setIsUploading]     = useState(false);
  const [uploadPercent,   setUploadPercent]   = useState(0);

  // ── Edit message state ─────────────────────────────────────
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText,      setEditingText]      = useState('');

  // ── Action popover state ───────────────────────────────────
  const [activePopoverMsgId, setActivePopoverMsgId] = useState(null);

  // ── Ephemeral Fullscreen Viewer state ──────────────────────
  const [viewingEphemeralMsg, setViewingEphemeralMsg] = useState(null);

  // ── Delete chat confirmation state ─────────────────────────
  const [isDeletingChat, setIsDeletingChat] = useState(false);

  const messagesEndRef = useRef(null);

  const hasImage = Boolean(pendingFile && pendingFormData);
  const canSend  = (textValue.trim().length > 0 || hasImage) && !isSending && !isUploading;

  // ── Scroll to bottom helper ────────────────────────────────
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  // ── Load conversation and message history via REST API ──────
  const loadData = useCallback(async () => {
    if (!conversationId) return;

    setIsLoading(true);
    setLoadError('');

    try {
      const [convData, msgData] = await Promise.all([
        getConversation(conversationId),
        getMessages(conversationId),
      ]);

      setConversation(convData);
      const list = Array.isArray(msgData) ? msgData : (msgData?.messages || []);
      setMessages(list);
    } catch (err) {
      setLoadError(
        err?.response?.data?.message ??
        err?.message ??
        'Failed to load conversation. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Close active popover when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.chat-msg-popover') && !e.target.closest('.chat-msg-actions-btn')) {
        setActivePopoverMsgId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // ── Socket.IO Room Joining & Real-time Listeners ────────────
  useEffect(() => {
    if (!socket || !conversationId) return;

    const joinRoom = () => {
      socket.emit('join_conversation', conversationId, (ack) => {
        if (ack && !ack.success) {
          setLoadError(ack.message || ack.error || 'Failed to join conversation room.');
        }
      });
    };

    if (socket.connected) {
      joinRoom();
    }

    socket.on('connect', joinRoom);

    // Real-time receiver update when new_message arrives
    const handleNewMessage = (msg) => {
      if (!msg) return;
      const msgConvId = msg.conversationId?.toString();
      if (!msgConvId || msgConvId === conversationId.toString()) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) {
            return prev;
          }
          return [...prev, msg];
        });
        setTimeout(() => scrollToBottom(true), 50);
      }
    };

    // Real-time message edited
    const handleMessageEdited = (editedMsg) => {
      if (!editedMsg) return;
      setMessages((prev) =>
        prev.map((m) => (m._id === editedMsg._id ? { ...m, ...editedMsg } : m))
      );
    };

    // Real-time message deleted
    const handleMessageDeleted = (payload) => {
      if (!payload) return;
      const { messageId, mode, message } = payload;
      if (mode === 'everyone') {
        setMessages((prev) =>
          prev.map((m) => (m._id === messageId ? { ...m, ...message, isDeletedForEveryone: true } : m))
        );
      } else if (mode === 'me') {
        setMessages((prev) => prev.filter((m) => m._id !== messageId));
      }
    };

    // Real-time ephemeral image viewed
    const handleMessageViewed = (payload) => {
      if (!payload) return;
      const { messageId, viewCount, isExpired } = payload;
      setMessages((prev) =>
        prev.map((m) => {
          if (m._id === messageId) {
            return {
              ...m,
              viewCount,
              isExpired,
              imageUrl: isExpired ? null : m.imageUrl,
            };
          }
          return m;
        })
      );
    };

    // Socket error handler
    const handleMessageError = (err) => {
      if (!err?.conversationId || err.conversationId.toString() === conversationId.toString()) {
        setSendError(err?.message || err?.error || 'Real-time messaging error.');
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('message:new', handleNewMessage);
    socket.on('message_edited', handleMessageEdited);
    socket.on('message:edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message:deleted', handleMessageDeleted);
    socket.on('message_viewed', handleMessageViewed);
    socket.on('message_error', handleMessageError);

    return () => {
      socket.emit('leave_conversation', conversationId);
      socket.off('connect', joinRoom);
      socket.off('new_message', handleNewMessage);
      socket.off('message:new', handleNewMessage);
      socket.off('message_edited', handleMessageEdited);
      socket.off('message:edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('message:deleted', handleMessageDeleted);
      socket.off('message_viewed', handleMessageViewed);
      socket.off('message_error', handleMessageError);
    };
  }, [socket, conversationId, scrollToBottom]);

  // Scroll to bottom when messages load or change
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      scrollToBottom(false);
    }
  }, [messages.length, isLoading, scrollToBottom]);

  // ── ImagePicker callbacks ──────────────────────────────────

  const handleImageReady = useCallback((file, formData, vType = 'regular') => {
    setPendingFile(file);
    setPendingFormData(formData);
    setSendError('');
  }, []);

  const handleImageClear = useCallback(() => {
    setPendingFile(null);
    setPendingFormData(null);
    setUploadPercent(0);
  }, []);

  // ── Send handler ───────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    setSendError('');

    try {
      if (hasImage) {
        setIsUploading(true);
        setUploadPercent(0);

        if (textValue.trim()) {
          pendingFormData.set('text', textValue.trim());
          pendingFormData.set('caption', textValue.trim());
        }

        const newMsg = await sendImageMessage(pendingFormData, (pct) => setUploadPercent(pct));

        setMessages((prev) => {
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
        handleImageClear();
        setTextValue('');
        setTimeout(() => scrollToBottom(true), 50);

      } else {
        const trimmed = textValue.trim();
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const optimisticMsg = {
          _id: tempId,
          conversationId,
          senderId: currentUserId,
          messageType: 'text',
          text: trimmed,
          sentAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          isPending: true,
        };

        setMessages((prev) => [...prev, optimisticMsg]);
        setTextValue('');
        setTimeout(() => scrollToBottom(true), 50);

        if (socket && socket.connected) {
          setIsSending(true);
          socket.emit(
            'send_message',
            { conversationId, text: trimmed },
            (ack) => {
              setIsSending(false);
              if (ack && ack.success && ack.message) {
                setMessages((prev) =>
                  prev.map((m) => (m._id === tempId ? ack.message : m))
                );
              } else {
                const errMsg = ack?.message || ack?.error || 'Failed to send message.';
                setSendError(errMsg);
                setMessages((prev) => prev.filter((m) => m._id !== tempId));
              }
            }
          );
        } else {
          setIsSending(true);
          try {
            const newMsg = await sendTextMessage({
              conversationId,
              text: trimmed,
            });
            setMessages((prev) =>
              prev.map((m) => (m._id === tempId ? newMsg : m))
            );
          } catch (err) {
            setSendError(
              err?.response?.data?.message ??
              err?.message ??
              'Failed to send message. Please try again.'
            );
            setMessages((prev) => prev.filter((m) => m._id !== tempId));
          } finally {
            setIsSending(false);
          }
        }
      }

    } catch (err) {
      setSendError(
        err?.response?.data?.message ??
        err?.message ??
        'Failed to send message. Please try again.'
      );
    } finally {
      setIsUploading(false);
    }
  }, [canSend, hasImage, pendingFormData, textValue, conversationId, currentUserId, socket, handleImageClear, scrollToBottom]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // ── Edit Message Handlers ──────────────────────────────────
  const handleStartEdit = (msg) => {
    setEditingMessageId(msg._id);
    setEditingText(msg.text || '');
    setActivePopoverMsgId(null);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleSaveEdit = async (msgId) => {
    if (!editingText.trim()) return;
    try {
      const updated = await editMessageApi(msgId, editingText.trim());
      setMessages((prev) =>
        prev.map((m) => (m._id === msgId ? { ...m, ...updated, text: editingText.trim(), isEdited: true } : m))
      );
      setEditingMessageId(null);
      setEditingText('');
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to edit message');
    }
  };

  // ── Delete Message Handlers (Me or Everyone) ───────────────
  const handleDeleteMessage = async (msgId, mode) => {
    setActivePopoverMsgId(null);
    const confirmText = mode === 'everyone'
      ? 'Unsend this message for everyone?'
      : 'Delete this message for yourself?';
    if (!window.confirm(confirmText)) return;

    try {
      await deleteMessageApi(msgId, mode);
      if (mode === 'everyone') {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === msgId ? { ...m, isDeletedForEveryone: true, text: 'This message was unsent' } : m
          )
        );
      } else {
        setMessages((prev) => prev.filter((m) => m._id !== msgId));
      }
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to delete message');
    }
  };

  // ── Delete Chat Handler ────────────────────────────────────
  const handleDeleteConversation = async () => {
    if (!window.confirm('Delete this entire chat? This will remove it from your chat list and clear messages.')) {
      return;
    }
    setIsDeletingChat(true);
    try {
      await deleteConversation(conversationId);
      navigate('/home');
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to delete chat');
      setIsDeletingChat(false);
    }
  };

  // ── Ephemeral Image Open Handler ───────────────────────────
  const handleOpenEphemeralImage = async (msg) => {
    const isSender = (msg.senderId?._id?.toString() || msg.senderId?.toString()) === currentUserId?.toString();
    if (msg.isExpired && !isSender) return;

    setViewingEphemeralMsg(msg);

    // If recipient is viewing, trigger recordImageView
    if (!isSender && msg.viewLimit) {
      try {
        const viewResult = await recordImageViewApi(msg._id);
        setMessages((prev) =>
          prev.map((m) =>
            m._id === msg._id
              ? {
                  ...m,
                  viewCount: viewResult.viewCount,
                  isExpired: viewResult.isExpired,
                  imageUrl: viewResult.isExpired ? null : m.imageUrl,
                }
              : m
          )
        );
      } catch {}
    }
  };

  // ── Image URL builder ──────────────────────────────────────
  const getAuthenticatedImageUrl = useCallback((imageUrl) => {
    if (!imageUrl) return '';
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5002';
    const base = imageUrl.startsWith('http') ? imageUrl : `${apiBase}${imageUrl}`;
    const token = sessionStorage.getItem('convo_token');
    if (!token) return base;
    return `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
  }, []);

  // Participant info
  const participant = conversation?.participant;
  const participantName = participant?.name || (isLoading ? 'Loading conversation…' : 'Chat');
  const initial = participant?.name?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="chat-page">

      {/* ── Header ──────────────────────────────────────── */}
      <header className="chat-header">
        <Link to="/home" className="chat-back-btn" aria-label="Back to home">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>

        <div
          className="chat-header-avatar"
          style={{ backgroundColor: participant?.avatarColor ?? 'var(--color-primary)' }}
          aria-hidden="true"
        >
          {initial}
        </div>

        <div className="chat-header-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <p className="chat-header-name" title={participantName}>
              {participantName}
            </p>
            {isConnected && (
              <span className="chat-status-badge" title="Real-time connected">
                <span className="chat-status-dot" aria-hidden="true" /> Live
              </span>
            )}
          </div>
          <p className="chat-header-sub">
            {participant?.email || participant?.phoneNumber || (
              <>ID: <code className="chat-conv-id">{conversationId}</code></>
            )}
          </p>
        </div>

        {/* Header Right Actions: Delete Chat button */}
        <div className="chat-header-actions">
          <button
            type="button"
            className="chat-delete-conv-btn"
            onClick={handleDeleteConversation}
            disabled={isDeletingChat}
            title="Delete this chat"
            id="chat-delete-btn"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            Delete Chat
          </button>
        </div>
      </header>

      {/* ── Messages ────────────────────────────────────── */}
      <div className="chat-messages" role="log" aria-label="Messages" aria-live="polite">

        {/* Loading state */}
        {isLoading && (
          <div className="chat-placeholder">
            <div
              className="spinner-border"
              role="status"
              aria-hidden="true"
              style={{ width: '2rem', height: '2rem', borderWidth: '3px', color: 'var(--color-primary)' }}
            />
            <p className="chat-placeholder__label">Loading messages…</p>
          </div>
        )}

        {/* Error state */}
        {!isLoading && loadError && (
          <div className="chat-placeholder">
            <p className="chat-placeholder__label" style={{ color: 'var(--color-error)' }}>
              {loadError}
            </p>
            <button
              className="btn btn-secondary btn-sm"
              onClick={loadData}
              type="button"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !loadError && messages.length === 0 && (
          <div className="chat-placeholder">
            <div className="chat-placeholder__icon" aria-hidden="true">💬</div>
            <p className="chat-placeholder__label">
              No messages yet. Send a message to start chatting!
            </p>
          </div>
        )}

        {/* Message list */}
        {!isLoading && !loadError && messages.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', width: '100%' }}>
            {messages.map((m) => {
              const senderIdStr = typeof m.senderId === 'object' ? m.senderId?._id?.toString() : m.senderId?.toString();
              const myIdStr = currentUserId?.toString();
              const isMe = Boolean(myIdStr && senderIdStr && senderIdStr === myIdStr);
              const isEditing = editingMessageId === m._id;
              const isUnsent = Boolean(m.isDeletedForEveryone);
              const isPopoverOpen = activePopoverMsgId === m._id;

              // Disappearing Media check
              const isEphemeral = m.messageType === 'image' && (m.viewType === 'once' || m.viewType === 'twice' || m.viewLimit > 0);
              const isExpired = Boolean(m.isExpired);
              const viewLimit = m.viewLimit || (m.viewType === 'once' ? 1 : m.viewType === 'twice' ? 2 : null);

              return (
                <div
                  key={m._id}
                  className={`chat-bubble-row ${isMe ? 'chat-bubble-row--sent' : 'chat-bubble-row--received'}`}
                >
                  {/* Action 3-dots Trigger for Sent or Received (if for me) */}
                  {!isUnsent && !isEditing && (
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        className={`chat-msg-actions-btn ${isPopoverOpen ? 'chat-msg-actions-btn--active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePopoverMsgId((prev) => (prev === m._id ? null : m._id));
                        }}
                        aria-label="Message options"
                        title="Options"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="12" cy="19" r="2" />
                        </svg>
                      </button>

                      {/* Dropdown Popover */}
                      {isPopoverOpen && (
                        <div className="chat-msg-popover" role="menu">
                          {/* Edit option — only sender of text message */}
                          {isMe && m.messageType === 'text' && (
                            <button
                              type="button"
                              className="chat-msg-popover-item"
                              onClick={() => handleStartEdit(m)}
                              role="menuitem"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              Edit message
                            </button>
                          )}

                          {/* Unsend for everyone — only sender */}
                          {isMe && (
                            <button
                              type="button"
                              className="chat-msg-popover-item chat-msg-popover-item--danger"
                              onClick={() => handleDeleteMessage(m._id, 'everyone')}
                              role="menuitem"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                              </svg>
                              Unsend for everyone
                            </button>
                          )}

                          {/* Delete for me — both sender & recipient */}
                          <button
                            type="button"
                            className="chat-msg-popover-item chat-msg-popover-item--danger"
                            onClick={() => handleDeleteMessage(m._id, 'me')}
                            role="menuitem"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                            Delete for me
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Main Message Bubble */}
                  <div
                    className={`chat-bubble ${isMe ? 'chat-bubble--sent' : 'chat-bubble--received'} ${
                      isUnsent ? 'chat-bubble--unsent' : ''
                    }`}
                  >
                    {/* Unsent message text */}
                    {isUnsent ? (
                      <p className="chat-bubble-text" style={{ fontStyle: 'italic', opacity: 0.8 }}>
                        🚫 This message was unsent
                      </p>
                    ) : isEditing ? (
                      /* Inline Edit Mode */
                      <div className="chat-inline-edit">
                        <input
                          type="text"
                          className="chat-inline-edit__input"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(m._id);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          autoFocus
                        />
                        <div className="chat-inline-edit__actions">
                          <button
                            type="button"
                            className="chat-inline-edit__btn"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="chat-inline-edit__btn chat-inline-edit__btn--save"
                            onClick={() => handleSaveEdit(m._id)}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : isEphemeral ? (
                      /* Ephemeral Disappearing Photo Card */
                      <div>
                        <div
                          className={`chat-ephemeral-card ${isExpired ? 'chat-ephemeral-card--expired' : ''}`}
                          onClick={() => handleOpenEphemeralImage(m)}
                          title={isExpired ? 'Photo expired' : `Tap to view photo (${viewLimit}x)`}
                        >
                          <div className="chat-ephemeral-icon">
                            {isExpired ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                              </svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            )}
                          </div>
                          <div className="chat-ephemeral-info">
                            <span className="chat-ephemeral-title">
                              {isExpired
                                ? 'Photo expired'
                                : `Photo (${viewLimit === 1 ? 'View once' : 'View twice'})`}
                            </span>
                            <span className="chat-ephemeral-subtitle">
                              {isExpired
                                ? 'Opened max number of times'
                                : isMe
                                ? 'Sent disappearing photo'
                                : `Tap to view (${m.viewCount || 0}/${viewLimit} viewed)`}
                            </span>
                          </div>
                        </div>

                        {/* Optional caption if present */}
                        {m.text && <p className="chat-bubble-text" style={{ marginTop: '0.4rem' }}>{m.text}</p>}
                      </div>
                    ) : (
                      /* Regular Message: Image & Text */
                      <>
                        {m.imageUrl && (
                          <img
                            src={getAuthenticatedImageUrl(m.imageUrl)}
                            alt="Attachment"
                            className="chat-bubble-image"
                            loading="lazy"
                            onClick={() => setViewingEphemeralMsg(m)}
                            style={{ cursor: 'pointer' }}
                          />
                        )}

                        {m.text && (
                          <p className="chat-bubble-text">
                            {m.text}
                            {m.isEdited && (
                              <span className="chat-edited-tag" title="Edited message">
                                (edited)
                              </span>
                            )}
                          </p>
                        )}
                      </>
                    )}

                    {/* Timestamp */}
                    <time className="chat-bubble-time" dateTime={m.sentAt || m.createdAt}>
                      {formatChatTime(m.sentAt || m.createdAt)}
                    </time>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Ephemeral / Photo Fullscreen Viewer Modal ─────── */}
      {viewingEphemeralMsg && (
        <div className="chat-ephemeral-modal" onClick={() => setViewingEphemeralMsg(null)}>
          <button
            type="button"
            className="chat-ephemeral-modal__close"
            onClick={() => setViewingEphemeralMsg(null)}
            aria-label="Close photo"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <img
            src={getAuthenticatedImageUrl(viewingEphemeralMsg.imageUrl)}
            alt="Disappearing Media"
            className="chat-ephemeral-modal__img"
            onClick={(e) => e.stopPropagation()}
          />
          {viewingEphemeralMsg.text && (
            <p className="chat-ephemeral-modal__footer">
              {viewingEphemeralMsg.text}
            </p>
          )}
          {(viewingEphemeralMsg.viewType === 'once' || viewingEphemeralMsg.viewType === 'twice') && (
            <p className="chat-ephemeral-modal__footer" style={{ fontSize: '11px', opacity: 0.8 }}>
              🔒 Disappearing photo mode active
            </p>
          )}
        </div>
      )}

      {/* ── Input wrapper (ImagePicker preview lives here) ─ */}
      <div className="chat-input-wrap">

        {/* ImagePicker renders preview above input */}
        <ImagePicker
          conversationId={conversationId}
          onImageReady={handleImageReady}
          onClear={handleImageClear}
          isUploading={isUploading}
          uploadPercent={uploadPercent}
          disabled={isSending}
        />

        {/* Send error */}
        {sendError && (
          <div
            style={{
              padding: '0.375rem 1.25rem',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-error)',
              background: 'rgba(248,113,113,0.07)',
              borderTop: '1px solid rgba(248,113,113,0.18)',
            }}
            role="alert"
          >
            {sendError}
          </div>
        )}

        {/* Input bar row */}
        <div className="chat-input-bar" role="form" aria-label="Message composer">
          <input
            id="chat-text-input"
            className="chat-text-input"
            type="text"
            placeholder={hasImage ? 'Add a caption… (optional)' : 'Type a message…'}
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isUploading}
            aria-label={hasImage ? 'Optional caption for image' : 'Message text'}
            autoComplete="off"
          />

          <button
            id="chat-send-btn"
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!canSend}
            aria-label={hasImage ? 'Send image' : 'Send message'}
            type="button"
          >
            {(isSending || isUploading) ? (
              <span
                className="spinner-border spinner-border-sm"
                role="status"
                aria-hidden="true"
                style={{ width: '1rem', height: '1rem', borderWidth: '2px' }}
              />
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chat;

