import { useState, useEffect, useRef } from 'react';
import './DocumentModal.css';

const SERVER_FILES = 'http://127.0.0.1:8001/storage/documents/';
const TEXT_EXT = ['txt', 'md', 'csv', 'tsv', 'json', 'log'];
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];

/** Where the file lives: the server's stored copy, else the in-session blob, else the cloud URL. */
function resolvePreviewUrl(node) {
  const localPath = node?.local_path || node?.localPath || '';
  if (localPath) {
    const storedName = localPath.split(/[\\/]/).pop();
    return `${SERVER_FILES}${encodeURIComponent(storedName)}`;
  }
  return node?.localBlobUrl || node?.cloudinaryUrl || node?.url || '';
}

/** Shows the file itself: text, PDF or image, with a zoom button for a full-size view. */
function DocumentPreview({ node }) {
  const [text, setText] = useState('');
  const [zoomed, setZoomed] = useState(false);
  const [missing, setMissing] = useState(false);
  const name = (node.file_name || node.fileName || node.title || node.name || '').replace(/\.node$/i, '');
  // The stored file's own extension is the truth; the title can say something else.
  const storedName = (node.local_path || node.localPath || '').split(/[\\/]/).pop();
  const ext = (storedName.includes('.') ? storedName : name).split('.').pop().toLowerCase();
  const url = resolvePreviewUrl(node);
  const isText = TEXT_EXT.includes(ext);
  const isImage = IMAGE_EXT.includes(ext);
  const isPdf = ext === 'pdf';

  useEffect(() => {
    if (!url || !isText) return;
    let cancelled = false;
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((t) => !cancelled && setText(t))
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
    };
  }, [url, isText]);

  if (!url) {
    return <div className="doc-preview-empty">No file to preview.</div>;
  }
  if (!isText && !isImage && !isPdf) {
    return <div className="doc-preview-empty">No preview for .{ext || 'this'} files.</div>;
  }

  const content = (large) => {
    if (missing) return <div className="doc-preview-empty">File not found in storage.</div>;
    if (isImage) return <img className="doc-preview-img" src={url} alt={name} onError={() => setMissing(true)} />;
    if (isPdf) return <iframe className={large ? 'doc-preview-frame large' : 'doc-preview-frame'} src={url} title={name} />;
    return <pre className={large ? 'doc-preview-text large' : 'doc-preview-text'}>{text || 'Loading…'}</pre>;
  };

  return (
    <div className="doc-preview">
      <div className="doc-preview-bar">
        <span className="doc-info-label">Preview</span>
        <button type="button" className="doc-preview-zoom" onClick={() => setZoomed(true)}>
          Zoom
        </button>
      </div>
      <div className="doc-preview-body">{content(false)}</div>
      {zoomed && (
        <div className="doc-preview-overlay" onClick={() => setZoomed(false)}>
          <div className="doc-preview-overlay-inner" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="doc-preview-close" onClick={() => setZoomed(false)} aria-label="Close zoom">
              ✕
            </button>
            {content(true)}
          </div>
        </div>
      )}
    </div>
  );
}

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
      // Do not close when interacting with the model chat panel
      if (e.target.closest('.model-chat-panel')) return;
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

          {(isResource || node.local_path || node.localPath) && <DocumentPreview node={node} />}
          {(node.content || node.description) ? (
            <div className="doc-info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '5px' }}>
              <span className="doc-info-label">Description</span>
              <span className="doc-info-val" style={{ fontSize: '12px', color: '#475569', lineHeight: 1.45, textAlign: 'left', maxHeight: '240px', overflowY: 'auto', whiteSpace: 'pre-wrap', width: '100%', wordBreak: 'break-word' }}>
                {node.content || node.description}
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
