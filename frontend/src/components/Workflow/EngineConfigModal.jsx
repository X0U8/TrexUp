import { useState, useEffect, useMemo } from 'react';
import { getEngineManifest } from '../../utils/engineUtils';
import './EngineConfigModal.css';

function renderTypeIcon(type) {
  const norm = String(type || '').toLowerCase();
  switch (norm) {
    case 'file':
    case 'document':
    case 'pdf':
      return (
        <svg className="engine-io-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case 'text':
      return (
        <svg className="engine-io-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      );
    case 'image':
      return (
        <svg className="engine-io-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    case 'audio':
      return (
        <svg className="engine-io-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
        </svg>
      );
    case 'json':
    default:
      return (
        <svg className="engine-io-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 7c0-2 1-3 3-3M4 17c0 2 1 3 3 3M4 12h2M20 7c0-2-1-3-3-3M20 17c0 2-1 3-3 3M20 12h-2" />
        </svg>
      );
  }
}

function resolveTypeName(val) {
  if (typeof val === 'string') return val;
  if (val && typeof val.type === 'string') return val.type;
  return 'data';
}

export default function EngineConfigModal({
  isOpen,
  engineNode,
  enginesData = {},
  onClose,
  onUpdateEngine,
}) {
  const engineId = engineNode?.engineId;
  const manifest = useMemo(() => {
    return getEngineManifest(engineId, enginesData);
  }, [engineId, enginesData]);

  const [contextSources, setContextSources] = useState({
    inputFile: true,
    inputMetadata: true,
    previousOutput: false,
    previousMetadata: false,
  });

  useEffect(() => {
    if (engineNode) {
      if (engineNode.contextSources) {
        setContextSources({
          inputFile: Boolean(engineNode.contextSources.inputFile),
          inputMetadata: Boolean(engineNode.contextSources.inputMetadata),
          previousOutput: Boolean(engineNode.contextSources.previousOutput),
          previousMetadata: Boolean(engineNode.contextSources.previousMetadata),
        });
      } else {
        const src = engineNode.inputSource || (engineNode.engineId === 'file_detection' ? 'original' : 'previous');
        setContextSources({
          inputFile: src === 'both' || src === 'original',
          inputMetadata: true,
          previousOutput: src === 'both' || src === 'previous',
          previousMetadata: src === 'both' || src === 'previous',
        });
      }
    }
  }, [engineNode, isOpen]);

  const toggleContextSource = (key) => {
    const updated = {
      ...contextSources,
      [key]: !contextSources[key],
    };
    setContextSources(updated);

    let nextSource = 'both';
    if (updated.inputFile && !updated.previousOutput) nextSource = 'original';
    else if (!updated.inputFile && updated.previousOutput) nextSource = 'previous';

    onUpdateEngine?.(engineNode.id, {
      ...engineNode,
      inputSource: nextSource,
      contextSources: updated,
    });
  };

  if (!isOpen || !engineNode) return null;

  const inputTypes = Object.entries(manifest.inputs || {}).map(([key, val]) => ({
    name: key,
    type: resolveTypeName(val),
  }));

  const outputTypes = Object.entries(manifest.outputs || {}).map(([key, val]) => ({
    name: key,
    type: resolveTypeName(val),
  }));

  return (
    <div className="engine-modal-backdrop" onClick={onClose}>
      <div className="engine-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Name with Node ID & Engine ID below it, close cross on top right */}
        <div className="engine-modal-header">
          <div className="engine-modal-meta">
            <h2 className="engine-modal-title">{manifest.name || engineNode.title || 'Engine'}</h2>
            <div className="engine-modal-id-row">
              <span className="engine-modal-subid">Node ID: {engineNode.id}</span>
              <span className="engine-modal-id-sep">•</span>
              <span className="engine-modal-subid">Engine ID: {engineId}</span>
            </div>
          </div>
          <button type="button" className="engine-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Description directly (no label) */}
        {manifest.description && (
          <p className="engine-modal-description">{manifest.description}</p>
        )}

        {/* Input -> Output with icons (no extra text) */}
        <div className="engine-modal-io">
          <div className="engine-io-list">
            {inputTypes.length > 0 ? (
              inputTypes.map((item) => (
                <span key={item.name} className="engine-io-badge" title={`${item.name} (${item.type})`}>
                  {renderTypeIcon(item.type)}
                  <span>{item.name}</span>
                </span>
              ))
            ) : (
              <span className="engine-io-badge empty">—</span>
            )}
          </div>

          <svg className="engine-io-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>

          <div className="engine-io-list">
            {outputTypes.length > 0 ? (
              outputTypes.map((item) => (
                <span key={item.name} className="engine-io-badge" title={`${item.name} (${item.type})`}>
                  {renderTypeIcon(item.type)}
                  <span>{item.name}</span>
                </span>
              ))
            ) : (
              <span className="engine-io-badge empty">—</span>
            )}
          </div>
        </div>

        {/* Context / Input Sources */}
        <div className="engine-context-section">
          <div className="engine-context-header-row">
            <span className="engine-context-label">Context</span>
            <span className="engine-context-hint">Select input sources for this engine</span>
          </div>
          <div className="engine-context-grid">
            <label className={`engine-context-box ${contextSources.inputFile ? 'checked' : ''}`}>
              <input
                type="checkbox"
                checked={contextSources.inputFile}
                onChange={() => toggleContextSource('inputFile')}
              />
              <div className="engine-context-text-col">
                <span className="engine-context-box-text">Input File Content</span>
                <span className="engine-context-box-sub">Raw file bytes / document</span>
              </div>
            </label>

            <label className={`engine-context-box ${contextSources.inputMetadata ? 'checked' : ''}`}>
              <input
                type="checkbox"
                checked={contextSources.inputMetadata}
                onChange={() => toggleContextSource('inputMetadata')}
              />
              <div className="engine-context-text-col">
                <span className="engine-context-box-text">Input Metadata</span>
                <span className="engine-context-box-sub">Doc ID, filename, size, type</span>
              </div>
            </label>

            <label className={`engine-context-box ${contextSources.previousOutput ? 'checked' : ''}`}>
              <input
                type="checkbox"
                checked={contextSources.previousOutput}
                onChange={() => toggleContextSource('previousOutput')}
              />
              <div className="engine-context-text-col">
                <span className="engine-context-box-text">Previous Node Output</span>
                <span className="engine-context-box-sub">Upstream engine results</span>
              </div>
            </label>

            <label className={`engine-context-box ${contextSources.previousMetadata ? 'checked' : ''}`}>
              <input
                type="checkbox"
                checked={contextSources.previousMetadata}
                onChange={() => toggleContextSource('previousMetadata')}
              />
              <div className="engine-context-text-col">
                <span className="engine-context-box-text">Previous Node Metadata</span>
                <span className="engine-context-box-sub">Metrics & execution flags</span>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
