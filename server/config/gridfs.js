'use strict';

/**
 * gridfs.js — GridFS bucket singleton
 *
 * MongoDB GridFS splits files > 255 KB into chunks stored in two collections:
 *   <bucketName>.files  — file metadata (filename, size, MIME type, uploadDate, md5)
 *   <bucketName>.chunks — binary chunk data (chunkSizeBytes: 255 KB default)
 *
 * For Convo, the bucket is named "images" (configurable via GRIDFS_BUCKET_NAME).
 *
 * The bucket is initialised once after the Mongoose connection opens.
 * All other modules access it via getGridFSBucket().
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * Image constraints enforced at the upload layer (see middleware/upload.js):
 *   Max size:  5 MB (5 × 1024 × 1024 bytes)
 *   Allowed:   image/jpeg, image/jpg, image/png, image/gif
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Serving images:
 *   GET /api/images/:fileId  — opens a download stream from the bucket.
 *   The fileId is a MongoDB ObjectId stored in Message.imageFileId.
 */

const { GridFSBucket } = require('mongodb');

/** @type {GridFSBucket|null} */
let _bucket = null;

const BUCKET_NAME = process.env.GRIDFS_BUCKET_NAME || 'images';

/**
 * Initialise the GridFS bucket using the native MongoDB connection.
 * Must be called once after mongoose.connect() resolves.
 *
 * @param {import('mongoose').Connection} mongooseConnection
 */
function initGridFSBucket(mongooseConnection) {
  if (_bucket) return; // already initialised

  _bucket = new GridFSBucket(mongooseConnection.db, {
    bucketName:     BUCKET_NAME,
    chunkSizeBytes: 255 * 1024, // 255 KB per chunk (MongoDB default)
  });

  console.log(`[GridFS] Bucket "${BUCKET_NAME}" ready.`);
}

/**
 * Returns the initialised GridFS bucket.
 *
 * @returns {GridFSBucket}
 * @throws If the bucket has not been initialised yet (connectDB not called).
 */
function getGridFSBucket() {
  if (!_bucket) {
    throw new Error(
      '[GridFS] Bucket not initialised. ' +
      'Call connectDB() before using getGridFSBucket().'
    );
  }
  return _bucket;
}

/**
 * Open an upload stream for writing a file to GridFS.
 *
 * @param {string}  filename   — original filename stored as metadata
 * @param {object}  metadata   — arbitrary key-value pairs stored with the file
 *                               { contentType, conversationId, senderId }
 * @returns {GridFSBucketWriteStream}
 *
 * Usage (inside multer-gridfs-storage):
 *   const uploadStream = openUploadStream('photo.jpg', { contentType: 'image/jpeg' });
 *   readableStream.pipe(uploadStream);
 *   uploadStream.on('finish', (file) => { const fileId = file._id; });
 */
function openUploadStream(filename, metadata = {}) {
  return getGridFSBucket().openUploadStream(filename, {
    metadata,
    contentType: metadata.contentType,
  });
}

/**
 * Open a download stream for reading a file from GridFS.
 *
 * @param {import('mongoose').Types.ObjectId|string} fileId
 * @returns {GridFSBucketReadStream}
 *
 * Usage (in GET /api/images/:fileId route):
 *   const readStream = openDownloadStream(fileId);
 *   res.setHeader('Content-Type', file.contentType);
 *   readStream.pipe(res);
 */
function openDownloadStream(fileId) {
  const { Types } = require('mongoose');
  const objectId = typeof fileId === 'string'
    ? new Types.ObjectId(fileId)
    : fileId;
  return getGridFSBucket().openDownloadStream(objectId);
}

/**
 * Delete a file and all its chunks from GridFS.
 *
 * @param {import('mongoose').Types.ObjectId|string} fileId
 * @returns {Promise<void>}
 */
async function deleteFile(fileId) {
  const { Types } = require('mongoose');
  const objectId = typeof fileId === 'string'
    ? new Types.ObjectId(fileId)
    : fileId;
  await getGridFSBucket().delete(objectId);
}

module.exports = {
  initGridFSBucket,
  getGridFSBucket,
  openUploadStream,
  openDownloadStream,
  deleteFile,
  BUCKET_NAME,
};
