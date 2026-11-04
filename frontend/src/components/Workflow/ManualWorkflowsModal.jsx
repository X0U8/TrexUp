import { useState, useEffect, useRef } from 'react';
import './ManualWorkflowsModal.css';

export default function ManualWorkflowsModal({
  isOpen,
  onClose,
  workflows = [],
  workflowsData = {},
  onStartDragWorkflow,
  onEndDragWorkflow,
  onSelectWorkflow,
  isDraggingWorkflow = false,
}) {
  const modalBoxRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle click outside to close (without full-screen pointer blocking)
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e) => {
      if (e.target.closest('.exploration-workflows-btn')) return;
      if (modalBoxRef.current && !modalBoxRef.current.contains(e.target)) {
        onClose();
      }
    };

    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handlePointerDown);
    }, 60);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter only workflows whose Input trigger is strictly 'manual' AND accepts 'canvas_nodes'
  const eligibleWorkflows = workflows
    .map((wfId) => {
      const data = workflowsData?.[wfId];
      const inputNode =
        data?.nodes?.input ||
        Object.values(data?.nodes || {}).find((n) => n.type === 'input');

      const isManual = inputNode?.trigger === 'manual';
      if (!isManual) return null;

      const accepted = inputNode?.acceptedTypes || ['canvas_nodes', 'files'];
      // Must accept canvas nodes (not files only)
      const acceptsCanvasNodes =
        accepted.includes('canvas_nodes') ||
        accepted.some((t) => ['canvas_nodes', 'findings', 'hypotheses', 'evidence'].includes(t));

      if (!acceptsCanvasNodes) return null;

      return {
        id: wfId,
        name: data?.name || wfId,
        description: data?.description || 'Custom manual workflow pipeline',
      };
    })
    .filter(Boolean);

  return (
    <div className="manual-wf-backdrop">
      <div
        ref={modalBoxRef}
        className={`manual-wf-modal ${isDraggingWorkflow ? 'is-dragging' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="manual-wf-header">
          <div className="manual-wf-title-col">
            <span className="manual-wf-subtitle">
              Drag a workflow onto a canvas node, or click to select a node.
            </span>
          </div>
          <button
            type="button"
            className="manual-wf-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* List of eligible manual workflows */}
        <div className="manual-wf-body">
          {eligibleWorkflows.length === 0 ? (
            <div className="manual-wf-empty">
              <span className="manual-wf-empty-title">No matching manual workflows</span>
              <p className="manual-wf-empty-desc">
                Only workflows with trigger set to <strong>Manual Trigger</strong> and accepted input set to <strong>Canvas Nodes</strong> can be run on canvas nodes.
              </p>
              <p className="manual-wf-empty-hint">
                To enable a workflow here, open it in Workflows view, click the Input node, and configure it to accept Canvas Nodes.
              </p>
            </div>
          ) : (
            <div className="manual-wf-list">
              {eligibleWorkflows.map((wf) => {
                const payload = {
                  type: 'workflow',
                  workflowId: wf.id,
                  workflowName: wf.name,
                  workflowDescription: wf.description,
                };
                return (
                  <div
                    key={wf.id}
                    className="manual-wf-item"
                    draggable="true"
                    onDragStart={(e) => {
                      const str = JSON.stringify(payload);
                      e.dataTransfer.setData('application/json', str);
                      e.dataTransfer.setData('text/plain', str);
                      e.dataTransfer.effectAllowed = 'copy';
                      onStartDragWorkflow?.(payload);
                    }}
                    onDragEnd={() => {
                      onEndDragWorkflow?.();
                    }}
                    onClick={() => {
                      onSelectWorkflow?.(payload);
                    }}
                    title="Drag onto any canvas node, or click to run"
                  >
                    <div className="manual-wf-item-main">
                      <span className="manual-wf-item-name">{wf.name}</span>
                      <span className="manual-wf-item-desc">{wf.description}</span>
                    </div>
                    <div className="manual-wf-drag-chip">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="5 9 2 12 5 15" />
                        <polyline points="9 5 12 2 15 5" />
                        <polyline points="15 19 12 22 9 19" />
                        <polyline points="19 9 22 12 19 15" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <line x1="12" y1="2" x2="12" y2="22" />
                      </svg>
                      <span>Drag to node</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="manual-wf-footer">
          <span className="manual-wf-count-info">
            {eligibleWorkflows.length} manual workflow{eligibleWorkflows.length === 1 ? '' : 's'} available
          </span>
          <button type="button" className="manual-wf-done-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
