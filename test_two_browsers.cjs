'use strict';

const puppeteer = require('puppeteer-core');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:5002';

const api = axios.create({ baseURL: BACKEND_URL, validateStatus: () => true });

function log(msg) {
  console.log(`\n\x1b[36m▶ ${msg}\x1b[0m`);
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`\x1b[31m  ✗ FAILED: ${msg}\x1b[0m`);
    throw new Error(msg);
  }
  console.log(`\x1b[32m  ✓ ${msg}\x1b[0m`);
}

async function run() {
  console.log('=== STARTING DUAL BROWSER REAL-TIME SOCKET.IO TEST ===');

  const rand = Math.floor(Math.random() * 100000);
  const userA = {
    name: `Alice Dual ${rand}`,
    email: `alice_${rand}@dualtest.com`,
    phone: `+1700111${String(rand).padStart(5, '0').slice(-5)}`,
    password: 'Password123!',
  };

  const userB = {
    name: `Bob Dual ${rand}`,
    email: `bob_${rand}@dualtest.com`,
    phone: `+1700222${String(rand).padStart(5, '0').slice(-5)}`,
    password: 'Password123!',
  };

  log('1. Pre-register test users Alice and Bob');
  const [resA, resB] = await Promise.all([
    api.post('/auth/register', userA),
    api.post('/auth/register', userB),
  ]);
  assert(resA.status === 201, 'Registered Alice');
  assert(resB.status === 201, 'Registered Bob');

  const tokenA = resA.data.token;
  const tokenB = resB.data.token;
  const userAId = resA.data.user._id;
  const userBId = resB.data.user._id;

  // Create conversation between Alice and Bob
  const convRes = await api.post('/conversations', { targetUserId: userBId }, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const conversationId = convRes.data.conversationId || convRes.data._id;
  assert(conversationId, `Created conversation ${conversationId}`);

  log('2. Launch Chrome Browser');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  // Create two separate incognito browser contexts
  const contextA = await browser.createBrowserContext();
  const contextB = await browser.createBrowserContext();

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await pageA.setViewport({ width: 900, height: 750 });
  await pageB.setViewport({ width: 900, height: 750 });

  pageA.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[Browser A Error] ${msg.text()}`);
  });
  pageB.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[Browser B Error] ${msg.text()}`);
  });

  log('3. Session A: Login Alice & navigate to chat');
  await pageA.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle0' });
  await pageA.type('#login-identifier', userA.email);
  await pageA.type('#login-password', userA.password);
  await pageA.click('button[type="submit"]');

  await pageA.waitForSelector('.home-page', { timeout: 8000 });
  assert(true, 'Alice logged into Session A, Home page rendered');

  // Navigate to Chat
  await pageA.goto(`${FRONTEND_URL}/chat/${conversationId}`, { waitUntil: 'networkidle0' });
  await pageA.waitForSelector('.chat-page', { timeout: 8000 });
  assert(true, 'Alice in Session A reached Chat page');

  log('4. Session B: Login Bob & navigate to chat');
  await pageB.goto(`${FRONTEND_URL}/login`, { waitUntil: 'networkidle0' });
  await pageB.type('#login-identifier', userB.email);
  await pageB.type('#login-password', userB.password);
  await pageB.click('button[type="submit"]');

  await pageB.waitForSelector('.home-page', { timeout: 8000 });
  assert(true, 'Bob logged into Session B, Home page rendered');

  // Navigate to Chat
  await pageB.goto(`${FRONTEND_URL}/chat/${conversationId}`, { waitUntil: 'networkidle0' });
  await pageB.waitForSelector('.chat-page', { timeout: 8000 });
  assert(true, 'Bob in Session B reached Chat page');

  // Wait a moment for socket connections and rooms to establish
  await new Promise((r) => setTimeout(r, 1500));

  log('5. Session A (Alice) sends a message to Session B (Bob)');
  const aliceMessageText = `Hi Bob! This is Alice sending via Socket.IO [${Date.now()}]`;

  await pageA.type('#chat-text-input', aliceMessageText);
  await pageA.click('#chat-send-btn');

  // Check Requirement 8: Update the sender UI immediately!
  log('6. Verify Requirement 8: Alice UI updates immediately with sent message');
  await pageA.waitForFunction(
    (text) => {
      const bubbles = Array.from(document.querySelectorAll('.chat-bubble-text'));
      return bubbles.some((b) => b.textContent.includes(text));
    },
    { timeout: 3000 },
    aliceMessageText
  );
  assert(true, 'Alice (sender) UI updated immediately with the sent message');

  // Check Requirement 9: Update receiver UI immediately!
  log('7. Verify Requirement 9: Bob UI updates immediately in real-time');
  await pageB.waitForFunction(
    (text) => {
      const bubbles = Array.from(document.querySelectorAll('.chat-bubble-text'));
      return bubbles.some((b) => b.textContent.includes(text));
    },
    { timeout: 5000 },
    aliceMessageText
  );
  assert(true, 'Bob (receiver) UI updated immediately with the real-time message');

  log('8. Session B (Bob) replies to Session A (Alice)');
  const bobReplyText = `Hey Alice! Bob received your message in real-time! [${Date.now()}]`;

  await pageB.type('#chat-text-input', bobReplyText);
  await pageB.click('#chat-send-btn');

  // Bob's UI updates immediately
  await pageB.waitForFunction(
    (text) => {
      const bubbles = Array.from(document.querySelectorAll('.chat-bubble-text'));
      return bubbles.some((b) => b.textContent.includes(text));
    },
    { timeout: 3000 },
    bobReplyText
  );
  assert(true, 'Bob (sender) UI updated immediately with his reply');

  // Alice's UI updates immediately via Socket.IO
  await pageA.waitForFunction(
    (text) => {
      const bubbles = Array.from(document.querySelectorAll('.chat-bubble-text'));
      return bubbles.some((b) => b.textContent.includes(text));
    },
    { timeout: 5000 },
    bobReplyText
  );
  assert(true, 'Alice (receiver) UI updated immediately with Bob real-time reply');

  log('9. Verify MongoDB persistence upon page refresh (REST API history retrieval)');
  // Reload Alice's page
  await pageA.reload({ waitUntil: 'networkidle0' });
  await pageA.waitForSelector('.chat-page', { timeout: 8000 });

  await pageA.waitForFunction(
    (textA, textB) => {
      const bubbles = Array.from(document.querySelectorAll('.chat-bubble-text'));
      const hasA = bubbles.some((b) => b.textContent.includes(textA));
      const hasB = bubbles.some((b) => b.textContent.includes(textB));
      return hasA && hasB;
    },
    { timeout: 5000 },
    aliceMessageText,
    bobReplyText
  );
  assert(true, 'Alice reloaded page and both messages retrieved from MongoDB REST API history');

  // Take screenshots of both sessions
  const artifactDir = '/Users/thallurisrinija/.gemini/antigravity-ide/brain/5c9537cd-2089-4271-8c61-6e74f99bb192';
  await pageA.screenshot({ path: path.join(artifactDir, 'session_a_alice.png') });
  await pageB.screenshot({ path: path.join(artifactDir, 'session_b_bob.png') });
  assert(true, 'Captured screenshot of Session A (Alice)');
  assert(true, 'Captured screenshot of Session B (Bob)');

  await browser.close();

  console.log('\n\x1b[32m=== DUAL BROWSER REAL-TIME MESSAGING FULLY VERIFIED! ===\x1b[0m\n');
}

run().catch((err) => {
  console.error('\n\x1b[31mFATAL TEST ERROR:\x1b[0m', err);
  process.exit(1);
});
