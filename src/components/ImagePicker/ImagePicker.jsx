import { useRef, useState, useCallback, useId } from 'react';
import {
  validateImageFile,
  buildImageFormData,
  MAX_IMAGE_SIZE_LABEL,
  ALLOWED_IMAGE_EXTENSIONS,
} from '../../utils/imageValidation.js';
import './ImagePicker.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCEPTED_MIME = 'image/jpeg,image/jpg,image/png,image/gif';

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * ErrorBanner — dismissible error strip shown below the input bar.
 */
function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="img-picker__error" role="alert" aria-live="assertive">
      <span className="img-picker__error-icon" aria-hidden="true">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </span>
      <span>{message}</span>
      <button
        className="img-picker__error-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss error"
        type="button"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

/**
 * UploadProgress — animated progress bar shown during upload.
 */
function UploadProgress({ percent }) {
  return (
    <div className="img-picker__progress-wrap">
      <div className="img-picker__progress-track" role="progressbar"
        aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}
        aria-label={`Uploading: ${percent}%`}>
        <div
          className="img-picker__progress-fill"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="img-picker__progress-label">{percent}% uploaded…</p>
    </div>
  );
}

/**
 * PreviewBar — slide-in strip showing the selected image thumbnail + meta.
 */
function PreviewBar({ file, previewUrl, isReading, isUploading, uploadPercent, viewType, onChangeViewType, onRemove }) {
  const sizeMB = file ? (file.size / (1024 * 1024)).toFixed(2) : '';
  const sizeLabel = file?.size < 1024 * 1024
    ? `${(file.size / 1024).toFixed(1)} KB`
    : `${sizeMB} MB`;

  return (
    <div className="img-picker__preview-bar" aria-label="Selected image preview">

      {/* Thumbnail / loading skeleton */}
      {isReading ? (
        <div className="img-picker__thumb-loading" aria-label="Loading preview…" />
      ) : (
        <div className="img-picker__thumb-wrap">
          <img
            className="img-picker__thumb"
            src={previewUrl}
            alt={`Preview of ${file?.name}`}
          />
          {/* Remove button */}
          {!isUploading && (
            <button
              className="img-picker__remove"
              onClick={onRemove}
              aria-label="Remove selected image"
              type="button"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="3"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* File metadata & Disappearing View Type Selector */}
      {!isReading && (
        <div className="img-picker__meta">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <p className="img-picker__filename" title={file?.name}>{file?.name}</p>
            <span className="img-picker__filesize">{sizeLabel}</span>
          </div>

          {/* Ephemeral View Mode Pill Selector */}
          {!isUploading && (
            <div className="img-picker__viewtype-row" role="group" aria-label="Photo viewing mode">
              <button
                type="button"
                className={`img-picker__viewtype-btn ${viewType === 'regular' ? 'active' : ''}`}
                onClick={() => onChangeViewType('regular')}
                title="Keep image in chat forever"
              >
                Keep in chat
              </button>
              <button
                type="button"
                className={`img-picker__viewtype-btn ${viewType === 'once' ? 'active' : ''}`}
                onClick={() => onChangeViewType('once')}
                title="Disappears after 1 view"
              >
                1 View (Once)
              </button>
              <button
                type="button"
                className={`img-picker__viewtype-btn ${viewType === 'twice' ? 'active' : ''}`}
                onClick={() => onChangeViewType('twice')}
                title="Disappears after 2 views"
              >
                2 Views (Twice)
              </button>
            </div>
          )}

          {isUploading
            ? <UploadProgress percent={uploadPercent} />
            : <p className="img-picker__send-hint">
                {viewType === 'once'
                  ? '🔒 Disappears after recipient opens it 1 time'
                  : viewType === 'twice'
                  ? '🔒 Disappears after recipient opens it 2 times'
                  : 'Press send to share this image.'}
              </p>
          }
        </div>
      )}
    </div>
  );
}

// ── ImagePicker (main export) ─────────────────────────────────────────────────

/**
 * ImagePicker — reusable image selection, validation, and preview component.
 *
 * Renders:
 *   • An attach icon button that triggers the hidden file input
 *   • A preview bar (thumbnail + filename + size) that slides in when an image is selected
 *   • An error banner for type / size violations
 *   • A progress bar during upload (controlled by parent via `uploadPercent`)
 *
 * Does NOT upload the image itself.
 * The parent calls `onImageReady(file, formData)` when a valid image is selected.
 * When the parent starts the upload it passes `isUploading` + `uploadPercent`.
 *
 * Props:
 *   conversationId  string    — used by buildImageFormData to tag the FormData
 *   onImageReady    fn        — (file: File, formData: FormData) => void
 *   onClear         fn        — () => void  — called when user removes the image
 *   isUploading     bool      — parent controls this while the upload is in flight
 *   uploadPercent   number    — 0–100, progress reported by Axios onUploadProgress
 *   disabled        bool      — locks the trigger (e.g. while sending a text message)
 *
 * Usage (Module 19 integration):
 *   <ImagePicker
 *     conversationId={conversationId}
 *     onImageReady={(file, formData) => {
 *       // store formData in state; send it when user clicks the Send button
 *       setPendingImageData(formData);
 *     }}
 *     onClear={() => setPendingImageData(null)}
 *     isUploading={isSending}
 *     uploadPercent={uploadPct}
 *   />
 */
function ImagePicker({
  conversationId,
  onImageReady,
  onClear,
  isUploading  = false,
  uploadPercent = 0,
  disabled     = false,
}) {
  const inputRef = useRef(null);
  const triggerId = useId(); // stable unique id for aria-controls

  // ── Local state ─────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl,   setPreviewUrl]   = useState('');
  const [isReading,    setIsReading]    = useState(false); // FileReader in progress
  const [viewType,     setViewType]     = useState('regular'); // 'regular' | 'once' | 'twice'
  const [error,        setError]        = useState('');

  const hasImage = Boolean(selectedFile && previewUrl && !isReading);

  // ── Handlers ────────────────────────────────────────────────

  /** Open the native file picker. */
  const handleTriggerClick = useCallback(() => {
    if (disabled || isUploading) return;
    inputRef.current?.click();
  }, [disabled, isUploading]);

  /** Process the chosen file: validate → read → preview → notify parent. */
  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];

    // Reset input so the same file can be re-selected after removal
    e.target.value = '';

    if (!file) return;

    // 1. Validate type and size
    const { valid, error: validationError } = validateImageFile(file);
    if (!valid) {
      setError(validationError);
      return;
    }

    // 2. Clear previous error and start reading
    setError('');
    setIsReading(true);
    setSelectedFile(file);
    setViewType('regular');

    // 3. Generate object URL for preview (revoke previous one to avoid memory leak)
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setIsReading(false);

    // 4. Build multipart/form-data payload and notify parent
    const formData = buildImageFormData(file, conversationId);
    formData.set('viewType', 'regular');
    onImageReady?.(file, formData, 'regular');

  }, [conversationId, onImageReady, previewUrl]);

  /** Change view type: 'regular', 'once', 'twice' */
  const handleChangeViewType = useCallback((newType) => {
    setViewType(newType);
    if (selectedFile) {
      const formData = buildImageFormData(selectedFile, conversationId);
      formData.set('viewType', newType);
      if (newType === 'once') formData.set('viewLimit', '1');
      if (newType === 'twice') formData.set('viewLimit', '2');
      onImageReady?.(selectedFile, formData, newType);
    }
  }, [selectedFile, conversationId, onImageReady]);

  /** Remove the selected image and revoke the object URL. */
  const handleRemove = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl('');
    setIsReading(false);
    setViewType('regular');
    setError('');
    onClear?.();
  }, [previewUrl, onClear]);

  const handleDismissError = useCallback(() => setError(''), []);

  // ── Render ──────────────────────────────────────────────────

  return (
    <>
      {/* Preview bar — shown when image is selected */}
      {(hasImage || isReading) && (
        <PreviewBar
          file={selectedFile}
          previewUrl={previewUrl}
          isReading={isReading}
          isUploading={isUploading}
          uploadPercent={uploadPercent}
          viewType={viewType}
          onChangeViewType={handleChangeViewType}
          onRemove={handleRemove}
        />
      )}

      {/* Validation error banner */}
      <ErrorBanner message={error} onDismiss={handleDismissError} />

      {/* Hidden file input */}
      <input
        ref={inputRef}
        id={triggerId}
        className="img-picker__input"
        type="file"
        accept={ACCEPTED_MIME}
        onChange={handleFileChange}
        aria-label="Select an image to send"
        tabIndex={-1}
      />

      {/* Attach icon button — rendered inline in the chat input bar */}
      <button
        className={`img-picker__trigger${hasImage ? ' img-picker__trigger--active' : ''}`}
        onClick={handleTriggerClick}
        disabled={disabled || isUploading}
        aria-label={
          hasImage
            ? `Image selected: ${selectedFile?.name}. Click to change.`
            : `Attach image (${ALLOWED_IMAGE_EXTENSIONS}, max ${MAX_IMAGE_SIZE_LABEL})`
        }
        aria-controls={triggerId}
        type="button"
      >
        {isUploading ? (
          <span
            className="spinner-border spinner-border-sm"
            role="status"
            aria-hidden="true"
            style={{ width: '1rem', height: '1rem', borderWidth: '2px' }}
          />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        )}
      </button>
    </>
  );
}

export default ImagePicker;
