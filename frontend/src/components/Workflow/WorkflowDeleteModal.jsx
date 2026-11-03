import { useEffect } from 'react';
import './WorkflowDeleteModal.css';

export default function WorkflowDeleteModal({
  isOpen,
  workflowName,
  displayName,
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

  const targetName = displayName || workflowName;

  return (
    <div className="wf-del-modal-backdrop" onClick={onClose}>
      <div className="wf-del-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="wf-del-modal-header">
          <div className="wf-del-icon-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h4 className="wf-del-modal-title">Delete Workflow</h4>
        </div>

        <p className="wf-del-modal-desc">
          Are you sure you want to delete <code className="wf-del-modal-code">{targetName}</code>?
        </p>
        <p className="wf-del-modal-subdesc">
          This action cannot be undone. All configured pipeline nodes, agents, engines, and conditional branches in this workflow will be permanently removed.
        </p>

        <div className="wf-del-modal-actions">
          <button
            type="button"
            className="wf-del-btn-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="wf-del-btn-delete"
            onClick={onConfirm}
          >
            Delete Workflow
          </button>
        </div>
      </div>
    </div>
  );
}
