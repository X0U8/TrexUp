import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getEngineDisplayName } from '../../utils/engineUtils';
import './Sidebar.css';

export default function Sidebar({
  onGoToProjects,
  onOpenDocuments,
  docCount = 0,
  currentView = 'canvas',
  explorations = ['exploration_01'],
  explorationsData = {},
  currentExploration = 'exploration_01',
  onSelectExploration,
  onCreateExploration,
  onRenameExploration,
  workflows = ['extraction'],
  workflowsData = {},
  currentWorkflow = 'extraction',
  onSelectWorkflow,
  onCreateWorkflow,
  onRenameWorkflow,
  experiments = ['experiment_01'],
  experimentsData = {},
  currentExperiment = 'experiment_01',
  onSelectExperiment,
  onCreateExperiment,
  onRenameExperiment,
  engines = ['file_detection', 'document_extractor'],
  enginesData = {},
  currentEngine = 'file_detection',
  onSelectEngine,
  onCreateEngine,
  onOpenEngines,
  onOpenTools,
  onOpenLogs,
  isWorkflowRunning = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExplorationOpen, setIsExplorationOpen] = useState(true);
  const [isWorkflowOpen, setIsWorkflowOpen] = useState(true);
  const [isExperimentOpen, setIsExperimentOpen] = useState(true);
  const [isEnginesOpen, setIsEnginesOpen] = useState(true);
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');

  const handleStartRename = (type, uid, initialName) => {
    setEditingKey(`${type}:${uid}`);
    setEditValue(initialName || uid);
  };

  const handleSaveRename = (type, uid) => {
    const sanitized = editValue.replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
    if (sanitized) {
      if (type === 'exp') {
        onRenameExploration?.(uid, sanitized);
      } else if (type === 'wf') {
        onRenameWorkflow?.(uid, sanitized);
      } else if (type === 'experiment') {
        onRenameExperiment?.(uid, sanitized);
      }
    }
    setEditingKey(null);
    setEditValue('');
  };

  const handleCancelRename = () => {
    setEditingKey(null);
    setEditValue('');
  };

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
          {/* Documents (Top level resource input) */}
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
                  const displayName = explorationsData?.[exp]?.name || exp;
                  const isEditing = editingKey === `exp:${exp}`;

                  return (
                    <div key={exp} className="exploration-subitem-wrap">
                      {isEditing ? (
                        <div className="subitem-rename-box" onClick={(e) => e.stopPropagation()}>
                          <span className="exploration-subdot" />
                          <input
                            type="text"
                            className="subitem-rename-input"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value.replace(/[^a-zA-Z0-9_\- ]/g, ''))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename('exp', exp);
                              if (e.key === 'Escape') handleCancelRename();
                            }}
                            onBlur={() => handleSaveRename('exp', exp)}
                            autoFocus
                            maxLength={35}
                            placeholder="Exploration name"
                          />
                        </div>
                      ) : (
                        <div
                          className={`exploration-subitem ${isActive ? 'active' : ''}`}
                          onClick={() => {
                            onSelectExploration?.(exp);
                            setIsOpen(false);
                          }}
                          title={`${displayName} (${exp})`}
                        >
                          <span className="exploration-subdot" />
                          <span className="exploration-subname">{displayName}</span>
                          <button
                            type="button"
                            className="subitem-edit-icon-btn"
                            title="Rename exploration"
                            aria-label="Rename exploration"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartRename('exp', exp, displayName);
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
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
                  const rawName = workflowsData?.[wf]?.name;
                  const displayName =
                    rawName === 'Document & Media Extraction Pipeline'
                      ? 'extraction'
                      : rawName === 'Canvas Relationship Synthesis Pipeline'
                      ? 'connection_synthesis'
                      : rawName || wf;
                  const isEditing = editingKey === `wf:${wf}`;

                  return (
                    <div key={wf} className="exploration-subitem-wrap">
                      {isEditing ? (
                        <div className="subitem-rename-box" onClick={(e) => e.stopPropagation()}>
                          <span className="exploration-subdot" />
                          <input
                            type="text"
                            className="subitem-rename-input"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value.replace(/[^a-zA-Z0-9_\- ]/g, ''))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename('wf', wf);
                              if (e.key === 'Escape') handleCancelRename();
                            }}
                            onBlur={() => handleSaveRename('wf', wf)}
                            autoFocus
                            maxLength={35}
                            placeholder="Workflow name"
                          />
                        </div>
                      ) : (
                        <div
                          className={`exploration-subitem ${isActive ? 'active' : ''}`}
                          onClick={() => {
                            onSelectWorkflow?.(wf);
                            setIsOpen(false);
                          }}
                          title={`${displayName} (${wf})`}
                        >
                          <span className="exploration-subdot" />
                          <span className="exploration-subname">{displayName}</span>
                          <button
                            type="button"
                            className="subitem-edit-icon-btn"
                            title="Rename workflow"
                            aria-label="Rename workflow"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartRename('wf', wf, displayName);
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
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
                  const displayName = getEngineDisplayName(eng, enginesData);
                  return (
                    <button
                      key={eng}
                      type="button"
                      className={`exploration-subitem ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        onSelectEngine?.(eng);
                        setIsOpen(false);
                      }}
                      title={`${displayName} (${eng})`}
                    >
                      <span className="exploration-subdot" />
                      <span className="exploration-subname">{displayName}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Experiments Section (Expandable with + and chevron) */}
          <div className="drawer-nav-group">
            <div
              className={`drawer-item exploration-row ${isExperimentOpen ? 'expanded' : ''} ${currentView === 'experiment' ? 'active' : ''}`}
              onClick={() => setIsExperimentOpen((prev) => !prev)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 2v7.5L4.5 19.5A2 2 0 0 0 6.2 22h11.6a2 2 0 0 0 1.7-2.5L14 9.5V2" />
                <path d="M8.5 2h7" />
                <path d="M7 16h10" />
              </svg>
              <span className="drawer-item-title">Experiment</span>

              <div className="exploration-controls" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="exploration-icon-btn"
                  title="Create new experiment"
                  aria-label="New experiment"
                  onClick={() => {
                    onCreateExperiment?.();
                    setIsExperimentOpen(true);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>

                <button
                  type="button"
                  className={`exploration-icon-btn chevron ${isExperimentOpen ? 'rotated' : ''}`}
                  title={isExperimentOpen ? 'Collapse experiments' : 'Expand experiments'}
                  aria-label="Toggle experiments list"
                  onClick={() => setIsExperimentOpen((prev) => !prev)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
            </div>

            {isExperimentOpen && (
              <div className="exploration-sublist">
                {experiments.map((expId) => {
                  const isActive = currentView === 'experiment' && expId === currentExperiment;
                  const displayName = experimentsData?.[expId]?.name || expId;
                  const isEditing = editingKey === `experiment:${expId}`;

                  return (
                    <div key={expId} className="exploration-subitem-wrap">
                      {isEditing ? (
                        <div className="subitem-rename-box" onClick={(e) => e.stopPropagation()}>
                          <span className="exploration-subdot" />
                          <input
                            type="text"
                            className="subitem-rename-input"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value.replace(/[^a-zA-Z0-9_\- ]/g, ''))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename('experiment', expId);
                              if (e.key === 'Escape') handleCancelRename();
                            }}
                            onBlur={() => handleSaveRename('experiment', expId)}
                            autoFocus
                            maxLength={35}
                            placeholder="Experiment name"
                          />
                        </div>
                      ) : (
                        <div
                          className={`exploration-subitem ${isActive ? 'active' : ''}`}
                          onClick={() => {
                            onSelectExperiment?.(expId);
                            setIsOpen(false);
                          }}
                          title={`${displayName} (${expId})`}
                        >
                          <span className="exploration-subdot" />
                          <span className="exploration-subname">{displayName}</span>
                          <button
                            type="button"
                            className="subitem-edit-icon-btn"
                            title="Rename experiment"
                            aria-label="Rename experiment"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartRename('experiment', expId, displayName);
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Logs */}
          <div className="drawer-nav-group">
            <button
              type="button"
              className={`drawer-item ${currentView === 'logs' ? 'active' : ''}`}
              onClick={() => {
                setIsOpen(false);
                onOpenLogs?.();
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span className="drawer-item-title">Logs</span>
              {isWorkflowRunning && (
                <svg className="sidebar-running-spinner" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#cbd5e1" strokeWidth="2.5" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              )}
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
