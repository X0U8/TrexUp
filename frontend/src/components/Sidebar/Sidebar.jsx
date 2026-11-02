import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './Sidebar.css';

export default function Sidebar({
  onGoToProjects,
  onOpenDocuments,
  docCount = 0,
  currentView = 'canvas',
  explorations = ['exploration_01'],
  currentExploration = 'exploration_01',
  onSelectExploration,
  onCreateExploration,
  workflows = ['extraction'],
  currentWorkflow = 'extraction',
  onSelectWorkflow,
  onCreateWorkflow,
  engines = ['file_detection'],
  currentEngine = 'file_detection',
  onSelectEngine,
  onCreateEngine,
  onOpenEngines,
  onOpenTools,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExplorationOpen, setIsExplorationOpen] = useState(true);
  const [isWorkflowOpen, setIsWorkflowOpen] = useState(true);
  const [isEnginesOpen, setIsEnginesOpen] = useState(true);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* Top-Left Hamburger Icon */}
      <button
        type="button"
        className="hamburger-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Toggle menu drawer"
        title="Menu"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>

      {/* Dimmed Backdrop & Slide-out Drawer Panel portaled to document.body */}
      {typeof document !== 'undefined' && createPortal(
        <>
          <div
            className={`drawer-backdrop ${isOpen ? 'open' : ''}`}
            onClick={() => setIsOpen(false)}
            aria-hidden={!isOpen}
          />

      {/* Slide-out Drawer Panel */}
      <aside
        className={`drawer-panel ${isOpen ? 'open' : ''}`}
        aria-label="Navigation drawer"
      >
        <div className="drawer-header">
          <span className="drawer-title">Menu</span>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <nav className="drawer-content">
          {/* Exploration Section (Expandable with + and chevron) */}
          <div className="drawer-nav-group">
            <div
              className={`drawer-item exploration-row ${isExplorationOpen ? 'expanded' : ''} ${currentView === 'canvas' ? 'active' : ''}`}
              onClick={() => setIsExplorationOpen((prev) => !prev)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="6" cy="6" r="3" />
                <circle cx="18" cy="18" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M9 6h6a3 3 0 0 1 3 3v6" />
                <line x1="6" y1="9" x2="6" y2="15" />
              </svg>
              <span className="drawer-item-title">Exploration</span>

              {/* Right side: Plus icon and Chevron down icon */}
              <div className="exploration-controls" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="exploration-icon-btn"
                  title="Create new exploration"
                  aria-label="New exploration"
                  onClick={() => {
                    onCreateExploration?.();
                    setIsExplorationOpen(true);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>

                <button
                  type="button"
                  className={`exploration-icon-btn chevron ${isExplorationOpen ? 'rotated' : ''}`}
                  title={isExplorationOpen ? 'Collapse explorations' : 'Expand explorations'}
                  aria-label="Toggle explorations list"
                  onClick={() => setIsExplorationOpen((prev) => !prev)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Sublist of all explorations */}
            {isExplorationOpen && (
              <div className="exploration-sublist">
                {explorations.map((exp) => {
                  const isActive = currentView === 'canvas' && exp === currentExploration;
                  return (
                    <button
                      key={exp}
                      type="button"
                      className={`exploration-subitem ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        onSelectExploration?.(exp);
                        setIsOpen(false);
                      }}
                      title={exp}
                    >
                      <span className="exploration-subdot" />
                      <span className="exploration-subname">{exp}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Workflow Section (Expandable with + and chevron) */}
          <div className="drawer-nav-group">
            <div
              className={`drawer-item exploration-row ${isWorkflowOpen ? 'expanded' : ''} ${currentView === 'workflow' ? 'active' : ''}`}
              onClick={() => setIsWorkflowOpen((prev) => !prev)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                <path d="M10 6.5h4" />
                <path d="M6.5 10v7.5a1 1 0 0 0 1 1H14" />
              </svg>
              <span className="drawer-item-title">Workflow</span>

              {/* Right side: Plus icon and Chevron down icon */}
              <div className="exploration-controls" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="exploration-icon-btn"
                  title="Create new workflow"
                  aria-label="New workflow"
                  onClick={() => {
                    onCreateWorkflow?.();
                    setIsWorkflowOpen(true);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>

                <button
                  type="button"
                  className={`exploration-icon-btn chevron ${isWorkflowOpen ? 'rotated' : ''}`}
                  title={isWorkflowOpen ? 'Collapse workflows' : 'Expand workflows'}
                  aria-label="Toggle workflows list"
                  onClick={() => setIsWorkflowOpen((prev) => !prev)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Sublist of all workflows */}
            {isWorkflowOpen && (
              <div className="exploration-sublist">
                {workflows.map((wf) => {
                  const isActive = currentView === 'workflow' && wf === currentWorkflow;
                  return (
                    <button
                      key={wf}
                      type="button"
                      className={`exploration-subitem ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        onSelectWorkflow?.(wf);
                        setIsOpen(false);
                      }}
                      title={wf}
                    >
                      <span className="exploration-subdot" />
                      <span className="exploration-subname">{wf}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Engines Section (Expandable with + and chevron) */}
          <div className="drawer-nav-group">
            <div
              className={`drawer-item exploration-row ${isEnginesOpen ? 'expanded' : ''} ${currentView === 'engines' ? 'active' : ''}`}
              onClick={() => setIsEnginesOpen((prev) => !prev)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <rect x="9" y="9" width="6" height="6" />
                <line x1="9" y1="1" x2="9" y2="4" />
                <line x1="15" y1="1" x2="15" y2="4" />
                <line x1="9" y1="20" x2="9" y2="23" />
                <line x1="15" y1="20" x2="15" y2="23" />
                <line x1="20" y1="9" x2="23" y2="9" />
                <line x1="20" y1="14" x2="23" y2="14" />
                <line x1="1" y1="9" x2="4" y2="9" />
                <line x1="1" y1="14" x2="4" y2="14" />
              </svg>
              <span className="drawer-item-title">Engines</span>

              {/* Right side: Plus icon and Chevron down icon side by side */}
              <div className="exploration-controls" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="exploration-icon-btn"
                  title="Create new engine"
                  aria-label="New engine"
                  onClick={() => {
                    onCreateEngine?.();
                    setIsEnginesOpen(true);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>

                <button
                  type="button"
                  className={`exploration-icon-btn chevron ${isEnginesOpen ? 'rotated' : ''}`}
                  title={isEnginesOpen ? 'Collapse engines' : 'Expand engines'}
                  aria-label="Toggle engines list"
                  onClick={() => setIsEnginesOpen((prev) => !prev)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Sublist of all engines */}
            {isEnginesOpen && (
              <div className="exploration-sublist">
                {engines.map((eng) => {
                  const isActive = currentView === 'engines' && eng === currentEngine;
                  return (
                    <button
                      key={eng}
                      type="button"
                      className={`exploration-subitem ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        onSelectEngine?.(eng);
                        setIsOpen(false);
                      }}
                      title={eng}
                    >
                      <span className="exploration-subdot" />
                      <span className="exploration-subname">{eng}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Experiments */}
          <div className="drawer-nav-group">
            <button type="button" className="drawer-item expandable">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 2v7.5L4.5 19.5A2 2 0 0 0 6.2 22h11.6a2 2 0 0 0 1.7-2.5L14 9.5V2" />
                <path d="M8.5 2h7" />
                <path d="M7 16h10" />
              </svg>
              <span className="drawer-item-title">Experiments</span>
              <svg className="item-chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          {/* Knowledge Graph */}
          <div className="drawer-nav-group">
            <button type="button" className="drawer-item expandable">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="2.5" />
                <circle cx="4" cy="6" r="2" />
                <circle cx="20" cy="6" r="2" />
                <circle cx="5" cy="18" r="2" />
                <circle cx="19" cy="18" r="2" />
                <line x1="5.7" y1="7.4" x2="10" y2="10.5" />
                <line x1="18.3" y1="7.4" x2="14" y2="10.5" />
                <line x1="6.8" y1="16.8" x2="10" y2="13.5" />
                <line x1="17.2" y1="16.8" x2="14" y2="13.5" />
              </svg>
              <span className="drawer-item-title">Knowledge Graph</span>
              <svg className="item-chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          {/* Documents */}
          <div className="drawer-nav-group">
            <button
              type="button"
              className={`drawer-item ${currentView === 'documents' ? 'active' : ''}`}
              onClick={() => {
                setIsOpen(false);
                onOpenDocuments?.();
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span className="drawer-item-title">Documents</span>
              <span className="drawer-item-digit">{docCount}</span>
            </button>
          </div>

          {/* Findings */}
          <div className="drawer-nav-group">
            <button type="button" className="drawer-item expandable">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <polyline points="9 12 11.5 14.5 15.5 9.5" />
              </svg>
              <span className="drawer-item-title">Findings</span>
              <svg className="item-chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          {/* Artifacts */}
          <div className="drawer-nav-group">
            <button type="button" className="drawer-item expandable">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              <span className="drawer-item-title">Artifacts</span>
              <svg className="item-chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          {/* Reports */}
          <div className="drawer-nav-group">
            <button type="button" className="drawer-item expandable">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <line x1="9" y1="7" x2="15" y2="7" />
                <line x1="9" y1="11" x2="15" y2="11" />
              </svg>
              <span className="drawer-item-title">Reports</span>
              <svg className="item-chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          {/* Tools (Reference / Documentation at bottom) */}
          <div className="drawer-nav-group">
            <button
              type="button"
              className={`drawer-item ${currentView === 'tools' ? 'active' : ''}`}
              onClick={() => {
                setIsOpen(false);
                onOpenTools?.();
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              <span className="drawer-item-title">Tools</span>
            </button>
          </div>
        </nav>
      </aside>
        </>,
        document.body
      )}
    </>
  );
}
