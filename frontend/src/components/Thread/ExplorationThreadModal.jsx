import './ExplorationThreadModal.css';

export default function ExplorationThreadModal({
  isOpen,
  thread,
  sourceNode,
  targetNode,
  onClose,
  onDelete,
}) {
  if (!isOpen || !thread) return null;

  const isRejected = thread.status === 'rejected';
  const isAnalyzing = thread.status === 'analyzing';
  const isManual = Boolean(thread.is_manual || thread.source === 'manual');
  const label =
    thread.label ||
    thread.relationship_type ||
    (isRejected ? 'No logical connection' : isAnalyzing ? 'Analyzing connection...' : 'Connected');

  const relType =
    thread.relationship_type &&
    thread.relationship_type !== 'connected' &&
    thread.relationship_type !== 'analyzing' &&
    thread.relationship_type !== 'rejected' &&
    thread.relationship_type !== label
      ? thread.relationship_type
      : null;

  const explanation =
    thread.explanation ||
    thread.description ||
    (isAnalyzing ? 'Evaluating contextual evidence and semantic relationship between nodes...' : '');

  return (
    <div className="exp-thread-modal-backdrop" onClick={onClose}>
      <div className="exp-thread-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="exp-thread-modal-header">
          <div className="exp-thread-modal-meta">
            <div className="exp-thread-title-row">
              <h3 className="exp-thread-modal-title">Relationship Thread</h3>
              <span className={`exp-thread-origin-badge ${isManual ? 'manual' : 'ai'}`}>
                {isManual ? 'Manual connection' : 'AI synthesized'}
              </span>
            </div>
            <span className="exp-thread-modal-subid">Connection ID: {thread.id || thread.connection_id}</span>
          </div>
          <button type="button" className="exp-thread-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Nodes Pair Flow */}
        <div className="exp-thread-nodes-row">
          <div className="exp-thread-node-pill">
            <span className="exp-thread-node-type">{sourceNode?.type || 'node'}</span>
            <span className="exp-thread-node-title">{sourceNode?.title || sourceNode?.name || 'Source Node'}</span>
          </div>

          <span className="exp-thread-flow-arrow">⟷</span>

          <div className="exp-thread-node-pill">
            <span className="exp-thread-node-type">{targetNode?.type || 'node'}</span>
            <span className="exp-thread-node-title">{targetNode?.title || targetNode?.name || 'Target Node'}</span>
          </div>
        </div>

        {/* Relationship Status / Label */}
        <div className={`exp-thread-status-box ${isRejected ? 'rejected' : isAnalyzing ? 'analyzing' : 'active'}`}>
          <div className="exp-thread-status-header">
            <span className={`exp-thread-dot ${isRejected ? 'rejected' : isAnalyzing ? 'analyzing' : 'active'}`} />
            <span className="exp-thread-status-name">
              {isRejected ? 'No Logical Connection' : label}
            </span>
            {relType && (
              <span className="exp-thread-rel-chip">{relType.replace(/_/g, ' ')}</span>
            )}
          </div>
          {explanation && (
            <div className="exp-thread-explanation-section">
              <span className="exp-thread-explanation-label">AI Verdict & Context</span>
              <p className="exp-thread-explanation">{explanation}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="exp-thread-modal-footer">
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
