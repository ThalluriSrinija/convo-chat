'use strict';

/**
 * test_socket.js
 *
 * Verifies all 12 Socket.IO requirements:
 * 1. Authenticate Socket.IO connections (valid vs invalid token)
 * 2. Connect authenticated users
 * 3. Allow users to join only conversations they belong to (authorized vs unauthorized)
 * 4. Create conversation-specific rooms
 * 5. Send messages through Socket.IO (send_message)
 * 6. Persist messages in MongoDB
 * 7. Emit persisted messages to the other participant (new_message)
 * 8. Sender receives message ack with persisted data
 * 9. Receiver receives message in real-time
 * 10. Handle disconnects
 * 11. Handle reconnects
 * 12. Handle socket errors (message_error on invalid inputs)
 */

const { io } = require('socket.io-client');
const axios = require('axios');

const BASE_URL = 'http://localhost:5002';
const api = axios.create({ baseURL: BASE_URL, validateStatus: () => true });

function log(title) {
  console.log(`\n\x1b[36m▶ ${title}\x1b[0m`);
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`\x1b[31m  ✗ FAILED: ${msg}\x1b[0m`);
    throw new Error(msg);
  }
  console.log(`\x1b[32m  ✓ ${msg}\x1b[0m`);
}

async function run() {
  console.log('=== STARTING SOCKET.IO INTEGRATION TESTS ===');

  const rand = Math.floor(Math.random() * 100000);
  const user1Data = {
    name: `User One ${rand}`,
    email: `user1_${rand}@test.com`,
    phone: `+1800111${String(rand).padStart(5, '0').slice(-5)}`,
    password: 'Password123!',
  };
  const user2Data = {
    name: `User Two ${rand}`,
    email: `user2_${rand}@test.com`,
    phone: `+1800222${String(rand).padStart(5, '0').slice(-5)}`,
    password: 'Password123!',
  };
  const user3Data = {
    name: `User Three ${rand}`,
    email: `user3_${rand}@test.com`,
    phone: `+1800333${String(rand).padStart(5, '0').slice(-5)}`,
    password: 'Password123!',
  };

  // Register users
  const [res1, res2, res3] = await Promise.all([
    api.post('/auth/register', user1Data),
    api.post('/auth/register', user2Data),
    api.post('/auth/register', user3Data),
  ]);

  const token1 = res1.data.token;
  const user1Id = res1.data.user._id;

  const token2 = res2.data.token;
  const user2Id = res2.data.user._id;

  const token3 = res3.data.token;
  const user3Id = res3.data.user._id;

  // Create conversation between User 1 and User 2
  const convRes = await api.post('/conversations', { targetUserId: user2Id }, {
    headers: { Authorization: `Bearer ${token1}` }
  });
  const conversationId = convRes.data.conversationId || convRes.data._id;
  assert(conversationId, `Created conversation ${conversationId} between User 1 and User 2`);

  // ── 1. Authenticate Socket.IO connections ──────────────────────────────────
  log('1. Connection Authentication: Reject unauthenticated/invalid token');
  await new Promise((resolve) => {
    const badSocket = io(BASE_URL, {
      auth: { token: 'invalid_token_12345' },
      transports: ['websocket'],
      reconnection: false,
    });

    badSocket.on('connect_error', (err) => {
      assert(err.message.includes('Authentication failed') || err.message.includes('token'), `Connection rejected with error: ${err.message}`);
      badSocket.close();
      resolve();
    });

    badSocket.on('connect', () => {
      throw new Error('Should not have connected with invalid token!');
    });
  });

  log('2. Connection Authentication: Connect authenticated User 1 and User 2');
  const socket1 = io(BASE_URL, {
    auth: { token: token1 },
    transports: ['websocket'],
    reconnection: true,
  });

  const socket2 = io(BASE_URL, {
    auth: { token: token2 },
    transports: ['websocket'],
    reconnection: true,
  });

  const socket3 = io(BASE_URL, {
    auth: { token: token3 },
    transports: ['websocket'],
    reconnection: true,
  });

  await Promise.all([
    new Promise((resolve) => socket1.on('connect', resolve)),
    new Promise((resolve) => socket2.on('connect', resolve)),
    new Promise((resolve) => socket3.on('connect', resolve)),
  ]);
  assert(socket1.connected, 'Socket 1 connected successfully');
  assert(socket2.connected, 'Socket 2 connected successfully');
  assert(socket3.connected, 'Socket 3 connected successfully');

  // ── 3. Join Conversation Authorization ────────────────────────────────────
  log('3. Conversation Access: Unauthorized user cannot join conversation');
  await new Promise((resolve) => {
    let errorReceived = false;
    socket3.on('message_error', (err) => {
      errorReceived = true;
      assert(err.event === 'join_conversation', `Error event matches join_conversation`);
      assert(err.message.includes('Forbidden') || err.message.includes('not a participant'), `Unauthorized user rejected with error: ${err.message}`);
    });

    socket3.emit('join_conversation', conversationId, (ack) => {
      assert(ack.success === false, 'Ack returned success: false for unauthorized join');
      setTimeout(() => {
        assert(errorReceived, 'message_error event was emitted to unauthorized socket');
        resolve();
      }, 50);
    });
  });

  log('4. Conversation Rooms: Authorized users join conversation room');
  const [join1, join2] = await Promise.all([
    new Promise((resolve) => socket1.emit('join_conversation', conversationId, resolve)),
    new Promise((resolve) => socket2.emit('join_conversation', conversationId, resolve)),
  ]);
  assert(join1.success === true, 'User 1 joined conversation room');
  assert(join2.success === true, 'User 2 joined conversation room');

  // ── 5, 6, 7. Send message, MongoDB persistence, emit new_message ──────────
  log('5, 6, 7. Send message via Socket.IO, persist in MongoDB, emit new_message');

  const testMessageText = `Hello real-time socket test! Timestamp: ${Date.now()}`;

  const messagePromise = new Promise((resolve) => {
    socket2.on('new_message', (msg) => {
      resolve(msg);
    });
  });

  const ackResponse = await new Promise((resolve) => {
    socket1.emit('send_message', { conversationId, text: testMessageText }, resolve);
  });

  assert(ackResponse.success === true, 'Sender received success ack');
  assert(ackResponse.message && ackResponse.message.text === testMessageText, 'Persisted message returned in ack');
  const savedMsgId = ackResponse.message._id;

  const receivedMsg = await messagePromise;
  assert(receivedMsg._id === savedMsgId, `Receiver received new_message with matching ID: ${receivedMsg._id}`);
  assert(receivedMsg.text === testMessageText, `Receiver received matching text: ${receivedMsg.text}`);
  assert(receivedMsg.senderId === user1Id, `Receiver verified senderId: ${receivedMsg.senderId}`);

  log('6b. Verify MongoDB message persistence via REST API');
  const restMessagesRes = await api.get(`/messages/${conversationId}`, {
    headers: { Authorization: `Bearer ${token2}` }
  });
  assert(restMessagesRes.status === 200, 'REST API returned message history');
  const historyList = Array.isArray(restMessagesRes.data) ? restMessagesRes.data : restMessagesRes.data.messages;
  const foundInDb = historyList.find((m) => m._id === savedMsgId);
  assert(foundInDb, 'Message verified saved permanently in MongoDB');
  assert(foundInDb.text === testMessageText, 'Database message text matches exactly');

  // ── 8 & 9. User 2 replies to User 1 ──────────────────────────────────────
  log('8 & 9. User 2 sends reply, User 1 receives new_message');
  const replyText = `Reply from User 2! ${Date.now()}`;
  const replyPromise = new Promise((resolve) => {
    socket1.on('new_message', (msg) => {
      resolve(msg);
    });
  });

  const replyAck = await new Promise((resolve) => {
    socket2.emit('send_message', { conversationId, text: replyText }, resolve);
  });
  assert(replyAck.success === true, 'User 2 reply sent successfully');

  const receivedReply = await replyPromise;
  assert(receivedReply.text === replyText, 'User 1 received reply in real time');
  assert(receivedReply.senderId === user2Id, 'Sender of reply is User 2');

  // ── 12. Handle socket errors (message_error) ──────────────────────────────
  log('12. Handle socket errors: Reject empty message with message_error');
  await new Promise((resolve) => {
    let errEmitted = false;
    socket1.once('message_error', (err) => {
      errEmitted = true;
      assert(err.event === 'send_message', 'message_error event is send_message');
      assert(err.message.includes('required') || err.message.includes('empty'), `Error message: ${err.message}`);
    });

    socket1.emit('send_message', { conversationId, text: '   ' }, (ack) => {
      assert(ack.success === false, 'Ack failed for empty message');
      setTimeout(() => {
        assert(errEmitted, 'message_error event was received');
        resolve();
      }, 50);
    });
  });

  // ── 10 & 11. Handle disconnects and reconnects ────────────────────────────
  log('10 & 11. Disconnect and Reconnect handling');
  socket2.disconnect();
  assert(!socket2.connected, 'Socket 2 successfully disconnected');

  await new Promise((resolve) => setTimeout(resolve, 100));

  socket2.connect();
  await new Promise((resolve) => socket2.once('connect', resolve));
  assert(socket2.connected, 'Socket 2 successfully reconnected');

  // Rejoin room after reconnect
  const rejoinAck = await new Promise((resolve) => {
    socket2.emit('join_conversation', conversationId, resolve);
  });
  assert(rejoinAck.success === true, 'Socket 2 rejoined conversation room after reconnect');

  // Send another message to verify communication works after reconnect
  const afterReconnectMsg = `Message after reconnect! ${Date.now()}`;
  const postReconnectPromise = new Promise((resolve) => {
    socket2.once('new_message', resolve);
  });

  await new Promise((resolve) => {
    socket1.emit('send_message', { conversationId, text: afterReconnectMsg }, resolve);
  });

  const postReconnectReceived = await postReconnectPromise;
  assert(postReconnectReceived.text === afterReconnectMsg, 'Message delivered after reconnect');

  // Clean up sockets
  socket1.close();
  socket2.close();
  socket3.close();

  console.log('\n\x1b[32m=== ALL SOCKET.IO REQUIREMENTS FULLY VERIFIED! ===\x1b[0m\n');
}

run().catch((err) => {
  console.error('\n\x1b[31mFATAL TEST ERROR:\x1b[0m', err.message);
  process.exit(1);
});
