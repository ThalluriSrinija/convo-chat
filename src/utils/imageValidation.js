/**
 * imageValidation.js — file validation rules for image messages.
 *
 * Used by ImagePicker to validate selected files before preview or upload.
 * All rules are defined here so they can be updated in one place
 * when backend constraints change.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum allowed file size in bytes (5 MB) */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/** Human-readable size limit for error messages */
export const MAX_IMAGE_SIZE_LABEL = '5 MB';

/** Allowed MIME types */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
];

/** Allowed extensions (for display in error messages) */
export const ALLOWED_IMAGE_EXTENSIONS = 'JPG, JPEG, PNG, GIF';

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validates a File object against Convo's image constraints.
 *
 * @param {File} file
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateImageFile(file) {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported file type "${file.type || 'unknown'}". Allowed: ${ALLOWED_IMAGE_EXTENSIONS}.`,
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File is too large (${sizeMB} MB). Maximum allowed size is ${MAX_IMAGE_SIZE_LABEL}.`,
    };
  }

  return { valid: true, error: null };
}

/**
 * Builds a FormData object ready for multipart/form-data upload via Axios.
 *
 * Usage (Module 19):
 *   const formData = buildImageFormData(file, conversationId);
 *   await axiosInstance.post('/messages/image', formData, {
 *     headers: { 'Content-Type': 'multipart/form-data' },
 *     onUploadProgress: (e) => { ... },
 *   });
 *
 * @param {File}   file             The validated image file
 * @param {string} conversationId   The target conversation
 * @returns {FormData}
 */
export function buildImageFormData(file, conversationId) {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('conversationId', conversationId);
  return formData;
}
