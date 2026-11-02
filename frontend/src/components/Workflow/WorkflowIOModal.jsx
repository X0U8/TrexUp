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

export default function WorkflowIOModal({ isOpen, node, onClose, onUpdate }) {
  const [acceptedTypes, setAcceptedTypes] = useState([
    'documents',
    'text',
    'images',
    'audio',
    'data',
    'canvas_nodes',
  ]);
  const [sourceScope, setSourceScope] = useState('uploaded_documents');

  // Sync state if node changes
  useEffect(() => {
    if (!node) return;
    setAcceptedTypes(
      node.acceptedTypes || ['documents', 'text', 'images', 'audio', 'data', 'canvas_nodes']
    );
    setSourceScope(node.sourceScope || 'uploaded_documents');
  }, [node, isOpen]);

  if (!isOpen || !node) return null;

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

  const handleSourceScopeChange = (scope) => {
    setSourceScope(scope);
    onUpdate?.(node.id, { ...node, sourceScope: scope });
  };

  return (
    <div className="wf-io-backdrop" onClick={onClose}>
      <div className="wf-io-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="wf-io-header">
          <div className="wf-io-title-wrap">
            <div>
              <h2 className="wf-io-title">Workflow Input Settings</h2>
              <p className="wf-io-subtitle">
                Select supported formats and material sources for this workflow
              </p>
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
          {/* Accepted Input Formats */}
          <div className="wf-io-section">

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

          {/* Input Source Scope */}
          <div className="wf-io-section">
            <span className="wf-io-label">Source Scope</span>
            <p className="wf-io-desc">Where this workflow looks for incoming files.</p>
            <div className="wf-io-scope-tabs">
              <button
                type="button"
                className={`wf-scope-tab ${sourceScope === 'uploaded_documents' ? 'active' : ''}`}
                onClick={() => handleSourceScopeChange('uploaded_documents')}
              >
                Project Materials
              </button>
              <button
                type="button"
                className={`wf-scope-tab ${sourceScope === 'canvas_nodes' ? 'active' : ''}`}
                onClick={() => handleSourceScopeChange('canvas_nodes')}
              >
                Active Exploration
              </button>
              <button
                type="button"
                className={`wf-scope-tab ${sourceScope === 'workspace_all' ? 'active' : ''}`}
                onClick={() => handleSourceScopeChange('workspace_all')}
              >
                Entire Workspace
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="wf-io-footer">
          <span className="wf-io-footer-summary">
            {acceptedTypes.length} format{acceptedTypes.length === 1 ? '' : 's'} enabled
          </span>
          <button type="button" className="wf-io-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
