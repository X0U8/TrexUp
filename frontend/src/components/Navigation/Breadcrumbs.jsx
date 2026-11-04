import './Breadcrumbs.css';

export default function Breadcrumbs({
  projectName = 'Project',
  currentView = 'canvas',
  explorationName = 'exploration_01',
  workflowName = 'extraction',
  engineName = 'file_detection',
  onGoToProjects,
}) {
  return (
    <nav className="top-breadcrumbs-nav" aria-label="Breadcrumb navigation">
      <button
        type="button"
        className="crumb-btn"
        onClick={onGoToProjects}
        title="Back to All Projects"
      >
        Projects
      </button>

      <span className="crumb-slash" aria-hidden="true">
        /
      </span>

      <span className="crumb-name" title={projectName}>
        {projectName}
      </span>

      <span className="crumb-slash" aria-hidden="true">
        /
      </span>

      {currentView === 'documents' ? (
        <span className="crumb-active">Documents</span>
      ) : currentView === 'tools' ? (
        <span className="crumb-active">Tools</span>
      ) : currentView === 'logs' ? (
        <span className="crumb-active">Logs</span>
      ) : currentView === 'engines' ? (
        <>
          <span className="crumb-sub">engine</span>
          <span className="crumb-slash" aria-hidden="true">
            /
          </span>
          <span className="crumb-active">{engineName}</span>
        </>
      ) : currentView === 'workflow' ? (
        <>
          <span className="crumb-sub">workflow</span>
          <span className="crumb-slash" aria-hidden="true">
            /
          </span>
          <span className="crumb-active">{workflowName}</span>
        </>
      ) : (
        <>
          <span className="crumb-sub">exploration</span>
          <span className="crumb-slash" aria-hidden="true">
            /
          </span>
          <span className="crumb-active">{explorationName}</span>
        </>
      )}
    </nav>
  );
}
