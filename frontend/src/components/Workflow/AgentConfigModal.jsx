import { useState, useEffect } from 'react';
import './AgentConfigModal.css';

const AVAILABLE_AGENT_MODELS = [
  { id: 'muse-wonder', name: 'Muse Wonder', tag: '1M' },
  { id: 'muse-spark-1.3', name: 'Muse Spark 1.3', tag: '1M' },
  { id: 'muse-spark-1.3-contributor', name: 'Muse Spark 1.3 Cont.', tag: '1M' },
  { id: 'muse-voice-transcribe', name: 'Muse Voice Transcribe', tag: 'Audio' },
  { id: 'muse-image-1.0', name: 'Muse Image 1.0', tag: 'Image' },
  { id: 'muse-spark-1.2', name: 'Muse Spark 1.2', tag: '1M' },
  { id: 'muse-spark-1.2-contributor', name: 'Muse Spark 1.2 Cont.', tag: '1M' },
  { id: 'muse-spark-1.1', name: 'Muse Spark 1.1', tag: '1M' },
];

const REASONING_EFFORT_OPTIONS = [
  { value: 'minimal', label: 'Minimal', desc: 'Shortest reasoning pass (Default)' },
  { value: 'low', label: 'Low', desc: 'Light reasoning' },
  { value: 'medium', label: 'Medium', desc: 'Moderate depth' },
  { value: 'high', label: 'High', desc: 'Deep multi-step reasoning' },
  { value: 'xhigh', label: 'X-High', desc: 'Deeper reasoning' },
  { value: 'max', label: 'Max', desc: 'Extended reasoning (Wonder & Spark 1.3 only)' },
];

const isReasoningModel = (id) => {
  return typeof id === 'string' && (id.startsWith('muse-spark') || id.startsWith('muse-wonder'));
};

const normalizeModelId = (id) => {
  if (!id) return 'muse-spark-1.3';
  if (id === 'muse-wonder-1.0' || id === 'muse_wonder' || id === 'muse-wonder') return 'muse-wonder';
  if (id === 'muse-voice-transcribe-1.0' || id === 'muse_voice_transcribe' || id === 'muse-voice-transcribe') return 'muse-voice-transcribe';
  return id;
};

