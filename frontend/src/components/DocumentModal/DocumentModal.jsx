import { useState, useEffect, useRef } from 'react';
import './DocumentModal.css';

export default function DocumentModal({ node, isOpen, onClose, onRename }) {
  const [isEditing, setIsEditing] = useState(false);
  const [baseName, setBaseName] = useState('');
  const [extension, setExtension] = useState('');
  const inputRef = useRef(null);

  // Split filename into base and locked extension
  useEffect(() => {
    if (!node?.name) return;
    const lastDot = node.name.lastIndexOf('.');
    if (lastDot > 0) {
      setBaseName(node.name.substring(0, lastDot));
      setExtension(node.name.substring(lastDot));
    } else {
      setBaseName(node.name);
      setExtension('');
    }
    setIsEditing(false);
  }, [node]);

  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      return;
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isEditing) {
          setIsEditing(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isEditing, onClose]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (!isOpen || !node) return null;

  const handleSaveName = () => {
    const trimmed = baseName.trim();
    if (trimmed) {
      const fullNewName = `${trimmed}${extension}`;
      onRename?.(node.id, fullNewName);
    }
    setIsEditing(false);
  };

  const formatSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className="doc-modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="doc-modal-box">
        <div className="doc-modal-header">
          {isEditing ? (
            <div className="title-edit-wrap">
              <input
                ref={inputRef}
                type="text"
                className="title-edit-input"
                value={baseName}
                onChange={(e) => setBaseName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
              />
              {extension && <span className="title-ext-locked">{extension}</span>}
            </div>
          ) : (
            <div
              className="doc-modal-title-view"
              onClick={() => setIsEditing(true)}
              title="Click to edit name"
            >
              <span className="doc-title-base">{baseName || 'Document'}</span>
              {extension && <span className="doc-title-ext">{extension}</span>}
              <svg
                className="doc-title-edit-hint"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
          )}

          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="doc-modal-body">
          <div className="doc-info-row">
            <span className="doc-info-label">Status</span>
            <span className="node-status-badge">{node.status || 'not checked'}</span>
          </div>

          <div className="doc-info-row">
            <span className="doc-info-label">File Size</span>
            <span className="doc-info-val">{formatSize(node.fileSize)}</span>
          </div>

          <div className="doc-info-row">
            <span className="doc-info-label">Document ID</span>
            <span
              className="doc-info-val"
              style={{
                fontFamily: 'monospace',
                fontSize: '12px',
                wordBreak: 'break-all',
                maxWidth: '220px',
                textAlign: 'right',
              }}
            >
              {node.uploading ? 'Generating...' : node.id}
            </span>
          </div>
        </div>

        <div className="doc-modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
