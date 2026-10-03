'use strict';

/**
 * test_integration.js
 *
 * End-to-end integration tests verifying all 11 modules:
 * 1. Registration
 * 2. Login
 * 3. Logout
 * 4. Authentication state
 * 5. User list
 * 6. User search
 * 7. Recent chats
 * 8. Create/open conversation
 * 9. Message history
 * 10. Send text message
 * 11. Image upload (multipart/GridFS)
 * + Error handling (400, 401, 403, 409)
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const BASE_URL = 'http://localhost:5002';

const api = axios.create({
  baseURL: BASE_URL,
  validateStatus: () => true, // inspect all statuses
});

function logStep(name) {
  console.log(`\n\x1b[36m▶ Testing: ${name}\x1b[0m`);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`\x1b[31m  ✗ Assertion failed: ${message}\x1b[0m`);
    throw new Error(message);
  }
  console.log(`\x1b[32m  ✓ ${message}\x1b[0m`);
}

async function run() {
  console.log('=== STARTING CONVO INTEGRATION VERIFICATION ===');

  const rand = Math.floor(Math.random() * 100000);
  const userAData = {
    name: `User Alpha ${rand}`,
    phone: `+1900111${String(rand).padStart(5, '0').slice(-5)}`,
    email: `alpha_${rand}@example.com`,
    password: 'Password123!',
  };

  const userBData = {
    name: `User Beta ${rand}`,
    phone: `+1900222${String(rand).padStart(5, '0').slice(-5)}`,
    email: `beta_${rand}@example.com`,
    password: 'Password123!',
  };

  // ── 1. Registration ──────────────────────────────────────────────────────────
  logStep('1. Registration (POST /auth/register)');
  const regResA = await api.post('/auth/register', userAData);
  assert(regResA.status === 201, `User A registered with status 201 (got ${regResA.status})`);
  assert(regResA.data.user && regResA.data.user.email === userAData.email, 'User A object returned correctly');
  assert(!regResA.data.user.passwordHash, 'passwordHash is excluded');

  // Test duplicate registration error (409)
  const regDup = await api.post('/auth/register', userAData);
  assert(regDup.status === 409, `Duplicate email rejected with 409 (got ${regDup.status})`);

  // Register User B
  const regResB = await api.post('/auth/register', userBData);
  assert(regResB.status === 201, `User B registered with status 201 (got ${regResB.status})`);
  const userBId = regResB.data.user._id;

  // ── 2. Login ────────────────────────────────────────────────────────────────
  logStep('2. Login (POST /auth/login)');
  // Login with email
  const loginEmailRes = await api.post('/auth/login', {
    identifier: userAData.email,
    password: userAData.password,
  });
  assert(loginEmailRes.status === 200, `Login with email succeeded with status 200 (got ${loginEmailRes.status})`);
  assert(loginEmailRes.data.token, 'JWT token returned in login response');
  const tokenA = loginEmailRes.data.token;
  const userAId = loginEmailRes.data.user._id;

  // Login with phone
  const loginPhoneRes = await api.post('/auth/login', {
    identifier: userAData.phone,
    password: userAData.password,
  });
  assert(loginPhoneRes.status === 200, 'Login with phone number succeeded');

  // Test invalid password (401)
  const badLogin = await api.post('/auth/login', {
    identifier: userAData.email,
    password: 'WrongPassword!',
  });
  assert(badLogin.status === 401, `Invalid credentials returns 401 (got ${badLogin.status})`);

  // Setup authenticated client for User A
  const clientA = axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${tokenA}` },
    validateStatus: () => true,
  });

  const tokenB = regResB.data.token;
  const clientB = axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${tokenB}` },
    validateStatus: () => true,
  });

  // ── 3. Authentication state ──────────────────────────────────────────────────
  logStep('3. Authentication state (GET /auth/me)');
  const meRes = await clientA.get('/auth/me');
  assert(meRes.status === 200, `Current-user /auth/me returns 200 (got ${meRes.status})`);
  assert(meRes.data.user && meRes.data.user.email === userAData.email, 'Current user correctly identified');

  // Unauthorized access (no token) -> 401
  const unauthRes = await api.get('/auth/me');
  assert(unauthRes.status === 401, `Unauthenticated request returns 401 (got ${unauthRes.status})`);

  // ── 4. Logout ────────────────────────────────────────────────────────────────
  logStep('4. Logout (POST /auth/logout)');
  const logoutRes = await clientA.post('/auth/logout');
  assert(logoutRes.status === 200, `Logout returns 200 (got ${logoutRes.status})`);

  const meAfterLogout = await clientA.get('/auth/me');
  assert(meAfterLogout.status === 401, `Token invalidated after logout (got ${meAfterLogout.status})`);

  const reloginRes = await api.post('/auth/login', {
    identifier: userAData.email,
    password: userAData.password,
  });
  assert(reloginRes.status === 200 && reloginRes.data.token, 'Re-login after logout succeeded');
  clientA.defaults.headers.Authorization = `Bearer ${reloginRes.data.token}`;

  // ── 5. User list ─────────────────────────────────────────────────────────────
  logStep('5. User list (GET /users)');
  const usersRes = await clientA.get('/users');
  assert(usersRes.status === 200, `GET /users returns 200 (got ${usersRes.status})`);
  assert(Array.isArray(usersRes.data), 'Returns an array of users');
  const hasSelf = usersRes.data.some((u) => u._id === userAId);
  assert(!hasSelf, 'Authenticated user is excluded from user list');
  const hasUserB = usersRes.data.some((u) => u._id === userBId);
  assert(hasUserB, 'Other registered user appears in user list');

  // ── 6. User search ───────────────────────────────────────────────────────────
  logStep('6. User search (GET /users/search?q=...)');
  const searchNameRes = await clientA.get('/users/search', { params: { q: `User Beta ${rand}` } });
  assert(searchNameRes.status === 200, 'Search by name returns 200');
  assert(searchNameRes.data.length >= 1, 'Search finds matching user');
  assert(searchNameRes.data[0]._id === userBId, 'Found User B');

  const searchPhoneRes = await clientA.get('/users/search', { params: { q: userBData.phone.slice(-4) } });
  assert(searchPhoneRes.status === 200, 'Search by partial phone returns 200');
  assert(searchPhoneRes.data.some((u) => u._id === userBId), 'Found User B by phone search');

  const searchEmptyRes = await clientA.get('/users/search', { params: { q: 'NonExistentXYZ999' } });
  assert(searchEmptyRes.status === 200 && searchEmptyRes.data.length === 0, 'No match returns empty array');

  // ── 7. Create/open conversation ──────────────────────────────────────────────
  logStep('7. Create/open conversation (POST /conversations)');
  const createConvRes = await clientA.post('/conversations', { targetUserId: userBId });
  assert(createConvRes.status === 201 || createConvRes.status === 200, `Conversation created/opened (status ${createConvRes.status})`);
  const conversationId = createConvRes.data.conversationId || createConvRes.data._id;
  assert(conversationId, `Got conversationId: ${conversationId}`);

  // Idempotency: creating again should return existing
  const convAgainRes = await clientA.post('/conversations', { targetUserId: userBId });
  assert(convAgainRes.status === 200, `Idempotent request returns status 200 (got ${convAgainRes.status})`);
  assert(convAgainRes.data.conversationId === conversationId, 'Returned same conversationId');

  // ── 8. Recent chats ──────────────────────────────────────────────────────────
  logStep('8. Recent chats (GET /conversations)');
  const chatsRes = await clientA.get('/conversations');
  assert(chatsRes.status === 200, `GET /conversations returns 200 (got ${chatsRes.status})`);
  assert(Array.isArray(chatsRes.data), 'Returns an array of conversations');
  const ourConv = chatsRes.data.find((c) => c._id === conversationId || c.conversationId === conversationId);
  assert(ourConv, 'Newly created conversation appears in recent chats list');
  assert(ourConv.participant && ourConv.participant._id === userBId, 'Conversation correctly associates User B as participant');

  // ── 9. Send text message ─────────────────────────────────────────────────────
  logStep('9. Send text message (POST /messages)');
  const sendRes = await clientA.post('/messages', {
    conversationId,
    text: 'Hello from User Alpha! Integration test message.',
  });
  assert(sendRes.status === 201, `Message sent with status 201 (got ${sendRes.status})`);
  assert(sendRes.data.text === 'Hello from User Alpha! Integration test message.', 'Message text matches');
  assert(sendRes.data.senderId === userAId, 'senderId matches authenticated user');

  // Test empty message rejection (400)
  const emptyMsgRes = await clientA.post('/messages', {
    conversationId,
    text: '   ',
  });
  assert(emptyMsgRes.status === 400, `Empty text message rejected with 400 (got ${emptyMsgRes.status})`);

  // User B replies
  const replyRes = await clientB.post('/messages', {
    conversationId,
    text: 'Hello Alpha! User Beta receiving loud and clear.',
  });
  assert(replyRes.status === 201, 'User B reply sent with status 201');

  // ── 10. Message history ──────────────────────────────────────────────────────
  logStep('10. Message history (GET /messages/:id)');
  const historyRes = await clientA.get(`/messages/${conversationId}`);
  assert(historyRes.status === 200, `GET /messages/:id returns 200 (got ${historyRes.status})`);
  const msgList = Array.isArray(historyRes.data) ? historyRes.data : historyRes.data.messages;
  assert(Array.isArray(msgList) && msgList.length >= 2, `History contains at least 2 messages (got ${msgList.length})`);
  assert(msgList[0].text.includes('Integration test message'), 'First message is in chronological order');
  assert(msgList[1].text.includes('loud and clear'), 'Second message is in chronological order');

  // ── 11. Image upload (multipart/GridFS) ───────────────────────────────────────
  logStep('11. Image upload (POST /messages/image)');
  // Create a minimal 1x1 valid PNG buffer
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, // IEND chunk
    0x42, 0x60, 0x82,
  ]);

  const form = new FormData();
  form.append('image', validPngBuffer, { filename: 'test.png', contentType: 'image/png' });
  form.append('conversationId', conversationId);
  form.append('text', 'Check out this screenshot!');

  const imgUploadRes = await clientA.post('/messages/image', form, {
    headers: form.getHeaders(),
  });
  assert(imgUploadRes.status === 201, `Image uploaded with status 201 (got ${imgUploadRes.status})`);
  assert(imgUploadRes.data.messageType === 'image', 'messageType is "image"');
  assert(imgUploadRes.data.imageFileId, 'GridFS imageFileId is present');
  assert(imgUploadRes.data.imageUrl, `imageUrl is present: ${imgUploadRes.data.imageUrl}`);
  assert(imgUploadRes.data.text === 'Check out this screenshot!', 'Caption saved with image message');

  // Verify image stream retrieval with auth
  logStep('11b. Image stream retrieval via GridFS');
  const imgStreamRes = await clientB.get(imgUploadRes.data.imageUrl, {
    responseType: 'arraybuffer',
  });
  assert(imgStreamRes.status === 200, `Image streamed to participant User B with status 200 (got ${imgStreamRes.status})`);
  assert(imgStreamRes.data.length === validPngBuffer.length, 'Streamed image length matches uploaded binary');

  // Verify unauthorized user cannot retrieve conversation image (403)
  const userCData = {
    name: `User Charlie ${rand}`,
    phone: `+1900333${String(rand).padStart(5, '0').slice(-5)}`,
    email: `charlie_${rand}@example.com`,
    password: 'Password123!',
  };
  const regResC = await api.post('/auth/register', userCData);
  const clientC = axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${regResC.data.token}` },
    validateStatus: () => true,
  });

  const unauthImageRes = await clientC.get(imgUploadRes.data.imageUrl);
  assert(unauthImageRes.status === 403, `Unauthorized non-participant blocked from image with 403 (got ${unauthImageRes.status})`);

  console.log('\n\x1b[32m=== ALL 11 CONVO MODULES TESTED & FULLY FUNCTIONAL ===\x1b[0m\n');
}

run().catch((err) => {
  console.error('\n\x1b[31mFATAL TEST ERROR:\x1b[0m', err.message);
  process.exit(1);
});
