/* global use, db */
// MongoDB Playground for Convo
// Select the database to use.
use('convo');

// ── 1. Clean up seed users if they already exist (idempotent) ───────────────
const seedEmails = [
  'alice@example.com',
  'bob@example.com',
  'charlie@example.com',
  'diana@example.com',
];

const existingUsers = db.getCollection('users').find({ email: { $in: seedEmails } }).toArray();
const existingUserIds = existingUsers.map((u) => u._id);

if (existingUserIds.length > 0) {
  // Remove existing seed messages & conversations
  db.getCollection('messages').deleteMany({
    $or: [
      { senderId: { $in: existingUserIds } },
    ],
  });
  db.getCollection('conversations').deleteMany({
    participants: { $in: existingUserIds },
  });
  db.getCollection('users').deleteMany({
    _id: { $in: existingUserIds },
  });
}

// ── 2. Insert Seed Users ────────────────────────────────────────────────────
// Default password for all seed users is: Password123!
const passwordHash = '$2b$10$YvYxswx8A7U4GY3YTiLVC.y1D2CWr8r6I8iMGpsTiBPstHrJ65x8K';
const now = new Date();

const aliceId = new ObjectId('65f000000000000000000001');
const bobId   = new ObjectId('65f000000000000000000002');
const charlieId = new ObjectId('65f000000000000000000003');
const dianaId   = new ObjectId('65f000000000000000000004');

db.getCollection('users').insertMany([
  {
    _id: aliceId,
    name: 'Alice Smith',
    email: 'alice@example.com',
    phoneNumber: '+12025550101',
    passwordHash: passwordHash,
    avatarColor: '#6c63ff',
    tokenVersion: 0,
    createdAt: new Date(now.getTime() - 86400000 * 3),
    updatedAt: new Date(now.getTime() - 86400000 * 3),
  },
  {
    _id: bobId,
    name: 'Bob Jones',
    email: 'bob@example.com',
    phoneNumber: '+12025550102',
    passwordHash: passwordHash,
    avatarColor: '#10b981',
    tokenVersion: 0,
    createdAt: new Date(now.getTime() - 86400000 * 3),
    updatedAt: new Date(now.getTime() - 86400000 * 3),
  },
  {
    _id: charlieId,
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    phoneNumber: '+12025550103',
    passwordHash: passwordHash,
    avatarColor: '#f59e0b',
    tokenVersion: 0,
    createdAt: new Date(now.getTime() - 86400000 * 2),
    updatedAt: new Date(now.getTime() - 86400000 * 2),
  },
  {
    _id: dianaId,
    name: 'Diana Prince',
    email: 'diana@example.com',
    phoneNumber: '+12025550104',
    passwordHash: passwordHash,
    avatarColor: '#ec4899',
    tokenVersion: 0,
    createdAt: new Date(now.getTime() - 86400000 * 2),
    updatedAt: new Date(now.getTime() - 86400000 * 2),
  },
]);

// ── 3. Insert Conversation (Alice <-> Bob) ──────────────────────────────────
const convId = new ObjectId('65f100000000000000000001');
const sortedKey = [aliceId.toString(), bobId.toString()].sort().join('_');

const msg1Time = new Date(now.getTime() - 3600000 * 2);
const msg2Time = new Date(now.getTime() - 3600000 * 1);
const msg3Time = new Date(now.getTime() - 60000 * 15);

db.getCollection('conversations').insertOne({
  _id: convId,
  participants: [aliceId, bobId],
  participantKey: sortedKey,
  lastMessage: {
    text: 'Sounds great! Looking forward to catching up.',
    messageType: 'text',
    sentAt: msg3Time,
    senderId: bobId,
  },
  createdAt: msg1Time,
  updatedAt: msg3Time,
});

// ── 4. Insert Messages for Conversation ─────────────────────────────────────
db.getCollection('messages').insertMany([
  {
    _id: new ObjectId('65f200000000000000000001'),
    conversationId: convId,
    senderId: aliceId,
    messageType: 'text',
    text: 'Hey Bob, welcome to Convo!',
    imageFileId: null,
    createdAt: msg1Time,
    updatedAt: msg1Time,
  },
  {
    _id: new ObjectId('65f200000000000000000002'),
    conversationId: convId,
    senderId: bobId,
    messageType: 'text',
    text: 'Hi Alice! Real-time messaging works seamlessly here.',
    imageFileId: null,
    createdAt: msg2Time,
    updatedAt: msg2Time,
  },
  {
    _id: new ObjectId('65f200000000000000000003'),
    conversationId: convId,
    senderId: bobId,
    messageType: 'text',
    text: 'Sounds great! Looking forward to catching up.',
    imageFileId: null,
    createdAt: msg3Time,
    updatedAt: msg3Time,
  },
]);

// ── 5. Ensure Collection Indexes ────────────────────────────────────────────
try { db.getCollection('users').createIndex({ email: 1 }, { unique: true }); } catch (_) {}
try { db.getCollection('users').createIndex({ phoneNumber: 1 }, { unique: true }); } catch (_) {}
try {
  db.getCollection('users').createIndex(
    { name: 'text', email: 'text', phoneNumber: 'text' },
    { weights: { name: 10, email: 5, phoneNumber: 3 } }
  );
} catch (_) {}

try { db.getCollection('conversations').createIndex({ participants: 1 }); } catch (_) {}
try { db.getCollection('conversations').createIndex({ participantKey: 1 }, { unique: true }); } catch (_) {}
try { db.getCollection('conversations').createIndex({ participants: 1, 'lastMessage.sentAt': -1 }); } catch (_) {}

try { db.getCollection('messages').createIndex({ conversationId: 1, createdAt: 1 }); } catch (_) {}
try { db.getCollection('messages').createIndex({ senderId: 1 }); } catch (_) {}

// ── Output Verification Summary ─────────────────────────────────────────────
const userCount = db.getCollection('users').countDocuments();
const convCount = db.getCollection('conversations').countDocuments();
const msgCount  = db.getCollection('messages').countDocuments();

({
  status: 'Convo database seeded successfully',
  database: 'convo',
  seedUsers: ['alice@example.com', 'bob@example.com', 'charlie@example.com', 'diana@example.com'],
  credentials: {
    password: 'Password123!',
  },
  counts: {
    totalUsers: userCount,
    totalConversations: convCount,
    totalMessages: msgCount,
  },
});
