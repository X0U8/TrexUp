import './ProjectLoadingScreen.css';

export default function ProjectLoadingScreen({ projectName }) {
  return (
    <div className="project-loading-screen" role="status" aria-live="polite">
      <div className="project-loading-card">
        <div className="project-loading-spinner" aria-hidden="true">
          <div className="project-loading-ring" />
          <div className="project-loading-glow" />
        </div>
        <div className="project-loading-content">
          <h2 className="project-loading-title">
            {projectName ? `Opening "${projectName}"` : 'Loading project...'}
          </h2>
          <p className="project-loading-subtitle">
            Preparing explorations & canvas data
          </p>
        </div>
      </div>
    </div>
  );
}
