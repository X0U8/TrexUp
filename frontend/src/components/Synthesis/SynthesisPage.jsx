import { useState } from 'react';
import './SynthesisPage.css';

const OPTIONS = [
  { id: 'findings', label: 'Findings' },
  { id: 'artifacts', label: 'Artifacts' },
  { id: 'reports', label: 'Reports' },
];

export default function SynthesisPage() {
  const [activeTab, setActiveTab] = useState('findings');

  return (
    <div className="synthesis-container">
      <div className="synthesis-header-bar">
        <div className="synthesis-options-tabs" role="tablist" aria-label="Synthesis options">
          {OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={activeTab === opt.id}
              className={`synthesis-tab-btn ${activeTab === opt.id ? 'active' : ''}`}
              onClick={() => setActiveTab(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Completely blank content area for now */}
      <div className="synthesis-blank-body" />
    </div>
  );
}
