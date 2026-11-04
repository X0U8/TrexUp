import './ExplorationThreadModal.css';

export default function ExplorationThreadModal({
  isOpen,
  thread,
  sourceNode,
  targetNode,
  onClose,
  onDelete,
  onViewLogs,
}) {
  if (!isOpen || !thread) return null;

  const isWorkflowRun = thread.kind === 'workflow_run';
  const isRejected = thread.status === 'rejected' || (isWorkflowRun && thread.status === 'failed');
  const isAnalyzing = thread.status === 'analyzing' || (isWorkflowRun && thread.status === 'running');
  const isCompleted = isWorkflowRun && thread.status === 'completed';

  const label = isWorkflowRun
    ? `${thread.workflowName || thread.label || 'Workflow'} (${thread.status || 'completed'})`
    : (thread.label ||
      thread.relationship_type ||
      (isRejected ? 'No logical connection' : isAnalyzing ? 'Analyzing connection...' : 'Connected'));

  const relType = isWorkflowRun
    ? 'Workflow Output'
    : (thread.relationship_type &&
        thread.relationship_type !== 'connected' &&
        thread.relationship_type !== 'analyzing' &&
        thread.relationship_type !== 'rejected' &&
        thread.relationship_type !== label
        ? thread.relationship_type
        : null);

  const explanation =
    thread.description ||
    thread.explanation ||
    thread.workflowDescription ||
    (isAnalyzing ? 'Evaluating contextual evidence and semantic relationship between nodes...' : '');

  return (
    <div className="exp-thread-modal-backdrop" onClick={onClose}>
      <div className="exp-thread-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="exp-thread-modal-header">
          <div className="exp-thread-modal-meta">
            <div className="exp-thread-title-row">
              <h3 className="exp-thread-modal-title">
                {isWorkflowRun ? 'Workflow Connection' : 'Relationship Thread'}
              </h3>
            </div>
            <span className="exp-thread-modal-subid">{thread.id || thread.connection_id}</span>
          </div>
          <button type="button" className="exp-thread-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Nodes Pair Flow */}
        <div className="exp-thread-nodes-row">
          <div className="exp-thread-node-pill">
            <span className="exp-thread-node-type">{sourceNode?.type || 'input node'}</span>
            <span className="exp-thread-node-title">{sourceNode?.title || sourceNode?.name || 'Input Node'}</span>
          </div>

          <span className="exp-thread-flow-arrow">⟷</span>

          <div className="exp-thread-node-pill">
            <span className="exp-thread-node-type">{targetNode?.type || 'output node'}</span>
            <span className="exp-thread-node-title">{targetNode?.title || targetNode?.name || 'Output Node'}</span>
          </div>
        </div>

        {/* Relationship Status / Label */}
        <div className={`exp-thread-status-box ${isRejected ? 'rejected' : isAnalyzing ? 'analyzing' : isWorkflowRun ? 'workflow' : 'active'}`}>
          <div className="exp-thread-status-header">
            <span className={`exp-thread-dot ${isRejected ? 'rejected' : isAnalyzing ? 'analyzing' : isWorkflowRun ? 'workflow' : 'active'}`} />
            <span className="exp-thread-status-name">
              {isRejected && !isWorkflowRun ? 'No Logical Connection' : label}
            </span>
            {relType && (
              <span className="exp-thread-rel-chip">{relType.replace(/_/g, ' ')}</span>
            )}
          </div>
          {explanation && (
            <div className="exp-thread-explanation-section">
              <p className="exp-thread-explanation">{explanation}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="exp-thread-modal-footer">
          <div className="exp-thread-footer-left">
            <button
              type="button"
              className="exp-thread-btn-delete"
              onClick={() => {
                onDelete?.(thread.id || thread.connection_id);
                onClose();
              }}
            >
              Delete Connection
            </button>
            {isWorkflowRun && (
              <button
                type="button"
                className="exp-thread-btn-logs"
                onClick={() => onViewLogs?.(thread)}
              >
                View Execution Logs
              </button>
            )}
          </div>

          <button
            type="button"
            className="exp-thread-btn-done"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
