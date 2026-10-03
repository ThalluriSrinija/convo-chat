'use strict';

/**
 * Full end-to-end API + Socket tests for Convo (User A / User B flows).
 * Run with backend up: node test_e2e_full.js
 */

const { io } = require('socket.io-client');
const axios = require('axios');
const FormData = require('form-data');

const BASE_URL = process.env.CONVO_TEST_URL || 'http://localhost:5002';
const api = axios.create({ baseURL: BASE_URL, validateStatus: () => true });

const VALID_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

const results = { passed: [], failed: [] };

function test(name, fn) {
  return fn().then(
    () => {
      results.passed.push(name);
      console.log(`\x1b[32m  ✓ ${name}\x1b[0m`);
    },
    (err) => {
      results.failed.push({ name, error: err.message });
      console.error(`\x1b[31m  ✗ ${name}: ${err.message}\x1b[0m`);
      throw err;
    }
  );
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function client(token) {
  return axios.create({
    baseURL: BASE_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    validateStatus: () => true,
  });
}

async function run() {
  console.log('=== CONVO FULL E2E TEST SUITE ===\n');
  const rand = Math.floor(Math.random() * 1_000_000);
  const userA = {
    name: `E2E Alice ${rand}`,
    phone: `+1910111${String(rand).padStart(5, '0').slice(-5)}`,
    email: `alice_e2e_${rand}@example.com`,
    password: 'Password123!',
  };
  const userB = {
    name: `E2E Bob ${rand}`,
    phone: `+1910222${String(rand).padStart(5, '0').slice(-5)}`,
    email: `bob_e2e_${rand}@example.com`,
    password: 'Password123!',
  };

  let tokenA;
  let tokenB;
  let userAId;
  let userBId;
  let conversationId;
  let imageUrl;
  let socketB;

  // ── 1 Registration ─────────────────────────────────────────────────────────
  await test('1. Registration (User A & B)', async () => {
    const [rA, rB] = await Promise.all([
      api.post('/auth/register', userA),
      api.post('/auth/register', userB),
    ]);
    assert(rA.status === 201 && rB.status === 201, `register status A=${rA.status} B=${rB.status}`);
    tokenA = rA.data.token;
    tokenB = rB.data.token;
    userAId = rA.data.user._id;
    userBId = rB.data.user._id;
    assert(tokenA && tokenB, 'tokens returned');
  });

  // ── 2 Duplicate email ──────────────────────────────────────────────────────
  await test('2. Duplicate email rejected', async () => {
    const dup = await api.post('/auth/register', {
      ...userA,
      phone: `+1910999${String(rand).padStart(5, '0').slice(-5)}`,
    });
    assert(dup.status === 409, `expected 409 got ${dup.status}`);
  });

  // ── 3 Duplicate phone ──────────────────────────────────────────────────────
  await test('3. Duplicate phone rejected', async () => {
    const dup = await api.post('/auth/register', {
      name: 'Other',
      email: `other_${rand}@example.com`,
      phone: userB.phone,
      password: 'Password123!',
    });
    assert(dup.status === 409, `expected 409 got ${dup.status}`);
  });

  // ── 4 Login ────────────────────────────────────────────────────────────────
  await test('4. Login (User A email & User B phone)', async () => {
    const lA = await api.post('/auth/login', { identifier: userA.email, password: userA.password });
    const lB = await api.post('/auth/login', { identifier: userB.phone, password: userB.password });
    assert(lA.status === 200 && lB.status === 200, 'login failed');
    tokenA = lA.data.token;
    tokenB = lB.data.token;
  });

  // ── 5 Invalid login ────────────────────────────────────────────────────────
  await test('5. Invalid login rejected', async () => {
    const bad = await api.post('/auth/login', { identifier: userA.email, password: 'WrongPass1!' });
    assert(bad.status === 401, `expected 401 got ${bad.status}`);
  });

  const cA = () => client(tokenA);
  const cB = () => client(tokenB);

  // ── 7 Protected routes (API) ───────────────────────────────────────────────
  await test('7. Protected routes require auth', async () => {
    const noAuth = await api.get('/users');
    assert(noAuth.status === 401, `GET /users without token: ${noAuth.status}`);
    const noAuthConv = await api.get('/conversations');
    assert(noAuthConv.status === 401, `GET /conversations: ${noAuthConv.status}`);
  });

  // ── 8 User search (User A finds B) ─────────────────────────────────────────
  await test('8. User search finds User B', async () => {
    const search = await cA().get('/users/search', { params: { q: userB.name } });
    assert(search.status === 200, 'search failed');
    assert(search.data.some((u) => u._id === userBId), 'User B not in search results');
  });

  // ── 9 Conversation creation ────────────────────────────────────────────────
  await test('9. User A starts conversation with User B', async () => {
    const create = await cA().post('/conversations', { targetUserId: userBId });
    assert(create.status === 201 || create.status === 200, `create status ${create.status}`);
    conversationId = create.data.conversationId || create.data._id;
    assert(conversationId, 'missing conversationId');
  });

  // ── 10 Duplicate conversation prevention ─────────────────────────────────────
  await test('10. Duplicate conversation returns same id', async () => {
    const again = await cA().post('/conversations', { targetUserId: userBId });
    assert(again.status === 200, `idempotent status ${again.status}`);
    const id2 = again.data.conversationId || again.data._id;
    assert(id2 === conversationId, 'different conversation id on second create');
  });

  // ── 12 Real-time: User B socket receives User A message ───────────────────
  await test('12. Real-time delivery (Socket.IO)', async () => {
    socketB = io(BASE_URL, { auth: { token: tokenB }, transports: ['websocket'], reconnection: true });
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('socket B connect timeout')), 8000);
      socketB.on('connect', () => { clearTimeout(t); resolve(); });
      socketB.on('connect_error', (e) => { clearTimeout(t); reject(e); });
    });

    await new Promise((resolve, reject) => {
      socketB.emit('join_conversation', conversationId, (ack) => {
        if (!ack?.success) reject(new Error('User B failed to join room'));
        else resolve();
      });
    });

    const incoming = new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('new_message timeout')), 8000);
      socketB.once('new_message', (msg) => { clearTimeout(t); resolve(msg); });
    });

    const text = `E2E realtime ${Date.now()}`;
    const send = await cA().post('/messages', { conversationId, text });
    assert(send.status === 201, `send status ${send.status}`);

    const received = await incoming;
    assert(received.text === text, 'real-time text mismatch');
    assert(received.senderId === userAId, 'senderId mismatch on socket payload');
  });

  // ── 11 Text messages (User B reply) ────────────────────────────────────────
  await test('11. User B replies via REST', async () => {
    const reply = await cB().post('/messages', {
      conversationId,
      text: 'Reply from User B via REST',
    });
    assert(reply.status === 201, `reply status ${reply.status}`);
  });

  // ── 13 & 14 Message persistence & full history ─────────────────────────────
  await test('13–14. Message persistence and chronological history', async () => {
    const hist = await cA().get(`/messages/${conversationId}`);
    assert(hist.status === 200, `history ${hist.status}`);
    const list = Array.isArray(hist.data) ? hist.data : hist.data.messages;
    assert(list.length >= 2, `expected >=2 messages got ${list.length}`);
    for (let i = 1; i < list.length; i++) {
      assert(new Date(list[i].sentAt || list[i].createdAt) >= new Date(list[i - 1].sentAt || list[i - 1].createdAt),
        'messages not chronological');
    }
  });

  // ── 15 Recent chat ordering ────────────────────────────────────────────────
  await test('15. Recent chats ordered (newest activity first)', async () => {
    const chats = await cA().get('/conversations');
    assert(chats.status === 200 && Array.isArray(chats.data), 'conversations list failed');
    assert(chats.data.length >= 1, 'empty conversation list');
    const ours = chats.data.find((c) => (c._id || c.conversationId) === conversationId);
    assert(ours, 'conversation missing from recent list');
    if (chats.data.length >= 2) {
      const t0 = new Date(chats.data[0].updatedAt || chats.data[0].latestMessageTimestamp);
      const t1 = new Date(chats.data[1].updatedAt || chats.data[1].latestMessageTimestamp);
      assert(t0 >= t1, 'conversations not sorted by recent activity');
    }
  });

  // ── 16 Image upload (User B) ───────────────────────────────────────────────
  await test('16. User B sends image message', async () => {
    const form = new FormData();
    form.append('image', VALID_PNG, { filename: 'e2e.png', contentType: 'image/png' });
    form.append('conversationId', conversationId);
    const up = await cB().post('/messages/image', form, { headers: form.getHeaders() });
    assert(up.status === 201, `image upload ${up.status}`);
    assert(up.data.messageType === 'image' && up.data.imageUrl, 'invalid image message');
    imageUrl = up.data.imageUrl;
  });

  // ── 17 5 MB limit ──────────────────────────────────────────────────────────
  await test('17. Image over 5 MB rejected', async () => {
    const big = Buffer.alloc(5 * 1024 * 1024 + 1, 0xff);
    big[0] = 0xff; big[1] = 0xd8; big[2] = 0xff;
    const form = new FormData();
    form.append('image', big, { filename: 'big.jpg', contentType: 'image/jpeg' });
    form.append('conversationId', conversationId);
    const res = await cA().post('/messages/image', form, { headers: form.getHeaders() });
    assert(res.status === 400, `expected 400 got ${res.status}`);
  });

  // ── 18 Invalid image format ────────────────────────────────────────────────
  await test('18. Invalid image format rejected', async () => {
    const fake = Buffer.from('not-an-image-file-content');
    const form = new FormData();
    form.append('image', fake, { filename: 'fake.png', contentType: 'image/png' });
    form.append('conversationId', conversationId);
    const res = await cA().post('/messages/image', form, { headers: form.getHeaders() });
    assert(res.status === 400, `expected 400 got ${res.status}`);
  });

  // ── 19 Unauthorized conversation access ────────────────────────────────────
  await test('19. Unauthorized conversation access blocked', async () => {
    const regC = await api.post('/auth/register', {
      name: `E2E Charlie ${rand}`,
      phone: `+1910333${String(rand).padStart(5, '0').slice(-5)}`,
      email: `charlie_e2e_${rand}@example.com`,
      password: 'Password123!',
    });
    const cC = () => client(regC.data.token);
    const hist = await cC().get(`/messages/${conversationId}`);
    assert(hist.status === 403, `expected 403 got ${hist.status}`);
    const conv = await cC().get(`/conversations/${conversationId}`);
    assert(conv.status === 403, `expected 403 got ${conv.status}`);
  });

  // ── 20 Unauthorized image access ───────────────────────────────────────────
  await test('20. Unauthorized image access blocked', async () => {
    assert(imageUrl, 'no imageUrl from prior test');
    const regC = await api.post('/auth/register', {
      name: `E2E Dana ${rand}`,
      phone: `+1910444${String(rand).padStart(5, '0').slice(-5)}`,
      email: `dana_e2e_${rand}@example.com`,
      password: 'Password123!',
    });
    const res = await client(regC.data.token).get(imageUrl);
    assert(res.status === 403, `expected 403 got ${res.status}`);
  });

  // ── 21 & 22 Socket disconnect / reconnect ────────────────────────────────────
  await test('21–22. Socket disconnect and reconnect', async () => {
    assert(socketB?.connected, 'socket B should be connected');
    socketB.disconnect();
    assert(!socketB.connected, 'disconnect failed');
    await new Promise((r) => setTimeout(r, 150));
    socketB.connect();
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('reconnect timeout')), 8000);
      socketB.once('connect', () => { clearTimeout(t); resolve(); });
    });
    await new Promise((resolve, reject) => {
      socketB.emit('join_conversation', conversationId, (ack) => {
        if (!ack?.success) reject(new Error('rejoin failed'));
        else resolve();
      });
    });
    socketB.close();
  });

  // ── 6 Logout (User A then B) ───────────────────────────────────────────────
  await test('6. Logout invalidates session (User A)', async () => {
    const out = await cA().post('/auth/logout');
    assert(out.status === 200, `logout ${out.status}`);
    const me = await cA().get('/auth/me');
    assert(me.status === 401, `token still valid after logout: ${me.status}`);
  });

  await test('6b. Logout (User B)', async () => {
    const out = await cB().post('/auth/logout');
    assert(out.status === 200, `logout B ${out.status}`);
    const me = await cB().get('/auth/me');
    assert(me.status === 401, `token B still valid: ${me.status}`);
  });

  console.log('\n=== SUMMARY ===');
  console.log(`Passed: ${results.passed.length}`);
  console.log(`Failed: ${results.failed.length}`);
  if (results.failed.length) process.exit(1);
}

run().catch((err) => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
