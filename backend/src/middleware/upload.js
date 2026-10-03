'use strict';

/**
 * middleware/upload.js
 *
 * Multer middleware with file size limit (5 MB) and
 * server-side magic number image format validation.
 */

const multer = require('multer');
const { detectImageFormat, MAX_FILE_SIZE } = require('../utils/fileType');
const { createError } = require('../utils/createError');

const storage = multer.memoryStorage();

const multerUpload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE, // 5 MB
    files: 1,
  },
}).single('image');

/**
 * Express middleware that wraps multer upload and performs
 * binary magic number content inspection.
 */
function uploadImage(req, res, next) {
  multerUpload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(createError(400, 'Image exceeds maximum allowed size of 5 MB.'));
      }
      return next(createError(400, err.message || 'Image upload error.'));
    }

    if (!req.file) {
      return next(createError(400, 'Image file is required (form field: "image").'));
    }

    // Verify actual file content via magic numbers (do not trust client MIME or extension)
    const detected = detectImageFormat(req.file.buffer);
    if (!detected) {
      return next(
        createError(
          400,
          'Invalid image format. Allowed formats: JPG, JPEG, PNG, GIF.'
        )
      );
    }

    req.file.validatedMime = detected.mime;
    req.file.validatedExt = detected.ext;
    next();
  });
}

module.exports = { uploadImage };
