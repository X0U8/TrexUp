import { useEffect, useRef } from 'react';
import './UploadModal.css';

export default function UploadModal({ isOpen, onClose }) {
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleDropzoneClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className="upload-modal-backdrop"
      onClick={handleBackdropClick}
      aria-modal="true"
      role="dialog"
    >
      <div className="upload-modal-container">
        {/* Header */}
        <div className="upload-modal-header">
          <div className="upload-modal-title">
            <div className="upload-title-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <span>Upload File</span>
          </div>

          <button
            type="button"
            className="upload-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Dropzone Area */}
        <div className="upload-dropzone" onClick={handleDropzoneClick}>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files?.[0]) {
                // UI demonstration only for now as requested
                onClose();
              }
            }}
          />
          <div className="upload-icon-circle">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
              <path d="M12 12v9" />
              <path d="m8 16 4-4 4 4" />
            </svg>
          </div>
          <div className="upload-drop-text">Drag and drop file here, or click to browse</div>
          <div className="upload-drop-subtext">JSON, YAML, PDF, or text files</div>
        </div>

        {/* Action Buttons */}
        <div className="upload-modal-actions">
          <button type="button" className="upload-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="upload-btn-primary" onClick={onClose}>
            Generate Nodes
          </button>
        </div>
      </div>
    </div>
  );
}
