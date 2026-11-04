import { useState, useEffect } from 'react';
import './WorkflowIOModal.css';

const INPUT_DATA_TYPES = [
  {
    id: 'files',
    label: 'Files',
    exts: 'Documents, media, and data files',
  },
  {
    id: 'canvas_nodes',
    label: 'Canvas Nodes',
    exts: 'Findings, hypotheses, and evidence',
  },
];

const TRIGGER_OPTIONS = [
  {
    id: 'file_drop',
    label: 'On File Drop',
    desc: 'Runs automatically when resources or files are dropped on canvas',
  },
  {
    id: 'node_connect',
    label: 'On Node Connect',
    desc: 'Runs automatically when two nodes are connected with a thread',
  },
  {
    id: 'manual',
    label: 'Manual Trigger',
    desc: 'Runs on-demand when dragged onto an exploration canvas node',
  },
];

const normalizeAcceptedTypes = (types) => {
  if (!Array.isArray(types) || types.length === 0) {
    return ['canvas_nodes', 'files'];
  }
  const set = new Set();
  types.forEach((t) => {
    if (t === 'canvas_nodes') {
      set.add('canvas_nodes');
    } else if (['files', 'documents', 'text', 'images', 'audio', 'data', 'raw_prompt'].includes(t)) {
      set.add('files');
    }
  });
  if (set.size === 0) set.add('canvas_nodes');
  return Array.from(set);
};

export default function WorkflowIOModal({ isOpen, node, workflowName, onClose, onUpdate }) {
  const getInitialTrigger = (n) => {
    if (n?.trigger) return n.trigger;
    if (workflowName === 'extraction') return 'file_drop';
    if (workflowName === 'connection_synthesis') return 'node_connect';
    return 'manual';
  };

  const [trigger, setTrigger] = useState(getInitialTrigger(node));
  const [acceptedTypes, setAcceptedTypes] = useState(['canvas_nodes', 'files']);

  useEffect(() => {
    if (!node) return;
    setTrigger(getInitialTrigger(node));
    setAcceptedTypes(normalizeAcceptedTypes(node.acceptedTypes));
  }, [node, workflowName, isOpen]);

  if (!isOpen || !node) return null;

  const handleTriggerChange = (triggerId) => {
    setTrigger(triggerId);
    onUpdate?.(node.id, {
      ...node,
      trigger: triggerId,
    });
  };

  const toggleAcceptedType = (typeId) => {
    let next = acceptedTypes.includes(typeId)
      ? acceptedTypes.filter((t) => t !== typeId)
      : [...acceptedTypes, typeId];
    if (next.length === 0) {
      next = [typeId]; // ensure at least one is kept
    }
    setAcceptedTypes(next);
    onUpdate?.(node.id, {
      ...node,
      acceptedTypes: next,
      sub: `${next.length} accepted format${next.length === 1 ? '' : 's'}`,
    });
  };

  const activeTriggerObj = TRIGGER_OPTIONS.find((t) => t.id === trigger) || TRIGGER_OPTIONS[2];

  return (
    <div className="wf-io-backdrop" onClick={onClose}>
      <div className="wf-io-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="wf-io-header">
          <div className="wf-io-title-wrap">
            <h2 className="wf-io-title">
              {node.type === 'output' ? 'Workflow Output' : 'Workflow Input & Trigger'}
            </h2>
            <span className="wf-io-subid">Node: {node.id}</span>
          </div>
          <button
            type="button"
            className="wf-io-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="wf-io-body">
          {/* Trigger Event Section (Input node only) */}
          {node.type === 'input' && (
            <div className="wf-io-section">
              <span className="wf-io-label">Trigger Source</span>
              <p className="wf-io-desc">Choose how this workflow is activated.</p>

              <div className="wf-trigger-cards-col">
                {TRIGGER_OPTIONS.map((opt) => {
                  const isSelected = trigger === opt.id;
                  return (
                    <div
                      key={opt.id}
                      className={`wf-trigger-card ${isSelected ? 'active' : ''}`}
                      onClick={() => handleTriggerChange(opt.id)}
                    >
                      <div className="wf-trigger-radio">
                        <div className={`wf-trigger-radio-circle ${isSelected ? 'selected' : ''}`}>
                          {isSelected && <div className="wf-trigger-radio-dot" />}
                        </div>
                      </div>

                      <div className="wf-trigger-content">
                        <div className="wf-trigger-title-row">
                          <span className="wf-trigger-title">{opt.label}</span>
                        </div>
                        <span className="wf-trigger-desc">{opt.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Accepted Input Formats: Files & Canvas Nodes */}
          <div className="wf-io-section">
            <span className="wf-io-label">Accepted Inputs</span>
            <p className="wf-io-desc">Select which inputs this workflow can process.</p>
            <div className="wf-io-grid-2col">
              {INPUT_DATA_TYPES.map((t) => {
                const isSelected = acceptedTypes.includes(t.id);
                return (
                  <div
                    key={t.id}
                    className={`wf-io-option ${isSelected ? 'active' : ''}`}
                    onClick={() => toggleAcceptedType(t.id)}
                  >
                    <div className="wf-io-check-box">
                      {isSelected && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <div className="wf-io-option-info">
                      <span className="wf-io-opt-name">{t.label}</span>
                      <span className="wf-io-opt-exts">{t.exts}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="wf-io-footer">
          <span className="wf-io-footer-summary">
            Trigger: {activeTriggerObj.label} • {acceptedTypes.length} accepted input{acceptedTypes.length === 1 ? '' : 's'}
          </span>
          <button type="button" className="wf-io-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
