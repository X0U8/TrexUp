import { useState } from 'react';
import './ExperimentPage.css';

export default function ExperimentPage({
  experimentId = 'experiment_01',
  experimentData = {},
}) {
  const [activeTab, setActiveTab] = useState('findings'); // 'findings' | 'artifacts' | 'report'
  const [isDrawerCollapsed, setIsDrawerCollapsed] = useState(false);

  const planSteps = Array.isArray(experimentData?.plan) ? experimentData.plan : [];
  const findings = Array.isArray(experimentData?.findings) ? experimentData.findings : [];
  const artifacts = Array.isArray(experimentData?.artifacts) ? experimentData.artifacts : [];
  const report = typeof experimentData?.report === 'string' ? experimentData.report.trim() : '';

  return (
    <div className="experiment-page-container">
      {/* Left Column: Plan Flowchart (Top-to-Bottom) */}
      <aside className="experiment-plan-panel" aria-label="Experiment Plan">
        <div className="plan-panel-header">
          <div className="plan-header-title">
            <span>Plan</span>
          </div>
          {planSteps.length > 0 && (
            <span className="plan-step-count">{planSteps.length} steps</span>
          )}
        </div>

        <div className="plan-flow-content">
          {planSteps.length === 0 ? (
            <div className="plan-empty-state">
              <svg className="plan-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
                <path d="M9 21V9" />
              </svg>
              <p className="plan-empty-title">No plan formulated yet</p>
              <p className="plan-empty-desc">
                When the AI starts an experiment, the tentative step-by-step flowchart will appear here.
              </p>
            </div>
          ) : (
            <div className="flowchart-list">
              {planSteps.map((step, idx) => {
                const stepNum = step.step_number || idx + 1;
                const status = step.status || 'pending';
                const hasNext = idx < planSteps.length - 1;

                return (
                  <div key={step.id || `step-${stepNum}`} className="flowchart-step-wrap">
                    {hasNext && <div className="flowchart-connector" />}
                    <div className={`flowchart-step-card ${status}`}>
                      <div className="flowchart-step-badge">
                        {status === 'completed' ? '✓' : stepNum}
                      </div>
                      <div className="flowchart-step-info">
                        <span className="flowchart-step-title">{step.title || `Step ${stepNum}`}</span>
                        {step.description && (
                          <span className="flowchart-step-desc">{step.description}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Middle Column: Interactive Canvas */}
      <main className="experiment-canvas-container" aria-label="Experiment Canvas">
        <div className="experiment-canvas-empty">
          <svg className="canvas-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2v7.31L4.14 18.1A2 2 0 0 0 5.86 21h12.28a2 2 0 0 0 1.72-2.9L14 9.31V2" />
            <path d="M8.5 2h7" />
            <path d="M7 16h10" />
          </svg>
          <p className="canvas-empty-title">Experiment canvas ready</p>
          <p className="canvas-empty-desc">
            When an experiment executes, theories, agents, workflows, and web research will run here live.
          </p>
        </div>
      </main>

      {/* Right Column: Evidence & Synthesis Drawer */}
      <aside className={`experiment-drawer ${isDrawerCollapsed ? 'collapsed' : ''}`} aria-label="Evidence and Synthesis">
        <div className="drawer-header-bar">
          {!isDrawerCollapsed && (
            <div className="drawer-tabs-nav" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'findings'}
                className={`drawer-tab-btn ${activeTab === 'findings' ? 'active' : ''}`}
                onClick={() => setActiveTab('findings')}
              >
                <span>Findings</span>
                {findings.length > 0 && <span className="tab-badge">{findings.length}</span>}
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'artifacts'}
                className={`drawer-tab-btn ${activeTab === 'artifacts' ? 'active' : ''}`}
                onClick={() => setActiveTab('artifacts')}
              >
                <span>Artifacts</span>
                {artifacts.length > 0 && <span className="tab-badge">{artifacts.length}</span>}
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'report'}
                className={`drawer-tab-btn ${activeTab === 'report' ? 'active' : ''}`}
                onClick={() => setActiveTab('report')}
              >
                <span>Report</span>
                {Boolean(report) && <span className="tab-badge">1</span>}
              </button>
            </div>
          )}

          <button
            type="button"
            className={`drawer-toggle-btn ${isDrawerCollapsed ? 'collapsed' : ''}`}
            title={isDrawerCollapsed ? 'Expand drawer' : 'Collapse drawer'}
            aria-label={isDrawerCollapsed ? 'Expand drawer' : 'Collapse drawer'}
            onClick={() => setIsDrawerCollapsed((prev) => !prev)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {!isDrawerCollapsed && (
          <div className="drawer-content-body">
            {activeTab === 'findings' && (
              findings.length === 0 ? (
                <div className="drawer-empty-state">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>No findings recorded yet. Real discoveries with proofs will be logged here.</span>
                </div>
              ) : (
                <div className="findings-list">
                  {findings.map((f, i) => (
                    <div key={f.id || `find-${i}`} className="finding-item-card">
                      <span className="finding-title">{f.title || f.name || `Finding ${i + 1}`}</span>
                      {f.proof && <span className="finding-proof">{f.proof}</span>}
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === 'artifacts' && (
              artifacts.length === 0 ? (
                <div className="drawer-empty-state">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                  </svg>
                  <span>No artifacts generated yet. Research papers and experimental proof datasets will appear here.</span>
                </div>
              ) : (
                <div className="artifacts-list">
                  {artifacts.map((art, i) => (
                    <div key={art.id || `art-${i}`} className="artifact-item-card">
                      <div className="artifact-title-row">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span>{art.name || art.title || `Artifact ${i + 1}`}</span>
                      </div>
                      {art.type && <span className="artifact-type-tag">{art.type}</span>}
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === 'report' && (
              !report ? (
                <div className="drawer-empty-state">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <span>No report generated yet. The final proof-backed report will be compiled here.</span>
                </div>
              ) : (
                <div className="report-content-card">
                  {report}
                </div>
              )
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
