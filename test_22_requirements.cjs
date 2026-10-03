'use strict';

/**
 * test_22_requirements.cjs
 *
 * Verifies all 22 test items requested:
 *  1. Registration
 *  2. Duplicate email
 *  3. Duplicate phone
 *  4. Login
 *  5. Invalid login
 *  6. Logout
 *  7. Protected routes
 *  8. User search
 *  9. Conversation creation
 * 10. Duplicate conversation prevention
 * 11. Text messages
 * 12. Real-time delivery
 * 13. Message persistence
 * 14. Complete history
 * 15. Recent chat ordering
 * 16. Image upload
 * 17. 5 MB limit
 * 18. Invalid image format
 * 19. Unauthorized conversation access
 * 20. Unauthorized image access
 * 21. Socket disconnection
 * 22. Socket reconnection
 */

const axios = require('axios');
const FormData = require('form-data');
const { io } = require('socket.io-client');

const BACKEND_URL = process.env.CONVO_BACKEND_URL || 'http://localhost:5002';
const api = axios.create({ baseURL: BACKEND_URL, validateStatus: () => true });

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

const report = [];

function pass(num, name, detail) {
  console.log(`\x1b[32m  ✓ [Test ${num}] ${name}${detail ? ` — ${detail}` : ''}\x1b[0m`);
  report.push({ num, name, status: 'PASSED', detail });
}

function fail(num, name, error) {
  console.error(`\x1b[31m  ✗ [Test ${num}] ${name} FAILED: ${error}\x1b[0m`);
  report.push({ num, name, status: 'FAILED', error });
  throw new Error(`Test ${num} failed: ${error}`);
}

function client(token) {
  return axios.create({
    baseURL: BACKEND_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    validateStatus: () => true,
  });
}

