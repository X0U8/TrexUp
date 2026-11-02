import { useEffect } from 'react';
import './DocumentsCollectionModal.css';

export default function DocumentsCollectionModal({
  isOpen,
  onClose,
  documents = [],
  onSelectDoc,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className="docs-collection-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="docs-collection-box" role="dialog" aria-modal="true">
        <div className="docs-collection-header">
          <div className="docs-header-left">
            <h2 className="docs-collection-title">Documents</h2>
            <span className="docs-collection-counter">
              {documents.length} {documents.length === 1 ? 'file' : 'files'}
            </span>
          </div>
          <button
            type="button"
            className="docs-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="docs-collection-body">
          {documents.length === 0 ? (
            <div className="docs-empty-state">
              <svg
                className="docs-empty-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <p className="docs-empty-title">No documents used yet</p>
              <p className="docs-empty-desc">
                Drag and drop research papers, PDFs, DOCX, or text files directly onto the canvas.
              </p>
            </div>
          ) : (
            <div className="docs-list">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="docs-list-item"
                  onClick={() => {
                    onSelectDoc?.(doc);
                    onClose();
                  }}
                  title="Click to view details and inspect on canvas"
                >
                  <div className="docs-item-icon-wrap">
                    <svg
                      className="docs-item-file-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>

                  <div className="docs-item-info">
                    <div className="docs-item-name-row">
                      <span className="docs-item-name">{doc.name || 'Untitled Document'}</span>
                      <span className={`docs-item-status ${doc.uploading ? 'uploading' : ''}`}>
                        {doc.uploading ? 'uploading...' : (doc.status || 'not checked')}
                      </span>
                    </div>

                    <div className="docs-item-meta-row">
                      <span className="docs-item-meta">{formatSize(doc.fileSize)}</span>
                      <span className="docs-item-dot">•</span>
                      <span className="docs-item-id" title={doc.id}>
                        ID: {doc.uploading ? 'Generating...' : doc.id}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="docs-item-view-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDoc?.(doc);
                      onClose();
                    }}
                  >
                    Inspect
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="docs-collection-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
