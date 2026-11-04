import { useState, useEffect } from 'react';
import './WorkflowInfoModal.css';

export default function WorkflowInfoModal({
  isOpen,
  workflowId,
  workflowName,
  workflowDescription,
  workflowNodes = {},
  workflowThreads = [],
  isPredefined = false,
  onClose,
  onUpdateMetadata,
  onDelete,
}) {
  const [name, setName] = useState(workflowName || '');
  const [description, setDescription] = useState(workflowDescription || '');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setName(workflowName || '');
    setDescription(workflowDescription || '');
    setIsEditing(false);
  }, [isOpen, workflowName, workflowDescription]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const nodesList = Object.values(workflowNodes || {});
  const totalNodes = nodesList.length;
  const totalThreads = Array.isArray(workflowThreads) ? workflowThreads.length : 0;

  const agentNodes = nodesList.filter((n) => n.type === 'agent');
  const engineNodes = nodesList.filter((n) => n.type === 'engine');
  const inputNodes = nodesList.filter((n) => n.type === 'input');
  const outputNodes = nodesList.filter((n) => n.type === 'output');

  const hasChanges =
    (name.trim() !== (workflowName || '').trim()) ||
    (description.trim() !== (workflowDescription || '').trim());

  const handleSave = () => {
    if (!name.trim()) return;
    onUpdateMetadata?.({
      name: name.trim(),
      description: description.trim(),
    });
    setIsEditing(false);
  };

  return (
    <div className="wf-info-backdrop" onClick={onClose}>
      <div className="wf-info-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="wf-info-header">
          <div className="wf-info-header-left">

            <div>
              <div className="wf-info-title-row">
                <h3 className="wf-info-title">Workflow Details</h3>
                {isPredefined && (
                  <span className="wf-info-badge-predefined">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Built-in
                  </span>
                )}
              </div>
              <p className="wf-info-subtitle">Pipeline architecture, component breakdown, and configuration</p>
            </div>
          </div>
          <button
            type="button"
            className="wf-info-close-btn"
            onClick={onClose}
            aria-label="Close details"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="wf-info-body">
          {/* Identity Section */}
          <div className="wf-info-section">
            <label className="wf-info-field-label">Workflow Name</label>
            <input
              type="text"
              className="wf-info-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setIsEditing(true);
              }}
              placeholder="e.g. Document Extraction Pipeline"
            />
          </div>

          <div className="wf-info-section">
            <label className="wf-info-field-label">Description</label>
            <textarea
              className="wf-info-textarea"
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setIsEditing(true);
              }}
              placeholder="Describe the workflow purpose, triggers, and expected outputs so agents understand its role..."
            />
          </div>

          {/* Quick Metrics Bar */}
          <div className="wf-info-metrics-grid">
            <div className="wf-info-metric-card">
              <span className="wf-info-metric-val">{totalNodes}</span>
              <span className="wf-info-metric-lbl">Total Nodes</span>
            </div>
            <div className="wf-info-metric-card">
              <span className="wf-info-metric-val">{agentNodes.length}</span>
              <span className="wf-info-metric-lbl">Agents</span>
            </div>
            <div className="wf-info-metric-card">
              <span className="wf-info-metric-val">{engineNodes.length}</span>
              <span className="wf-info-metric-lbl">Engines</span>
            </div>
            <div className="wf-info-metric-card">
              <span className="wf-info-metric-val">{totalThreads}</span>
              <span className="wf-info-metric-lbl">Connections</span>
            </div>
          </div>

          {/* Components Breakdown */}
          <div className="wf-info-components-wrap">
            {/* Agents List */}
            <div className="wf-info-subgroup">
              <div className="wf-info-subgroup-title">
                <span>Agents Used</span>
                <span className="wf-info-count-chip">{agentNodes.length}</span>
              </div>
              {agentNodes.length === 0 ? (
                <div className="wf-info-empty-text">No agent nodes in this workflow</div>
              ) : (
                <div className="wf-info-chips-list">
                  {agentNodes.map((ag) => (
                    <div key={ag.id} className="wf-info-agent-chip">
                      <div className="wf-info-chip-main">
                        <span className="wf-info-chip-title">{ag.title || ag.id}</span>
                        <span className="wf-info-chip-meta">{ag.modelName || ag.modelId || 'Muse Spark'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Engines List */}
            <div className="wf-info-subgroup">
              <div className="wf-info-subgroup-title">
                <span>Engines Used</span>
                <span className="wf-info-count-chip">{engineNodes.length}</span>
              </div>
              {engineNodes.length === 0 ? (
                <div className="wf-info-empty-text">No engine nodes in this workflow</div>
              ) : (
                <div className="wf-info-chips-list">
                  {engineNodes.map((eng) => (
                    <div key={eng.id} className="wf-info-engine-chip">
                      <div className="wf-info-chip-main">
                        <span className="wf-info-chip-title">{eng.title || eng.engineId || eng.id}</span>
                        <span className="wf-info-chip-meta">{eng.engineId || 'Python engine'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Triggers & Scope */}
            {inputNodes.length > 0 && (
              <div className="wf-info-subgroup">
                <div className="wf-info-subgroup-title">
                  <span>Trigger Configuration</span>
                </div>
                <div className="wf-info-trigger-box">
                  {inputNodes.map((inp) => (
                    <div key={inp.id} className="wf-info-trigger-item">
                      <span className="wf-info-trigger-label">Trigger Type:</span>
                      <span className="wf-info-trigger-val">{inp.trigger || 'file_drop'}</span>
                      {inp.acceptedTypes && inp.acceptedTypes.length > 0 && (
                        <span className="wf-info-trigger-types">
                          ({inp.acceptedTypes.join(', ')})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="wf-info-footer">
          <div className="wf-info-footer-left">
            {isPredefined ? (
              <div className="wf-info-protected-hint" title="Predefined pipelines cannot be removed">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>Protected built-in workflow</span>
              </div>
            ) : (
              <button
                type="button"
                className="wf-info-btn-delete"
                onClick={() => {
                  onClose();
                  onDelete?.();
                }}
                title="Delete this workflow"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>Delete Workflow</span>
              </button>
            )}
          </div>

          <div className="wf-info-footer-right">
            <button
              type="button"
              className="wf-info-btn-cancel"
              onClick={onClose}
            >
              Close
            </button>
            {hasChanges && (
              <button
                type="button"
                className="wf-info-btn-save"
                onClick={handleSave}
              >
                Save Changes
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