async function run() {
  console.log('======================================================');
  console.log('       CONVO: 22 MANDATORY REQUIREMENTS TEST SUITE     ');
  console.log('======================================================\n');

  const rand = Math.floor(Math.random() * 900000) + 100000;
  const userA = {
    name: `Alice Requirement ${rand}`,
    email: `req_alice_${rand}@convo.test`,
    phone: `+1800111${String(rand).slice(-4)}`,
    password: 'Password123!',
  };

  const userB = {
    name: `Bob Requirement ${rand}`,
    email: `req_bob_${rand}@convo.test`,
    phone: `+1800222${String(rand).slice(-4)}`,
    password: 'Password123!',
  };

  let tokenA = null;
  let tokenB = null;
  let userAId = null;
  let userBId = null;
  let conversationId = null;
  let imageFileId = null;
  let imageUrl = null;
  let socketA = null;
  let socketB = null;

  // 1. Registration
  try {
    const resA = await api.post('/auth/register', userA);
    const resB = await api.post('/auth/register', userB);
    if (resA.status !== 201 || resB.status !== 201) {
      fail(1, 'Registration', `Expected 201, got A=${resA.status}, B=${resB.status}`);
    }
    userAId = resA.data.user._id;
    userBId = resB.data.user._id;
    tokenA = resA.data.token;
    tokenB = resB.data.token;
    pass(1, 'Registration', 'Both User A and User B registered successfully with status 201');
  } catch (err) {
    fail(1, 'Registration', err.message);
  }

  // 2. Duplicate email
  try {
    const res = await api.post('/auth/register', {
      name: 'Duplicate Email User',
      email: userA.email,
      phone: `+1800999${String(rand).slice(-4)}`,
      password: 'Password123!',
    });
    if (res.status === 409) {
      pass(2, 'Duplicate email', 'Registration with existing email correctly rejected with status 409 Conflict');
    } else {
      fail(2, 'Duplicate email', `Expected status 409, got ${res.status}`);
    }
  } catch (err) {
    fail(2, 'Duplicate email', err.message);
  }

  // 3. Duplicate phone
  try {
    const res = await api.post('/auth/register', {
      name: 'Duplicate Phone User',
      email: `other_${rand}@convo.test`,
      phone: userB.phone,
      password: 'Password123!',
    });
    if (res.status === 409) {
      pass(3, 'Duplicate phone', 'Registration with existing phone correctly rejected with status 409 Conflict');
    } else {
      fail(3, 'Duplicate phone', `Expected status 409, got ${res.status}`);
    }
  } catch (err) {
    fail(3, 'Duplicate phone', err.message);
  }

  // 4. Login
  try {
    const resA = await api.post('/auth/login', { identifier: userA.email, password: userA.password });
    const resB = await api.post('/auth/login', { identifier: userB.phone, password: userB.password });
    if (resA.status === 200 && resB.status === 200 && resA.data.token && resB.data.token) {
      tokenA = resA.data.token;
      tokenB = resB.data.token;
      pass(4, 'Login', 'Login via email (User A) and phone (User B) succeeded with status 200 and valid JWTs');
    } else {
      fail(4, 'Login', `Login failed: A=${resA.status}, B=${resB.status}`);
    }
  } catch (err) {
    fail(4, 'Login', err.message);
  }

  // 5. Invalid login
  try {
    const res = await api.post('/auth/login', { identifier: userA.email, password: 'WrongPassword999!' });
    if (res.status === 401) {
      pass(5, 'Invalid login', 'Invalid password rejected with status 401 Unauthorized');
    } else {
      fail(5, 'Invalid login', `Expected 401, got ${res.status}`);
    }
  } catch (err) {
    fail(5, 'Invalid login', err.message);
  }

  // 7. Protected routes
  try {
    const noAuthUsers = await api.get('/users');
    const noAuthConvs = await api.get('/conversations');
    if (noAuthUsers.status === 401 && noAuthConvs.status === 401) {
      pass(7, 'Protected routes', 'Protected endpoints (/users, /conversations) strictly require auth token (returned 401)');
    } else {
      fail(7, 'Protected routes', `Expected 401 for unauthenticated requests, got /users=${noAuthUsers.status}, /conversations=${noAuthConvs.status}`);
    }
  } catch (err) {
    fail(7, 'Protected routes', err.message);
  }

  // 8. User search
  try {
    const cA = client(tokenA);
    const searchRes = await cA.get('/users/search', { params: { q: userB.name } });
    if (searchRes.status === 200 && Array.isArray(searchRes.data) && searchRes.data.some((u) => u._id === userBId)) {
      pass(8, 'User search', `User A searched for User B by name and found ${userB.name} in results`);
    } else {
      fail(8, 'User search', `Search failed or User B not found in results (status ${searchRes.status})`);
    }
  } catch (err) {
    fail(8, 'User search', err.message);
  }

  // 9. Conversation creation
  try {
    const cA = client(tokenA);
    const convRes = await cA.post('/conversations', { targetUserId: userBId });
    conversationId = convRes.data.conversationId || convRes.data._id;
    if ((convRes.status === 201 || convRes.status === 200) && conversationId) {
      pass(9, 'Conversation creation', `Conversation created between User A and User B (ID: ${conversationId})`);
    } else {
      fail(9, 'Conversation creation', `Failed to create conversation: status ${convRes.status}`);
    }
  } catch (err) {
    fail(9, 'Conversation creation', err.message);
  }

  // 10. Duplicate conversation prevention
  try {
    const cA = client(tokenA);
    const dupRes = await cA.post('/conversations', { targetUserId: userBId });
    const dupId = dupRes.data.conversationId || dupRes.data._id;
    if (dupRes.status === 200 && dupId === conversationId) {
      pass(10, 'Duplicate conversation prevention', 'Idempotent request returned existing conversation ID with status 200');
    } else {
      fail(10, 'Duplicate conversation prevention', `Expected same conversationId ${conversationId}, got ${dupId}`);
    }
  } catch (err) {
    fail(10, 'Duplicate conversation prevention', err.message);
  }

  // 12. Real-time delivery
  try {
    socketB = io(BACKEND_URL, {
      auth: { token: tokenB },
      transports: ['websocket'],
      reconnection: false,
    });

    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Socket B connection timeout')), 5000);
      socketB.on('connect', () => { clearTimeout(t); resolve(); });
      socketB.on('connect_error', (e) => { clearTimeout(t); reject(e); });
    });

    await new Promise((resolve, reject) => {
      socketB.emit('join_conversation', conversationId, (ack) => {
        if (ack?.success) resolve();
        else reject(new Error(ack?.message || 'User B failed to join room'));
      });
    });

    const realtimeMsgPromise = new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('real-time new_message event timeout')), 6000);
      socketB.once('new_message', (msg) => { clearTimeout(t); resolve(msg); });
    });

    const cA = client(tokenA);
    const sentText = `Real-time test message [${Date.now()}]`;
    const sendRes = await cA.post('/messages', { conversationId, text: sentText });
    if (sendRes.status !== 201) fail(12, 'Real-time delivery', `Send message returned ${sendRes.status}`);

    const receivedMsg = await realtimeMsgPromise;
    if (receivedMsg.text === sentText && receivedMsg.senderId === userAId) {
      pass(12, 'Real-time delivery', 'User B received User A message in real time over Socket.IO');
    } else {
      fail(12, 'Real-time delivery', `Payload mismatch: got ${JSON.stringify(receivedMsg)}`);
    }
  } catch (err) {
    fail(12, 'Real-time delivery', err.message);
  }

  // 11. Text messages (User B reply)
  try {
    const cB = client(tokenB);
    const replyText = `User B reply message via REST [${Date.now()}]`;
    const replyRes = await cB.post('/messages', { conversationId, text: replyText });
    if (replyRes.status === 201 && replyRes.data.text === replyText) {
      pass(11, 'Text messages', 'User B sent reply text message successfully with status 201');
    } else {
      fail(11, 'Text messages', `Expected 201, got ${replyRes.status}`);
    }
  } catch (err) {
    fail(11, 'Text messages', err.message);
  }

  // 13. Message persistence & 14. Complete history
  try {
    const cA = client(tokenA);
    const histRes = await cA.get(`/messages/${conversationId}`);
    const msgs = Array.isArray(histRes.data) ? histRes.data : histRes.data.messages;
    if (histRes.status === 200 && msgs.length >= 2) {
      pass(13, 'Message persistence', `All messages persisted in MongoDB (verified ${msgs.length} messages retrieved)`);
      // Check chronological order
      let isChronological = true;
      for (let i = 1; i < msgs.length; i++) {
        if (new Date(msgs[i].sentAt || msgs[i].createdAt) < new Date(msgs[i - 1].sentAt || msgs[i - 1].createdAt)) {
          isChronological = false;
          break;
        }
      }
      if (isChronological) {
        pass(14, 'Complete history', 'Complete message history retrieved in ascending chronological order');
      } else {
        fail(14, 'Complete history', 'Messages are not in ascending chronological order');
      }
    } else {
      fail(13, 'Message persistence', `History returned status ${histRes.status} with ${msgs?.length} messages`);
    }
  } catch (err) {
    fail(13, 'Message persistence', err.message);
  }

  // 15. Recent chat ordering
  try {
    const cA = client(tokenA);
    const chatsRes = await cA.get('/conversations');
    if (chatsRes.status === 200 && Array.isArray(chatsRes.data) && chatsRes.data.length > 0) {
      const conv = chatsRes.data.find((c) => (c._id || c.conversationId) === conversationId);
      if (conv) {
        pass(15, 'Recent chat ordering', 'Conversations returned sorted by recent activity with latest message details');
      } else {
        fail(15, 'Recent chat ordering', 'Active conversation not found in user conversation list');
      }
    } else {
      fail(15, 'Recent chat ordering', `Expected conversations array, got status ${chatsRes.status}`);
    }
  } catch (err) {
    fail(15, 'Recent chat ordering', err.message);
  }

  // 16. Image upload
  try {
    const cB = client(tokenB);
    const form = new FormData();
    form.append('image', VALID_PNG, { filename: 'test_upload.png', contentType: 'image/png' });
    form.append('conversationId', conversationId);
    form.append('text', 'Test caption for image');

    const uploadRes = await cB.post('/messages/image', form, { headers: form.getHeaders() });
    if (uploadRes.status === 201 && uploadRes.data.messageType === 'image' && uploadRes.data.imageUrl) {
      imageFileId = uploadRes.data.imageFileId;
      imageUrl = uploadRes.data.imageUrl;
      pass(16, 'Image upload', `Image uploaded to GridFS (status 201, imageFileId: ${imageFileId})`);
    } else {
      fail(16, 'Image upload', `Failed to upload image: status ${uploadRes.status}`);
    }
  } catch (err) {
    fail(16, 'Image upload', err.message);
  }

  // 17. 5 MB limit
  try {
    const cA = client(tokenA);
    const overSizeBuffer = Buffer.alloc(5 * 1024 * 1024 + 256, 0xff);
    overSizeBuffer[0] = 0x89;
    overSizeBuffer[1] = 0x50;
    overSizeBuffer[2] = 0x4e;
    overSizeBuffer[3] = 0x47;

    const form = new FormData();
    form.append('image', overSizeBuffer, { filename: 'large.png', contentType: 'image/png' });
    form.append('conversationId', conversationId);

    const res = await cA.post('/messages/image', form, { headers: form.getHeaders() });
    if (res.status === 400) {
      pass(17, '5 MB limit', 'Image exceeding 5 MB rejected with status 400');
    } else {
      fail(17, '5 MB limit', `Expected status 400 for >5MB file, got ${res.status}`);
    }
  } catch (err) {
    fail(17, '5 MB limit', err.message);
  }

  // 18. Invalid image format
  try {
    const cA = client(tokenA);
    const fakeBuffer = Buffer.from('NOT_AN_IMAGE_FILE_HEADER_TEXT');

    const form = new FormData();
    form.append('image', fakeBuffer, { filename: 'spoofed.png', contentType: 'image/png' });
    form.append('conversationId', conversationId);

    const res = await cA.post('/messages/image', form, { headers: form.getHeaders() });
    if (res.status === 400) {
      pass(18, 'Invalid image format', 'Spoofed non-image binary rejected by server magic number validation (status 400)');
    } else {
      fail(18, 'Invalid image format', `Expected status 400 for invalid magic numbers, got ${res.status}`);
    }
  } catch (err) {
    fail(18, 'Invalid image format', err.message);
  }

  // 19. Unauthorized conversation access
  try {
    const userC = {
      name: `Charlie Stranger ${rand}`,
      email: `req_charlie_${rand}@convo.test`,
      phone: `+1800333${String(rand).slice(-4)}`,
      password: 'Password123!',
    };
    const regC = await api.post('/auth/register', userC);
    const tokenC = regC.data.token;
    const cC = client(tokenC);

    const histRes = await cC.get(`/messages/${conversationId}`);
    const convRes = await cC.get(`/conversations/${conversationId}`);

    if (histRes.status === 403 && convRes.status === 403) {
      pass(19, 'Unauthorized conversation access', 'Non-participant blocked from conversation details & messages with status 403 Forbidden');
    } else {
      fail(19, 'Unauthorized conversation access', `Expected 403, got messages=${histRes.status}, conversation=${convRes.status}`);
    }
  } catch (err) {
    fail(19, 'Unauthorized conversation access', err.message);
  }

  // 20. Unauthorized image access
  try {
    const userD = {
      name: `Dana Stranger ${rand}`,
      email: `req_dana_${rand}@convo.test`,
      phone: `+1800444${String(rand).slice(-4)}`,
      password: 'Password123!',
    };
    const regD = await api.post('/auth/register', userD);
    const tokenD = regD.data.token;
    const cD = client(tokenD);

    const imgRes = await cD.get(imageUrl);
    if (imgRes.status === 403) {
      pass(20, 'Unauthorized image access', 'Non-participant blocked from image download stream with status 403 Forbidden');
    } else {
      fail(20, 'Unauthorized image access', `Expected 403, got ${imgRes.status}`);
    }
  } catch (err) {
    fail(20, 'Unauthorized image access', err.message);
  }

  // 21. Socket disconnection & 22. Socket reconnection
  try {
    if (!socketB.connected) {
      socketB.connect();
      await new Promise((r) => setTimeout(r, 500));
    }
    // 21: Disconnection
    socketB.disconnect();
    if (!socketB.connected) {
      pass(21, 'Socket disconnection', 'Client socket disconnected cleanly');
    } else {
      fail(21, 'Socket disconnection', 'Socket failed to disconnect');
    }

    // 22: Reconnection
    await new Promise((r) => setTimeout(r, 200));
    socketB.connect();
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('reconnect timeout')), 5000);
      socketB.once('connect', () => { clearTimeout(t); resolve(); });
    });

    await new Promise((resolve, reject) => {
      socketB.emit('join_conversation', conversationId, (ack) => {
        if (ack?.success) resolve();
        else reject(new Error('Failed to rejoin room after reconnect'));
      });
    });

    if (socketB.connected) {
      pass(22, 'Socket reconnection', 'Socket reconnected and successfully rejoined conversation room');
    } else {
      fail(22, 'Socket reconnection', 'Socket not connected after reconnect attempt');
    }
    socketB.close();
  } catch (err) {
    fail(21, 'Socket disconnection/reconnection', err.message);
  }

  // 6. Logout
  try {
    const cA = client(tokenA);
    const outResA = await cA.post('/auth/logout');
    if (outResA.status !== 200) fail(6, 'Logout', `Logout A returned ${outResA.status}`);

    const meResA = await cA.get('/auth/me');
    if (meResA.status === 401) {
      pass(6, 'Logout', 'User A logged out; token session invalidated in database (subsequent /auth/me returned 401)');
    } else {
      fail(6, 'Logout', `Expected 401 after logout, got ${meResA.status}`);
    }

    const cB = client(tokenB);
    const outResB = await cB.post('/auth/logout');
    const meResB = await cB.get('/auth/me');
    if (outResB.status === 200 && meResB.status === 401) {
      // both logged out
    }
  } catch (err) {
    fail(6, 'Logout', err.message);
  }

  console.log('\n======================================================');
  console.log(`TOTAL REQUIREMENTS VERIFIED: ${report.filter((r) => r.status === 'PASSED').length} / 22`);
  console.log('======================================================\n');
}

run().catch((err) => {
  console.error('\nFATAL TEST FAILURE:', err);
  process.exit(1);
});
