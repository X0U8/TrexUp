import { useState } from 'react';
import './ModelsPanel.css';

const AVAILABLE_MODELS = [
  {
    id: 'muse-wonder',
    name: 'Muse Wonder',
    tag: '1M',
    desc: 'Frontier coding, long-running agents, and advanced computer use. Plans long tasks, delegates to sub-agents, and recovers from errors.',
    inputs: ['text', 'code', 'image'],
    outputs: ['text', 'code', 'tool'],
    inPrice: 'In: $4.00 ($0.20 cache)',
    outPrice: 'Out: $20.00',
  },
  {
    id: 'muse-spark-1.3',
    name: 'Muse Spark 1.3',
    tag: '1M',
    desc: 'Built for long-horizon coding and multi-step agentic work. Native tool calling and MCP support.',
    inputs: ['text', 'code', 'tool'],
    outputs: ['text', 'code', 'tool'],
    inPrice: 'In: $1.25 ($0.15 cache)',
    outPrice: 'Out: $4.25',
  },
  {
    id: 'muse-spark-1.3-contributor',
    name: 'Muse Spark 1.3 Contributor',
    tag: '1M · -95%',
    desc: 'Same model and capabilities as 1.3 at up to 95% less cost. Data used for model training.',
    inputs: ['text', 'code'],
    outputs: ['text', 'code'],
    inPrice: 'In: $0.10 ($0.002 cache)',
    outPrice: 'Out: $0.20',
  },
  {
    id: 'sam-3.1',
    name: 'SAM 3.1',
    tag: 'Segment',
    desc: 'Detect, segment, and track objects from text prompt across image and video.',
    inputs: ['text', 'image', 'video'],
    outputs: ['image', 'video'],
    inPrice: 'In: $2.50 / 1k img',
    outPrice: 'Out: $0.20 / 1k fr',
  },
  {
    id: 'muse-voice-transcribe',
    name: 'Muse Voice Transcribe',
    tag: 'Audio',
    desc: 'Transcribing speech to text, tells speakers apart, and detects voice activity.',
    inputs: ['audio'],
    outputs: ['text'],
    inPrice: 'In: —',
    outPrice: 'Out: $0.18 / hr',
  },
  {
    id: 'muse-image-1.0',
    name: 'Muse Image 1.0',
    tag: 'Image',
    desc: 'Agentic image generation and editing. Text-to-image, image-to-image, and reference-based.',
    inputs: ['text', 'image'],
    outputs: ['image'],
    inPrice: 'In: —',
    outPrice: 'Out: $0.01 / img',
  },
  {
    id: 'muse-spark-1.2',
    name: 'Muse Spark 1.2',
    tag: '1M',
    desc: 'Coding-optimized model for agentic workflows, debugging, and codebase understanding.',
    inputs: ['text', 'code'],
    outputs: ['code', 'text'],
    inPrice: 'In: $1.25 ($0.15 cache)',
    outPrice: 'Out: $4.25',
  },
  {
    id: 'muse-spark-1.2-contributor',
    name: 'Muse Spark 1.2 Contributor',
    tag: '1M · -95%',
    desc: 'Coding-optimized model with pricing designed for builders.',
    inputs: ['text', 'code'],
    outputs: ['code', 'text'],
    inPrice: 'In: $0.10 ($0.002 cache)',
    outPrice: 'Out: $0.20',
  },
  {
    id: 'muse-spark-1.1',
    name: 'Muse Spark 1.1',
    tag: '1M',
    desc: 'Built for agentic workflows, coding, and multimodal perception across text, image, video, docs.',
    inputs: ['text', 'code', 'image', 'video'],
    outputs: ['text', 'code'],
    inPrice: 'In: $1.25 ($0.15 cache)',
    outPrice: 'Out: $4.25',
  },
];

function renderModalityIcon(type) {
  switch (type) {
    case 'text':
      return (
        <svg key={type} className="mod-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" title="Text">
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      );
    case 'code':
      return (
        <svg key={type} className="mod-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" title="Code">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
    case 'image':
      return (
        <svg key={type} className="mod-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" title="Image">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    case 'video':
      return (
        <svg key={type} className="mod-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" title="Video">
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" />
        </svg>
      );
    case 'audio':
      return (
        <svg key={type} className="mod-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" title="Audio">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      );
    case 'tool':
      return (
        <svg key={type} className="mod-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" title="Tools / Actions">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function ModelsPanel({ onAddModelAgent }) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <div className={`models-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="models-panel-header" onClick={() => setIsCollapsed((prev) => !prev)}>
        <div className="models-header-title-row">
          <span className="models-header-title">Models</span>
        </div>
        <button
          type="button"
          className="models-collapse-btn"
          aria-label={isCollapsed ? 'Expand models' : 'Collapse models'}
        >
          <svg
            className={`models-chevron ${isCollapsed ? 'collapsed' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {!isCollapsed && (
        <div className="models-list">
          {AVAILABLE_MODELS.map((model) => (
            <div
              key={model.id}
              className="model-item-row"
              draggable="true"
              onDragStart={(e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({ type: 'workflow-model', model }));
              }}
              title="Drag onto canvas or click + to add agent"
            >
              <div className="model-top-row">
                <div className="model-name-wrap">
                  <span className="model-name">{model.name}</span>
                  <span className="model-tag">{model.tag}</span>
                </div>
                <button
                  type="button"
                  className="model-add-btn"
                  title={`Add ${model.name} agent to workflow`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddModelAgent?.(model);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>

              <p className="model-desc">{model.desc}</p>

              {/* Modality Icons row: [Inputs] → [Outputs] */}
              <div className="model-io-row">
                <div className="mod-icons-group">
                  {model.inputs.map((t) => renderModalityIcon(t))}
                </div>

                <span className="mod-arrow">→</span>

                <div className="mod-icons-group">
                  {model.outputs.map((t) => renderModalityIcon(t))}
                </div>
              </div>

              {/* Compact Pricing Row */}
              <div className="model-price-row">
                <span>{model.inPrice}</span>
                <span className="price-dot">•</span>
                <span>{model.outPrice}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
