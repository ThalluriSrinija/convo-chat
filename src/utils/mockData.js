/**
 * ⚠️  MOCK DATA — REMOVE IN MODULE 19 (Backend Integration)
 * ──────────────────────────────────────────────────────────
 * This file exists solely for visual development of the Home page UI.
 * When real API calls are wired in Module 19, delete this file and
 * remove all imports of it from the codebase.
 *
 * Search for: import { MOCK_USERS, MOCK_RECENT_CHATS } from '../utils/mockData.js'
 * to find every usage.
 */

/** @type {Array<{ _id: string, name: string, email: string, phone: string, avatarColor: string }>} */
export const MOCK_USERS = [
  { _id: 'u1', name: 'Priya Sharma',    email: 'priya@example.com',  phone: '+91 98765 00001', avatarColor: '#6c63ff' },
  { _id: 'u2', name: 'Arjun Mehta',     email: 'arjun@example.com',  phone: '+91 98765 00002', avatarColor: '#f59e0b' },
  { _id: 'u3', name: 'Sneha Kapoor',    email: 'sneha@example.com',  phone: '+91 98765 00003', avatarColor: '#10b981' },
  { _id: 'u4', name: 'Rohan Verma',     email: 'rohan@example.com',  phone: '+91 98765 00004', avatarColor: '#ef4444' },
  { _id: 'u5', name: 'Divya Nair',      email: 'divya@example.com',  phone: '+91 98765 00005', avatarColor: '#8b5cf6' },
  { _id: 'u6', name: 'Karthik Iyer',   email: 'karthik@example.com', phone: '+91 98765 00006', avatarColor: '#06b6d4' },
  { _id: 'u7', name: 'Meera Pillai',    email: 'meera@example.com',  phone: '+91 98765 00007', avatarColor: '#f97316' },
  { _id: 'u8', name: 'Aditya Bansal',   email: 'aditya@example.com', phone: '+91 98765 00008', avatarColor: '#ec4899' },
];

/**
 * @type {Array<{
 *   _id: string,
 *   conversationId: string,
 *   participant: { _id: string, name: string, avatarColor: string },
 *   lastMessage: { text: string, sentAt: string, isFromMe: boolean }
 * }>}
 */
export const MOCK_RECENT_CHATS = [
  {
    _id:            'rc1',
    conversationId: 'conv-priya',
    participant:    { _id: 'u1', name: 'Priya Sharma', avatarColor: '#6c63ff' },
    lastMessage:    { text: 'See you tomorrow! 👋', sentAt: new Date(Date.now() - 5  * 60 * 1000).toISOString(), isFromMe: false },
  },
  {
    _id:            'rc2',
    conversationId: 'conv-arjun',
    participant:    { _id: 'u2', name: 'Arjun Mehta', avatarColor: '#f59e0b' },
    lastMessage:    { text: 'Sounds good, I\'ll send it over.', sentAt: new Date(Date.now() - 47 * 60 * 1000).toISOString(), isFromMe: true },
  },
  {
    _id:            'rc3',
    conversationId: 'conv-sneha',
    participant:    { _id: 'u3', name: 'Sneha Kapoor', avatarColor: '#10b981' },
    lastMessage:    { text: 'Can we reschedule?', sentAt: new Date(Date.now() - 3  * 3600 * 1000).toISOString(), isFromMe: false },
  },
  {
    _id:            'rc4',
    conversationId: 'conv-rohan',
    participant:    { _id: 'u4', name: 'Rohan Verma', avatarColor: '#ef4444' },
    lastMessage:    { text: 'Thanks!', sentAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(), isFromMe: true },
  },
];
