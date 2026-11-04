import { useState, useEffect } from 'react';
import './ProjectsPage.css';
import NewProjectModal from './NewProjectModal';
import { getProjectsMetadata, updateProjectMeta, deleteProject } from '../../utils/db';

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
  const [activeMenuProjectId, setActiveMenuProjectId] = useState(null);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.project-menu-wrap')) {
        setActiveMenuProjectId(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
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
    e?.stopPropagation();
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

  const handleConfirmDelete = async () => {
    if (!projectToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteProject(projectToDelete.id);
      setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id));
      setProjectToDelete(null);
    } catch (err) {
      console.error('Failed to delete project:', err);
    } finally {
      setIsDeleting(false);
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
                {/* Left Project Icon Container */}
                <div className="project-card-icon-box" aria-hidden="true">
                  {loadingProjectId === p.id ? (
                    <div className="project-card-spinner" />
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
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

                {/* Right Pin & Three-Dot Menu Actions */}
                <div className="project-card-actions" onClick={(e) => e.stopPropagation()}>
                  {p.pinned && (
                    <div className="project-card-pin-indicator" title="Pinned project">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                      </svg>
                    </div>
                  )}

                  <div className="project-menu-wrap">
                    <button
                      type="button"
                      className={`project-menu-btn ${activeMenuProjectId === p.id ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuProjectId((prev) => (prev === p.id ? null : p.id));
                      }}
                      title="Project options"
                      aria-label="Options"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="12" r="1.75" />
                        <circle cx="6" cy="12" r="1.75" />
                        <circle cx="18" cy="12" r="1.75" />
                      </svg>
                    </button>

                    {activeMenuProjectId === p.id && (
                      <div className="project-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="project-dropdown-item"
                          onClick={(e) => {
                            handleTogglePin(e, p);
                            setActiveMenuProjectId(null);
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14 }}>
                            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                          </svg>
                          <span>{p.pinned ? 'Unpin project' : 'Pin project'}</span>
                        </button>

                        <div className="project-dropdown-divider" />

                        <button
                          type="button"
                          className="project-dropdown-item danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuProjectId(null);
                            setProjectToDelete(p);
                          }}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ width: 14, height: 14 }}
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                          <span>Delete project</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      ) : (
        <main className="projects-center">
          {/* Line-art Illustration */}
          <div className="empty-state-icon" aria-hidden="true">
            <svg
              viewBox="0 0 64 64"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M54 52a4 4 0 0 0 4-4V20a4 4 0 0 0-4-4H34l-5-6H10a4 4 0 0 0-4 4v34a4 4 0 0 0 4 4Z" />
              <line x1="32" y1="28" x2="32" y2="44" />
              <line x1="24" y1="36" x2="40" y2="36" />
            </svg>
          </div>

          <h2 className="empty-state-heading">Looking to start a project?</h2>
          <p className="empty-state-desc">
            Upload materials, run custom engines and workflows.
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

      {/* Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="project-delete-backdrop" onClick={() => !isDeleting && setProjectToDelete(null)}>
          <div className="project-delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="project-delete-modal-header">
              <div className="delete-icon-circle" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>
              <div className="delete-header-texts">
                <h3 className="delete-modal-title">Delete Project</h3>
                <p className="delete-modal-desc">
                  Are you sure you want to delete <strong>"{projectToDelete.name}"</strong>? All explorations, workflows, engines, and logs within this project will be permanently removed. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="project-delete-modal-actions">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setProjectToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-delete"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