export default function AgentConfigModal({
  isOpen,
  agentNode,
  onClose,
  onUpdateAgent,
  onDeleteAgent,
  onDuplicateAgent,
}) {
  const [name, setName] = useState('');
  const [modelId, setModelId] = useState('muse-spark-1.3');
  const [prompt, setPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [reasoningEffort, setReasoningEffort] = useState('minimal');
  const [toolAccess, setToolAccess] = useState(false);
  const [contextSources, setContextSources] = useState({
    inputFile: true,
    inputMetadata: true,
    previousOutput: true,
    previousMetadata: true,
  });

  useEffect(() => {
    if (agentNode) {
      setName(agentNode.title || 'Agent');
      setModelId(normalizeModelId(agentNode.modelId));
      setPrompt(agentNode.systemPrompt || '');
      setTemperature(typeof agentNode.temperature === 'number' ? agentNode.temperature : 0.7);
      setReasoningEffort(agentNode.reasoningEffort || 'minimal');
      // Explicit setting wins; otherwise default to enabled for agent nodes
      const hasTools =
        typeof agentNode.tools === 'boolean'
          ? agentNode.tools
          : true;
      setToolAccess(hasTools);

      // Initialize context sources
      if (agentNode.contextSources && typeof agentNode.contextSources === 'object') {
        setContextSources({
          inputFile: Boolean(agentNode.contextSources.inputFile),
          inputMetadata: Boolean(agentNode.contextSources.inputMetadata),
          previousOutput: Boolean(agentNode.contextSources.previousOutput),
          previousMetadata: Boolean(agentNode.contextSources.previousMetadata),
        });
      } else {
        const isVision = Boolean(
          agentNode.title?.toLowerCase().includes('vision') ||
          agentNode.modelId?.toLowerCase().includes('vision') ||
          agentNode.modelId?.toLowerCase().includes('image')
        );
        const src = agentNode.inputSource || (isVision ? 'both' : 'previous');
        setContextSources({
          inputFile: src === 'both' || src === 'original' || isVision,
          inputMetadata: true,
          previousOutput: src === 'both' || src === 'previous',
          previousMetadata: src === 'both' || src === 'previous',
        });
      }
    }
  }, [agentNode, isOpen]);

  if (!isOpen || !agentNode) return null;

  const toggleContextSource = (key) => {
    setContextSources((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleToggleToolAccess = () => {
    setToolAccess((prev) => !prev);
  };

  const supportsMax = normalizeModelId(modelId) === 'muse-wonder' || normalizeModelId(modelId) === 'muse-spark-1.3';
  const effortOptions = supportsMax
    ? REASONING_EFFORT_OPTIONS
    : REASONING_EFFORT_OPTIONS.filter((opt) => opt.value !== 'max');

  const handleSave = () => {
    const selectedModel = AVAILABLE_AGENT_MODELS.find(
      (m) => normalizeModelId(m.id) === normalizeModelId(modelId)
    );

    // Compute legacy inputSource for backwards compatibility
    let computedInputSource = 'both';
    if (contextSources.inputFile && !contextSources.previousOutput) {
      computedInputSource = 'original';
    } else if (!contextSources.inputFile && contextSources.previousOutput) {
      computedInputSource = 'previous';
    }

    onUpdateAgent?.(agentNode.id, {
      ...agentNode,
      title: name.trim() || 'Agent',
      modelId,
      modelName: selectedModel?.name || 'Muse Spark 1.3',
      systemPrompt: prompt,
      temperature,
      reasoningEffort: isReasoningModel(modelId) ? (reasoningEffort || 'minimal') : undefined,
      tools: toolAccess,
      contextSources,
      sub: selectedModel?.name || 'Muse Spark 1.3',
    });
    onClose();
  };

  return (
    <div className="agent-modal-backdrop" onClick={onClose}>
      <div className="agent-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="agent-modal-header">
          <div className="agent-modal-title-row">
            <div>
              <h2 className="agent-modal-title">{agentNode.title || 'Agent Settings'}</h2>
              <span className="agent-modal-subid">Node ID: {agentNode.id}</span>
            </div>
          </div>
          <button type="button" className="agent-modal-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="agent-modal-body">
          {/* Agent Name */}
          <div className="agent-modal-field">
            <label className="agent-modal-label" htmlFor="agent-name-input">
              Agent Name
            </label>
            <input
              id="agent-name-input"
              type="text"
              className="agent-modal-input"
              value={name}
              placeholder="e.g. Extractor Agent, Research Analyst..."
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />
          </div>

          {/* Model Selection */}
          <div className="agent-modal-field">
            <label className="agent-modal-label">Choose Model</label>
            <div className="agent-model-grid">
              {AVAILABLE_AGENT_MODELS.map((m) => {
                const isSelected = normalizeModelId(m.id) === normalizeModelId(modelId);
                return (
                  <div
                    key={m.id}
                    className={`agent-model-opt ${isSelected ? 'active' : ''}`}
                    onClick={() => setModelId(m.id)}
                  >
                    <div className="agent-model-opt-info">
                      <span className="agent-model-opt-name">{m.name}</span>
                      <span className="agent-model-opt-tag">{m.tag}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Context / Input Sources */}
          <div className="agent-modal-field">
            <div className="agent-modal-label-row">
              <label className="agent-modal-label">Context</label>
              <span className="agent-modal-hint">Select information delivered to this agent</span>
            </div>
            <div className="agent-context-grid">
              <label className={`agent-context-box ${contextSources.inputFile ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={contextSources.inputFile}
                  onChange={() => toggleContextSource('inputFile')}
                />
                <div className="agent-context-text-col">
                  <span className="agent-context-box-text">Input File Content</span>
                  <span className="agent-context-box-sub">Raw document text / file bytes</span>
                </div>
              </label>

              <label className={`agent-context-box ${contextSources.inputMetadata ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={contextSources.inputMetadata}
                  onChange={() => toggleContextSource('inputMetadata')}
                />
                <div className="agent-context-text-col">
                  <span className="agent-context-box-text">Input Metadata</span>
                  <span className="agent-context-box-sub">Doc ID, file name, size, node ID</span>
                </div>
              </label>

              <label className={`agent-context-box ${contextSources.previousOutput ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={contextSources.previousOutput}
                  onChange={() => toggleContextSource('previousOutput')}
                />
                <div className="agent-context-text-col">
                  <span className="agent-context-box-text">Previous Node Output</span>
                  <span className="agent-context-box-sub">Extracted text & upstream findings</span>
                </div>
              </label>

              <label className={`agent-context-box ${contextSources.previousMetadata ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={contextSources.previousMetadata}
                  onChange={() => toggleContextSource('previousMetadata')}
                />
                <div className="agent-context-text-col">
                  <span className="agent-context-box-text">Previous Node Metadata</span>
                  <span className="agent-context-box-sub">Metrics, confidence & escalation</span>
                </div>
              </label>
            </div>
          </div>

          {/* Tool Access */}
          <div className="agent-modal-field">
            <div className="agent-modal-label-row">
              <label className="agent-modal-label">Tools</label>
              <span className="agent-modal-hint">Enable or disable tool calling for this agent</span>
            </div>
            <div className="agent-context-single">
              <label className={`agent-context-box ${toolAccess ? 'checked' : ''}`}>
                <input type="checkbox" checked={toolAccess} onChange={handleToggleToolAccess} />
                <div className="agent-context-text-col">
                  <span className="agent-context-box-text">Tool Access</span>
                  <span className="agent-context-box-sub">Allows agent to invoke canvas and exploration tools</span>
                </div>
              </label>
            </div>
          </div>

          {/* System Prompt / Instructions */}
          <div className="agent-modal-field">
            <div className="agent-modal-label-row">
              <label className="agent-modal-label" htmlFor="agent-prompt-input">
                Agent Prompt / Instructions
              </label>
            </div>
            <textarea
              id="agent-prompt-input"
              className="agent-modal-textarea"
              rows={4}
              value={prompt}
              placeholder="Set a prompt for this agent (e.g. Extract key scientific findings, summarize evidence, verify claims...)"
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          {/* Reasoning Effort (Only for Muse Wonder & Muse Spark reasoning models) */}
          {isReasoningModel(modelId) && (
            <div className="agent-modal-field">
              <div className="agent-modal-label-row">
                <label className="agent-modal-label">Reasoning Effort</label>
                <span className="agent-modal-val">
                  {reasoningEffort}
                </span>
              </div>
              <div className="agent-reasoning-pills">
                {effortOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`agent-reasoning-pill ${reasoningEffort === opt.value ? 'active' : ''}`}
                    onClick={() => setReasoningEffort(opt.value)}
                    title={opt.desc}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

            </div>
          )}

          {/* Temperature Slider */}
          <div className="agent-modal-field">
            <div className="agent-modal-label-row">
              <label className="agent-modal-label">Temperature</label>
              <span className="agent-modal-val">{temperature.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              className="agent-modal-range"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
            />
            <div className="agent-range-labels">
              <span>Precise / Analytical (0.0)</span>
              <span>Creative / Diverse (1.0)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="agent-modal-footer">
          <div className="agent-modal-left-actions">
            <button
              type="button"
              className="agent-modal-delete-btn"
              onClick={() => {
                onDeleteAgent?.(agentNode.id);
                onClose();
              }}
            >
              Delete Agent
            </button>
            <button
              type="button"
              className="agent-modal-duplicate-btn"
              onClick={() => {
                onDuplicateAgent?.(agentNode.id);
                onClose();
              }}
            >
              Duplicate
            </button>
          </div>

          <div className="agent-modal-footer-actions">
            <button type="button" className="agent-modal-cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="agent-modal-save-btn" onClick={handleSave}>
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
