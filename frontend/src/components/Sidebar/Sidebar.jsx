import { useState, useEffect } from 'react';
import './Sidebar.css';

export default function Sidebar({ onGoToProjects }) {
  const [isOpen, setIsOpen] = useState(false);

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
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>

      {/* Dimmed Backdrop */}
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
          <button
            type="button"
            className="drawer-item"
            onClick={() => {
              setIsOpen(false);
              onGoToProjects?.();
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span>All Projects</span>
          </button>

          <button type="button" className="drawer-item active">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="6" cy="6" r="3" />
              <circle cx="18" cy="18" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M9 6h6a3 3 0 0 1 3 3v6" />
              <line x1="6" y1="9" x2="6" y2="15" />
            </svg>
            <span>Research Graph</span>
          </button>
        </nav>
      </aside>
    </>
  );
}
