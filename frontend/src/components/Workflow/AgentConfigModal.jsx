import { useState, useEffect } from 'react';
import './AgentConfigModal.css';

const AVAILABLE_AGENT_MODELS = [
  { id: 'muse-spark-1.3', name: 'Muse Spark 1.3', tag: 'Fast · Tools' },
  { id: 'muse-wonder', name: 'Muse Wonder', tag: 'Deep Reasoning' },
  { id: 'muse-spark-1.3-contributor', name: 'Muse Spark Contributor', tag: 'Efficient' },
  { id: 'sam-3.1', name: 'SAM 3.1', tag: 'Visual/Segment' },
  { id: 'muse-voice-transcribe', name: 'Muse Voice Transcribe', tag: 'Audio' },
  { id: 'muse-image-1.0', name: 'Muse Image 1.0', tag: 'Image Gen' },
];

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

  useEffect(() => {
    if (agentNode) {
      setName(agentNode.title || 'Agent');
      setModelId(agentNode.modelId || 'muse-spark-1.3');
      setPrompt(agentNode.systemPrompt || '');
      setTemperature(typeof agentNode.temperature === 'number' ? agentNode.temperature : 0.7);
    }
  }, [agentNode, isOpen]);

  if (!isOpen || !agentNode) return null;

  const handleSave = () => {
    const selectedModel = AVAILABLE_AGENT_MODELS.find((m) => m.id === modelId);
    onUpdateAgent?.(agentNode.id, {
      ...agentNode,
      title: name.trim() || 'Agent',
      modelId,
      modelName: selectedModel?.name || 'Muse Spark 1.3',
      systemPrompt: prompt,
      temperature,
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
              <h2 className="agent-modal-title">Agent Settings</h2>
              <p className="agent-modal-subtitle">Configure model, prompt, and execution rules for this agent</p>
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
                const isSelected = m.id === modelId;
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

          {/* System Prompt / Instructions */}
          <div className="agent-modal-field">
            <div className="agent-modal-label-row">
              <label className="agent-modal-label" htmlFor="agent-prompt-input">
                Agent Prompt / Instructions
              </label>
              <span className="agent-modal-hint">Rules & execution directives</span>
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
