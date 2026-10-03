'use strict';

/**
 * middleware/requestLogger.js
 *
 * Lightweight request logger for development.
 * In production, morgan writes to stdout and is handled by the process manager.
 */

const morgan = require('morgan');

// Compact format: METHOD /path STATUS ms — size
const devFormat  = ':method :url :status :response-time ms - :res[content-length]';
const prodFormat = 'combined';

function redactSensitiveUrl(url) {
  if (!url || typeof url !== 'string') return url;
  return url.replace(/([?&]token=)[^&]+/gi, '$1[REDACTED]');
}

const requestLogger = morgan(
  process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
  {
    skip: (_req, res) =>
      process.env.NODE_ENV === 'test' || res.statusCode < 400,
    stream: {
      write: (line) => {
        process.stdout.write(redactSensitiveUrl(line));
      },
    },
  }
);

module.exports = requestLogger;
