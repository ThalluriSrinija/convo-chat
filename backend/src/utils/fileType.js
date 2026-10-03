'use strict';

/**
 * utils/fileType.js
 *
 * Validates file content using binary magic numbers (signatures)
 * rather than trusting client-supplied MIME types or file extensions.
 */

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB in bytes

/**
 * Detects image type from buffer magic numbers.
 *
 * @param {Buffer} buffer
 * @returns {{ mime: string, ext: string } | null}
 */
function detectImageFormat(buffer) {
  if (!buffer || buffer.length < 8) return null;

  // JPEG / JPG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: 'png' };
  }

  // GIF: GIF87a or GIF89a
  if (
    buffer[0] === 0x47 && // G
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x38 && // 8
    (buffer[4] === 0x37 || buffer[4] === 0x39) && // 7 or 9
    buffer[5] === 0x61    // a
  ) {
    return { mime: 'image/gif', ext: 'gif' };
  }

  return null;
}

module.exports = {
  detectImageFormat,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
};
