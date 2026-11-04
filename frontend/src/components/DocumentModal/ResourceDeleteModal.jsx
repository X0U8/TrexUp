import { useEffect } from 'react';
import './ResourceDeleteModal.css';

export default function ResourceDeleteModal({
  isOpen,
  node,
  onClose,
  onConfirm,
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const targetName = (node?.name || node?.title || (typeof node === 'string' ? node : '') || 'resource')
    .replace(/\.node$/i, '');
  const rawType = (node?.category || node?.type || 'resource').replace(/_/g, ' ');
  const typeLabel = rawType.charAt(0).toUpperCase() + rawType.slice(1);

  return (
    <div className="res-del-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="res-del-title">
      <div className="res-del-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="res-del-modal-header">
          <div className="res-del-icon-wrap" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h4 id="res-del-title" className="res-del-modal-title">Delete {typeLabel} Node</h4>
        </div>

        <p className="res-del-modal-desc">
          Are you sure you want to delete <code className="res-del-modal-code">{targetName}</code>?
        </p>
        <p className="res-del-modal-subdesc">
          This action cannot be undone. The source document file from storage and any derived exploration tree nodes and threads will be permanently removed.
        </p>

        <div className="res-del-modal-actions">
          <button
            type="button"
            className="res-del-btn-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="res-del-btn-delete"
            onClick={onConfirm}
          >
            Delete Resource
          </button>
        </div>
      </div>
    </div>
  );
}
