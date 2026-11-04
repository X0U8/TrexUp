import { useEffect, useRef } from 'react';
import './WorkflowRunConfirmCard.css';

export default function WorkflowRunConfirmCard({
  workflow,
  node,
  position,
  onConfirm,
  onCancel,
}) {
  const cardRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel?.();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onConfirm, onCancel]);

  if (!workflow || !node) return null;

  const nodeTitle = node.title || node.name || 'Untitled Node';
  const workflowName = workflow.workflowName || workflow.name || workflow.workflowId || 'Workflow';

  // Compute fixed screen placement near the drop location or center if outside bounds
  let posX = position?.clientX ?? window.innerWidth / 2 - 140;
  let posY = position?.clientY ?? window.innerHeight / 2 - 60;

  // Clamp within viewport
  posX = Math.max(16, Math.min(window.innerWidth - 320, posX + 12));
  posY = Math.max(16, Math.min(window.innerHeight - 150, posY - 20));

  return (
    <div className="wf-confirm-backdrop" onClick={onCancel}>
      <div
        ref={cardRef}
        className="wf-confirm-card"
        style={{ left: `${posX}px`, top: `${posY}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="wf-confirm-header">
          <div className="wf-confirm-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <span className="wf-confirm-title">Run Workflow</span>
        </div>

        <p className="wf-confirm-prompt">
          Run <span className="wf-confirm-target-name">{workflowName}</span> on <span className="wf-confirm-target-name">{nodeTitle}</span>?
        </p>

        <div className="wf-confirm-actions">
          <button
            type="button"
            className="wf-confirm-btn cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="wf-confirm-btn run"
            onClick={onConfirm}
            autoFocus
          >
            Run
          </button>
        </div>
      </div>
    </div>
  );
}
