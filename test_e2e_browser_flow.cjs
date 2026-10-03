'use strict';

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FRONTEND_URL = 'http://localhost:5173';
const SAMPLE_IMAGE_PATH = path.join(__dirname, 'test_sample.png');

function log(step, msg) {
  console.log(`\n\x1b[36m▶ [${step}] ${msg}\x1b[0m`);
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`\x1b[31m  ✗ FAILED: ${msg}\x1b[0m`);
    throw new Error(msg);
  }
  console.log(`\x1b[32m  ✓ ${msg}\x1b[0m`);
}

async function run() {
  console.log('=== STARTING COMPLETE USER A & USER B BROWSER E2E TEST ===');

  const rand = Math.floor(Math.random() * 900000) + 100000;
  const letters = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet'];
  const nameSuffix = letters[rand % letters.length] + letters[(rand * 3) % letters.length];
  const userA = {
    name: `Alice ${nameSuffix}`,
    email: `alice_${rand}@convo.test`,
    phone: `+1910${rand}`,
    password: 'Password123!',
  };

  const userB = {
    name: `Bob ${nameSuffix}`,
    email: `bob_${rand}@convo.test`,
    phone: `+1920${rand}`,
    password: 'Password123!',
  };

  log('LAUNCH', 'Launching Chrome with two incognito browser contexts');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const contextA = await browser.createBrowserContext();
  const contextB = await browser.createBrowserContext();

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  pageA.on('console', (msg) => console.log(`[Browser A Console ${msg.type()}] ${msg.text()}`));
  pageB.on('console', (msg) => console.log(`[Browser B Console ${msg.type()}] ${msg.text()}`));
  pageA.on('pageerror', (err) => console.log(`[Browser A PageError]`, err));
  pageB.on('pageerror', (err) => console.log(`[Browser B PageError]`, err));

  // ─────────────────────────────────────────────────────────────
  // USER A: Register
  // ─────────────────────────────────────────────────────────────
  log('USER A', 'Register User A');
  await pageA.goto(`${FRONTEND_URL}/register`, { waitUntil: 'networkidle0' });
  await pageA.type('#register-name', userA.name);
  await pageA.type('#register-phone', userA.phone);
  await pageA.type('#register-email', userA.email);
  await pageA.type('#register-password', userA.password);
  await pageA.type('#register-confirmPassword', userA.password);
  await pageA.click('#register-submit');

  try {
    await pageA.waitForSelector('.register-success', { timeout: 8000 });
  } catch (e) {
    const html = await pageA.evaluate(() => document.body.innerHTML);
    console.log('Registration page HTML on error:', html);
    throw e;
  }
  assert(true, 'User A registered successfully');

  // Navigate to login
  await pageA.click('.register-success a');
  await pageA.waitForSelector('#login-form', { timeout: 8000 });
  assert(true, 'User A navigated to login page');

  // ─────────────────────────────────────────────────────────────
  // USER A: Login
  // ─────────────────────────────────────────────────────────────
  log('USER A', 'Login User A');
  await pageA.type('#login-identifier', userA.email);
  await pageA.type('#login-password', userA.password);
  await pageA.click('button[type="submit"]');

  await pageA.waitForSelector('.home-page', { timeout: 8000 });
  assert(true, 'User A logged in and reached Home page');

  // ─────────────────────────────────────────────────────────────
  // USER B: Register
  // ─────────────────────────────────────────────────────────────
  log('USER B', 'Register User B');
  await pageB.goto(`${FRONTEND_URL}/register`, { waitUntil: 'networkidle0' });
  await pageB.type('#register-name', userB.name);
  await pageB.type('#register-phone', userB.phone);
  await pageB.type('#register-email', userB.email);
  await pageB.type('#register-password', userB.password);
  await pageB.type('#register-confirmPassword', userB.password);
  await pageB.click('#register-submit');

  await pageB.waitForSelector('.register-success', { timeout: 8000 });
  assert(true, 'User B registered successfully');

  // Navigate to login
  await pageB.click('.register-success a');
  await pageB.waitForSelector('#login-form', { timeout: 8000 });
  assert(true, 'User B navigated to login page');

  // ─────────────────────────────────────────────────────────────
  // USER B: Login
  // ─────────────────────────────────────────────────────────────
  log('USER B', 'Login User B');
  await pageB.type('#login-identifier', userB.email);
  await pageB.type('#login-password', userB.password);
  await pageB.click('button[type="submit"]');

  await pageB.waitForSelector('.home-page', { timeout: 8000 });
  assert(true, 'User B logged in and reached Home page');

  // ─────────────────────────────────────────────────────────────
  // USER A: Search User B
  // ─────────────────────────────────────────────────────────────
  log('USER A', 'Search for User B');
  await pageA.type('#home-user-search', userB.name);
  // Wait for debounce and search results
  await pageA.waitForFunction(
    (name) => {
      const cards = Array.from(document.querySelectorAll('.user-card__name'));
      return cards.some((c) => c.textContent.includes(name));
    },
    { timeout: 8000 },
    userB.name
  );
  assert(true, 'User A found User B in search results');

  // ─────────────────────────────────────────────────────────────
  // USER A: Start Conversation with User B
  // ─────────────────────────────────────────────────────────────
  log('USER A', 'Start Conversation with User B');
  const chatBtn = await pageA.waitForSelector('.user-card__chat-btn');
  await chatBtn.click();

  await pageA.waitForSelector('.chat-page', { timeout: 8000 });
  assert(true, 'User A navigated to Chat page with User B');

  // Extract conversationId from URL
  const convUrl = pageA.url();
  const convIdMatch = convUrl.match(/\/chat\/([a-f0-9]+)/i);
  assert(convIdMatch && convIdMatch[1], `Conversation ID extracted: ${convIdMatch?.[1]}`);
  const conversationId = convIdMatch[1];

  // Also navigate User B to the same chat room
  log('USER B', 'Navigate User B to the conversation');
  await pageB.goto(`${FRONTEND_URL}/chat/${conversationId}`, { waitUntil: 'networkidle0' });
  await pageB.waitForSelector('.chat-page', { timeout: 8000 });
  assert(true, 'User B reached Chat page');

  // Give socket connection a moment to join room
  await new Promise((r) => setTimeout(r, 1500));

  // ─────────────────────────────────────────────────────────────
  // USER A: Send Text
  // ─────────────────────────────────────────────────────────────
  log('USER A', 'Send Text Message');
  const textFromA = `Hello Bob! Real-time message from Alice [${Date.now()}]`;
  await pageA.type('#chat-text-input', textFromA);
  await pageA.click('#chat-send-btn');

  // Verify User A UI updates immediately
  await pageA.waitForFunction(
    (text) => {
      const bubbles = Array.from(document.querySelectorAll('.chat-bubble-text'));
      return bubbles.some((b) => b.textContent.includes(text));
    },
    { timeout: 4000 },
    textFromA
  );
  assert(true, 'User A sees sent message');

  // ─────────────────────────────────────────────────────────────
  // USER B: Receive User A's message in real time
  // ─────────────────────────────────────────────────────────────
  log('USER B', 'Receive User A message in real time');
  await pageB.waitForFunction(
    (text) => {
      const bubbles = Array.from(document.querySelectorAll('.chat-bubble-text'));
      return bubbles.some((b) => b.textContent.includes(text));
    },
    { timeout: 6000 },
    textFromA
  );
  assert(true, 'User B received User A message in real time');

  // ─────────────────────────────────────────────────────────────
  // USER B: Reply
  // ─────────────────────────────────────────────────────────────
  log('USER B', 'Reply to User A');
  const replyFromB = `Hey Alice! Bob replying in real-time [${Date.now()}]`;
  await pageB.type('#chat-text-input', replyFromB);
  await pageB.click('#chat-send-btn');

  // Verify User B sees reply
  await pageB.waitForFunction(
    (text) => {
      const bubbles = Array.from(document.querySelectorAll('.chat-bubble-text'));
      return bubbles.some((b) => b.textContent.includes(text));
    },
    { timeout: 4000 },
    replyFromB
  );
  assert(true, 'User B sees reply in UI');

  // Verify User A receives reply in real time
  await pageA.waitForFunction(
    (text) => {
      const bubbles = Array.from(document.querySelectorAll('.chat-bubble-text'));
      return bubbles.some((b) => b.textContent.includes(text));
    },
    { timeout: 6000 },
    replyFromB
  );
  assert(true, 'User A received User B reply in real time');

  // ─────────────────────────────────────────────────────────────
  // USER A: Send Image
  // ─────────────────────────────────────────────────────────────
  log('USER A', 'Send Image from User A');
  const fileInputA = await pageA.waitForSelector('input.img-picker__input');
  await fileInputA.uploadFile(SAMPLE_IMAGE_PATH);

  // Wait for preview bar
  await pageA.waitForSelector('.img-picker__preview-bar', { timeout: 5000 });
  assert(true, 'User A sees image preview bar');

  // Click send button
  await pageA.click('#chat-send-btn');

  // Verify image bubble rendered in User A's chat
  await pageA.waitForSelector('.chat-bubble--sent img.chat-bubble-image', { timeout: 8000 });
  assert(true, 'User A sent image displayed in chat');

  // Verify User B receives image
  await pageB.waitForSelector('.chat-bubble--received img.chat-bubble-image', { timeout: 8000 });
  assert(true, 'User B received image in real time');

  // ─────────────────────────────────────────────────────────────
  // USER B: Send Image
  // ─────────────────────────────────────────────────────────────
  log('USER B', 'Send Image from User B');
  const fileInputB = await pageB.waitForSelector('input.img-picker__input');
  await fileInputB.uploadFile(SAMPLE_IMAGE_PATH);

  await pageB.waitForSelector('.img-picker__preview-bar', { timeout: 5000 });
  assert(true, 'User B sees image preview bar');

  await pageB.click('#chat-send-btn');

  await pageB.waitForFunction(
    () => document.querySelectorAll('.chat-bubble--sent img.chat-bubble-image').length >= 1,
    { timeout: 8000 }
  );
  assert(true, 'User B sent image displayed in chat');

  // Verify User A receives User B's image
  await pageA.waitForFunction(
    () => document.querySelectorAll('.chat-bubble--received img.chat-bubble-image').length >= 1,
    { timeout: 8000 }
  );
  assert(true, 'User A received User B image in real time');

  // ─────────────────────────────────────────────────────────────
  // USER A: Logout
  // ─────────────────────────────────────────────────────────────
  log('USER A', 'Logout User A');
  await pageA.goto(`${FRONTEND_URL}/home`, { waitUntil: 'networkidle0' });
  const logoutBtnA = await pageA.waitForSelector('.navbar-logout-btn');
  await logoutBtnA.click();
  await pageA.waitForSelector('#login-form', { timeout: 8000 });
  assert(true, 'User A logged out successfully');

  // ─────────────────────────────────────────────────────────────
  // USER B: Logout
  // ─────────────────────────────────────────────────────────────
  log('USER B', 'Logout User B');
  await pageB.goto(`${FRONTEND_URL}/home`, { waitUntil: 'networkidle0' });
  const logoutBtnB = await pageB.waitForSelector('.navbar-logout-btn');
  await logoutBtnB.click();
  await pageB.waitForSelector('#login-form', { timeout: 8000 });
  assert(true, 'User B logged out successfully');

  await browser.close();
  console.log('\n\x1b[32m=== USER A & USER B COMPLETE BROWSER FLOW SUCCEEDED! ===\x1b[0m\n');
}

run().catch((err) => {
  console.error('\n\x1b[31mBROWSER E2E ERROR:\x1b[0m', err);
  process.exit(1);
});
