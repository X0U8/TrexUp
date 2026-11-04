import { useState, useEffect, useRef } from 'react';
import './DocumentModal.css';

export default function DocumentModal({ node, isOpen, onClose, onRename, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [baseName, setBaseName] = useState('');
  const [extension, setExtension] = useState('');
  const inputRef = useRef(null);
  const modalBoxRef = useRef(null);

  const isResource =
    node?.category === 'resource' ||
    node?.type === 'document' ||
    Boolean(node?.fileSize) ||
    Boolean(node?.cloudinaryUrl);

  // Split filename into base and locked extension only for real resource files
  useEffect(() => {
    if (!node) return;
    const raw = (node.title || node.name || '').replace(/\.node$/i, '');
    if (isResource) {
      const lastDot = raw.lastIndexOf('.');
      if (lastDot > 0) {
        setBaseName(raw.substring(0, lastDot));
        setExtension(raw.substring(lastDot));
      } else {
        setBaseName(raw);
        setExtension('');
      }
    } else {
      setBaseName(raw);
      setExtension('');
    }
    setIsEditing(false);
  }, [node, isResource]);

  // Handle Escape key
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

  // Handle click outside to close (without needing a dimmed/blurred backdrop)
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (e) => {
      if (modalBoxRef.current && !modalBoxRef.current.contains(e.target)) {
        onClose();
      }
    };

    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handlePointerDownOutside);
    }, 60);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [isOpen, onClose]);

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

  const getCategoryLabel = () => {
    if (isResource) return 'Resource';
    const raw = (node?.type || node?.category || 'finding').replace(/_/g, ' ');
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  return (
    <div className="doc-modal-backdrop">
      <div className="doc-modal-box" ref={modalBoxRef}>
        <div className="doc-modal-header">
          <div className="doc-header-col">
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
                <span className="doc-title-base">{baseName || node?.title || node?.name || 'Node'}</span>
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
            {(node.id || node.node_id) && (
              <span className="doc-node-id-sub">
                {node.id || node.node_id}
              </span>
            )}
          </div>

          <button
            type="button"
            className="doc-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="doc-modal-body">
          <div className="doc-info-row">
            <span className="doc-info-label">Category</span>
            <span className="doc-info-val">
              {getCategoryLabel()}
            </span>
          </div>

          <div className="doc-info-row">
            <span className="doc-info-label">Status</span>
            <span className="node-status-badge">{node.status || (isResource ? 'not checked' : 'proposed')}</span>
          </div>

          {isResource && node.fileSize ? (
            <div className="doc-info-row">
              <span className="doc-info-label">File Size</span>
              <span className="doc-info-val">{formatSize(node.fileSize)}</span>
            </div>
          ) : null}

          {node.description ? (
            <div className="doc-info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '5px' }}>
              <span className="doc-info-label">Description</span>
              <span className="doc-info-val" style={{ fontSize: '12px', color: '#475569', lineHeight: 1.45, textAlign: 'left' }}>
                {node.description}
              </span>
            </div>
          ) : null}

        </div>

        <div className="doc-modal-actions">
          {onDelete && (
            <button
              type="button"
              className="doc-btn-delete"
              onClick={() => onDelete(node)}
            >
              Delete
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
