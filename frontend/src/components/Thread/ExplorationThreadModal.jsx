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
  const label = thread.label || thread.relationship_type || (isRejected ? 'No logical connection' : 'Connected');

  return (
    <div className="exp-thread-modal-backdrop" onClick={onClose}>
      <div className="exp-thread-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="exp-thread-modal-header">
          <div className="exp-thread-modal-meta">
            <h3 className="exp-thread-modal-title">Relationship Thread</h3>
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
        <div className={`exp-thread-status-box ${isRejected ? 'rejected' : 'active'}`}>
          <div className="exp-thread-status-header">
            <span className={`exp-thread-dot ${isRejected ? 'rejected' : 'active'}`} />
            <span className="exp-thread-status-name">
              {isRejected ? 'No Logical Connection' : label}
            </span>
          </div>
          {thread.explanation && (
            <p className="exp-thread-explanation">{thread.explanation}</p>
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
