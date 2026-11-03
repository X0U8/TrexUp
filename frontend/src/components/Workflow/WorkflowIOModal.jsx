import { useState, useEffect } from 'react';
import './WorkflowIOModal.css';

const INPUT_DATA_TYPES = [
  {
    id: 'documents',
    label: 'Documents',
    exts: '.pdf, .docx',
  },
  {
    id: 'text',
    label: 'Text Files',
    exts: '.txt, .md',
  },
  {
    id: 'images',
    label: 'Images',
    exts: '.png, .jpg, .jpeg, .webp',
  },
  {
    id: 'audio',
    label: 'Audio',
    exts: '.mp3, .wav, .m4a, .ogg',
  },
  {
    id: 'data',
    label: 'Data & Tables',
    exts: '.csv, .json, .xlsx',
  },
  {
    id: 'canvas_nodes',
    label: 'Canvas Nodes',
    exts: 'findings, hypotheses, evidence',
  },
  {
    id: 'raw_prompt',
    label: 'Prompt Directive',
    exts: 'natural language instructions',
  },
];

const TRIGGER_OPTIONS = [
  {
    id: 'file_drop',
    label: 'On File Drop Resources',
    desc: 'Runs automatically when resources or files are dropped on the canvas',
    badge: 'Auto',
  },
  {
    id: 'node_connect',
    label: 'On Connect',
    desc: 'Runs automatically when two nodes are connected with a thread',
    badge: 'Auto',
  },
  {
    id: 'manual',
    label: 'Manual',
    desc: 'Runs only on-demand when explicitly executed by the user or assistant',
    badge: 'Default',
  },
];

export default function WorkflowIOModal({ isOpen, node, workflowName, onClose, onUpdate }) {
  const getInitialTrigger = (n) => {
    if (n?.trigger) return n.trigger;
    if (workflowName === 'extraction') return 'file_drop';
    if (workflowName === 'connection_synthesis') return 'node_connect';
    return 'manual';
  };

  const [trigger, setTrigger] = useState(getInitialTrigger(node));
  const [acceptedTypes, setAcceptedTypes] = useState([
    'documents',
    'text',
    'images',
    'audio',
    'data',
    'canvas_nodes',
  ]);
  // Sync state if node changes
  useEffect(() => {
    if (!node) return;
    setTrigger(getInitialTrigger(node));
    setAcceptedTypes(
      node.acceptedTypes || ['documents', 'text', 'images', 'audio', 'data', 'canvas_nodes']
    );
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
    const next = acceptedTypes.includes(typeId)
      ? acceptedTypes.filter((t) => t !== typeId)
      : [...acceptedTypes, typeId];
    setAcceptedTypes(next);
    onUpdate?.(node.id, {
      ...node,
      acceptedTypes: next,
      sub: `${next.length} input format${next.length === 1 ? '' : 's'}`,
    });
  };

  const activeTriggerObj = TRIGGER_OPTIONS.find((t) => t.id === trigger) || TRIGGER_OPTIONS[2];

  return (
    <div className="wf-io-backdrop" onClick={onClose}>
      <div className="wf-io-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="wf-io-header">
          <div className="wf-io-title-wrap">
            <div>
              <h2 className="wf-io-title">
                {node.type === 'output' ? 'Workflow Output Settings' : 'Workflow Input & Trigger'}
              </h2>
              <span className="wf-io-subid">Node ID: {node.id}</span>
            </div>
          </div>
          <button
            type="button"
            className="wf-io-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="wf-io-body">
          {/* Trigger Event Section (Input node only - single choice) */}
          {node.type === 'input' && (
            <div className="wf-io-section">
              <span className="wf-io-label">Trigger Source</span>
              <p className="wf-io-desc">Select how this workflow is activated. Only one trigger can be active.</p>

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
                          <span className={`wf-trigger-badge ${opt.id}`}>
                            {opt.badge}
                          </span>
                        </div>
                        <span className="wf-trigger-desc">{opt.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Accepted Input Formats - ALWAYS VISIBLE */}
          <div className="wf-io-section">
            <span className="wf-io-label">Accepted Input Formats</span>
            <p className="wf-io-desc">Select which data and file types this workflow accepts and processes.</p>
            <div className="wf-io-grid">
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
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
            Trigger: <strong>{activeTriggerObj.label}</strong> • {acceptedTypes.length} format{acceptedTypes.length === 1 ? '' : 's'} enabled
          </span>
          <button type="button" className="wf-io-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
