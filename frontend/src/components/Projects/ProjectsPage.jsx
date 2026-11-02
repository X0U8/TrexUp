import { useState, useEffect } from 'react';
import './ProjectsPage.css';
import NewProjectModal from './NewProjectModal';
import { getProjectsMetadata, updateProjectMeta } from '../../utils/db';

function formatCreationDate(dateString) {
  if (!dateString) return 'Created recently';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Created recently';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isToday) {
    const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
    if (diffSec < 60) return 'Created just now';
    return `Created today, ${timeStr}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Created yesterday, ${timeStr}`;
  }

  const isCurrentYear = date.getFullYear() === now.getFullYear();
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: isCurrentYear ? undefined : 'numeric',
  });

  return `Created ${dateStr}`;
}

export default function ProjectsPage({ onSelectProject }) {
  const [projects, setProjects] = useState([]);
  const [loadingProjectId, setLoadingProjectId] = useState(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  const loadProjects = async () => {
    try {
      // Lightweight fetch: metadata only, never loads bulky node trees into memory
      const list = await getProjectsMetadata();
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

  const handleSelectCard = async (project) => {
    if (loadingProjectId) return;
    setLoadingProjectId(project.id);
    try {
      await onSelectProject?.(project);
    } catch (err) {
      console.error('Failed to select project:', err);
      setLoadingProjectId(null);
    }
  };

  const handleTogglePin = async (e, project) => {
    e.stopPropagation();
    const nextPinned = !project.pinned;
    try {
      await updateProjectMeta(project.id, { pinned: nextPinned });
      setProjects((prev) =>
        prev.map((p) => (p.id === project.id ? { ...p, pinned: nextPinned } : p))
      );
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  const sortedProjects = [...projects].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    const timeA = new Date(a.createdAt || a.updatedAt || 0).getTime();
    const timeB = new Date(b.createdAt || b.updatedAt || 0).getTime();
    return timeB - timeA;
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
                className={`project-card ${loadingProjectId === p.id ? 'is-loading' : ''}`}
                onClick={() => handleSelectCard(p)}
                title={p.name}
              >
                {/* Left Project Icon Container (matching reference image) */}
                <div className="project-card-icon-box" aria-hidden="true">
                  {loadingProjectId === p.id ? (
                    <div className="project-card-spinner" />
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M 9.5 5.5 h 5" />
                      <path d="M 7 9 h 10" />
                      <path d="M 6.5 12.5 h 11 l -1.2 6.5 c -0.2 1 -1.1 1.8 -2.1 1.8 h -4.4 c -1 0 -1.9 -0.8 -2.1 -1.8 Z" />
                    </svg>
                  )}
                </div>

                {/* Middle Project Details */}
                <div className="project-card-info">
                  <span className="project-card-name">{p.name}</span>
                  <span className="project-card-time">
                    {formatCreationDate(p.createdAt || p.updatedAt)}
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
