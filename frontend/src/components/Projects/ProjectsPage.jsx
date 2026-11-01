import { useState, useEffect } from 'react';
import './ProjectsPage.css';
import NewProjectModal from './NewProjectModal';
import { getAllProjects, saveProject } from '../../utils/db';

function formatTimeAgo(dateString) {
  if (!dateString) return 'just now';
  const now = Date.now();
  const past = new Date(dateString).getTime();
  const diffSec = Math.max(0, Math.floor((now - past) / 1000));

  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export default function ProjectsPage({ onSelectProject }) {
  const [projects, setProjects] = useState([]);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  const loadProjects = async () => {
    try {
      const list = await getAllProjects();
      setProjects(list);
    } catch (err) {
      console.error('Failed to load projects from IndexedDB:', err);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreated = (newProject) => {
    setProjects((prev) => [newProject, ...prev]);
    onSelectProject?.(newProject);
  };

  const handleTogglePin = async (e, project) => {
    e.stopPropagation();
    const updated = {
      ...project,
      pinned: !project.pinned,
    };
    try {
      await saveProject(updated);
      setProjects((prev) =>
        prev.map((p) => (p.id === project.id ? updated : p))
      );
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  const sortedProjects = [...projects].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
  });

  const filteredProjects = sortedProjects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="projects-page">
      {/* Top Header */}
      <header className="projects-header">
        <h1 className="projects-title">Projects</h1>

        <div className="projects-header-actions">
          {/* Search Toggle / Input */}
          {isSearchActive ? (
            <input
              type="text"
              className="form-input"
              style={{ width: '180px', padding: '4px 8px', fontSize: '13px' }}
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              onBlur={() => !searchQuery && setIsSearchActive(false)}
            />
          ) : (
            <button
              type="button"
              className="icon-btn"
              title="Search projects"
              aria-label="Search"
              onClick={() => setIsSearchActive(true)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          )}

          {/* Sort / Reorder Icon */}
          <button
            type="button"
            className="icon-btn"
            title="Sort projects"
            aria-label="Sort"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="7 9 7 3 4 6" />
              <polyline points="17 15 17 21 20 18" />
              <line x1="7" y1="3" x2="7" y2="21" />
              <line x1="17" y1="3" x2="17" y2="21" />
            </svg>
          </button>

          {/* New Project Header Button */}
          <button
            type="button"
            className="btn-new-project-header"
            onClick={() => setIsNewModalOpen(true)}
          >
            New project
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {projects.length > 0 ? (
        <main className="projects-content">
          <div className="projects-grid">
            {filteredProjects.map((p) => (
              <div
                key={p.id}
                className="project-card"
                onClick={() => onSelectProject?.(p)}
                title={p.name}
              >
                {/* Left Stack Icon Container */}
                <div className="project-card-icon-box" aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 6c0 1.657 3.582 3 8 3s8-1.343 8-3-3.582-3-8-3-8 1.343-8 3z" />
                    <path d="M4 6v6c0 1.657 3.582 3 8 3s8-1.343 8-3V6" />
                    <path d="M4 12v6c0 1.657 3.582 3 8 3s8-1.343 8-3v-6" />
                  </svg>
                </div>

                {/* Middle Project Details */}
                <div className="project-card-info">
                  <span className="project-card-name">{p.name}</span>
                  <span className="project-card-time">
                    {formatTimeAgo(p.updatedAt || p.createdAt)}
                  </span>
                </div>

                {/* Right Pin Icon */}
                <button
                  type="button"
                  className={`project-pin-btn ${p.pinned ? 'pinned' : ''}`}
                  onClick={(e) => handleTogglePin(e, p)}
                  title={p.pinned ? 'Unpin project' : 'Pin project'}
                  aria-label="Pin"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </main>
      ) : (
        <main className="projects-center">
          {/* Line-art Illustration (Blocks with Hand matching reference exactly) */}
          <div className="empty-state-icon" aria-hidden="true">
            <svg
              viewBox="0 0 100 100"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* 4 Square Tiles */}
              <rect x="28" y="16" width="18" height="18" rx="3.5" />
              <rect x="50" y="16" width="18" height="18" rx="3.5" />
              <rect x="28" y="40" width="18" height="18" rx="3.5" />
              <rect x="52" y="37" width="18" height="18" rx="3.5" />

              {/* Exact Hand Icon from Reference */}
              <path d="M 52 74 V 57 a 2.5 2.5 0 0 1 5 0 v 10 M 57 67 V 59 a 2.5 2.5 0 0 1 5 0 v 9 M 62 68 V 61 a 2.5 2.5 0 0 1 5 0 v 8 M 67 69 V 64 a 2.5 2.5 0 0 1 5 0 v 8 c 0 9 -6 16 -14 16 c -7 0 -13 -4 -16 -10 l -6 -6 a 3 3 0 0 1 4.5 -4 l 6.5 5.5 L 52 74" />
            </svg>
          </div>

          <h2 className="empty-state-heading">Looking to start a project?</h2>
          <p className="empty-state-desc">
            Upload materials, set custom instructions, and organize conversations in one space.
          </p>

          <button
            type="button"
            className="btn-new-project-center"
            onClick={() => setIsNewModalOpen(true)}
          >
            New project
          </button>
        </main>
      )}

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
