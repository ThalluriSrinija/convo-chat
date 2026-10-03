/**
 * formatChatTime — formats an ISO timestamp for display in chat lists.
 *
 * Rules:
 *   < 1 min ago   → "Just now"
 *   < 60 min ago  → "5m"
 *   Today         → "14:32"
 *   Yesterday     → "Yesterday"
 *   < 7 days ago  → "Mon", "Tue" ...
 *   Older         → "25 Sep"
 *
 * @param {string|Date} isoString
 * @returns {string}
 */
export function formatChatTime(isoString) {
  if (!isoString) return '';

  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const now   = new Date();
  const diffMs = now - date;
  const diffMins  = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays  = Math.floor(diffMs / 86400000);

  if (diffMins < 1)  return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24 && date.getDate() === now.getDate()) {
    // Same calendar day — show HH:MM
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  if (diffDays < 2)  return 'Yesterday';
  if (diffDays < 7)  return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}
