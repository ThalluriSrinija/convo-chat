'use strict';

/**
 * config/env.js — Environment variable validation
 *
 * Called at startup before anything else.
 * Throws immediately if any required variable is missing so the server
 * fails fast with a clear message rather than dying with a cryptic error later.
 */

const REQUIRED_VARS = [
  'MONGODB_URI',
  'JWT_SECRET',
  'FRONTEND_URL',
];

function validateEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      '\n[Convo] ❌  Missing required environment variables:\n' +
      missing.map((k) => `   • ${k}`).join('\n') +
      '\n\nCopy backend/.env.example → backend/.env and fill in the values.\n'
    );
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    const insecure = [
      process.env.JWT_SECRET?.includes('replace'),
      process.env.JWT_SECRET?.length < 32,
    ];
    if (insecure.some(Boolean)) {
      console.error('[Convo] ❌  JWT_SECRET is insecure for production. Use a strong random value.');
      process.exit(1);
    }
  }

  console.log('[Env]  Environment variables validated ✓');
}

module.exports = { validateEnv };
