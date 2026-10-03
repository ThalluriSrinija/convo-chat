'use strict';

/**
 * config/gridfs.js — GridFS bucket singleton
 *
 * Provides upload/download/delete helpers for image storage.
 * The bucket is initialised once after connectDB() resolves.
 *
 * Bucket layout in MongoDB:
 *   images.files  — file metadata (name, size, contentType, uploadDate)
 *   images.chunks — binary data in 255 KB segments
 */

const { GridFSBucket } = require('mongodb');

/** @type {GridFSBucket|null} */
let _bucket = null;

const BUCKET_NAME = () => process.env.GRIDFS_BUCKET_NAME || 'images';

function initGridFSBucket(mongooseConnection) {
  if (_bucket) return;
  _bucket = new GridFSBucket(mongooseConnection.db, {
    bucketName:     BUCKET_NAME(),
    chunkSizeBytes: 255 * 1024,
  });
  console.log(`[GridFS] Bucket "${BUCKET_NAME()}" ready ✓`);
}

function getGridFSBucket() {
  if (!_bucket) {
    throw new Error('[GridFS] Bucket not initialised — call connectDB() first.');
  }
  return _bucket;
}

/**
 * Open a writable upload stream.
 * @param {string} filename
 * @param {{ contentType: string, conversationId?: string, senderId?: string }} metadata
 */
function openUploadStream(filename, metadata = {}) {
  return getGridFSBucket().openUploadStream(filename, {
    contentType: metadata.contentType,
    metadata,
  });
}

/**
 * Open a readable download stream by file _id.
 * @param {import('mongoose').Types.ObjectId|string} fileId
 */
function openDownloadStream(fileId) {
  const { Types } = require('mongoose');
  const id = typeof fileId === 'string' ? new Types.ObjectId(fileId) : fileId;
  return getGridFSBucket().openDownloadStream(id);
}

/**
 * Permanently delete a file and its chunks from GridFS.
 * @param {import('mongoose').Types.ObjectId|string} fileId
 */
async function deleteFile(fileId) {
  const { Types } = require('mongoose');
  const id = typeof fileId === 'string' ? new Types.ObjectId(fileId) : fileId;
  await getGridFSBucket().delete(id);
}

module.exports = {
  initGridFSBucket,
  getGridFSBucket,
  openUploadStream,
  openDownloadStream,
  deleteFile,
  BUCKET_NAME,
};
