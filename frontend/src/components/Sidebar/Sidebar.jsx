import './Sidebar.css';

export default function Sidebar() {
  return (
    <aside className="sidebar-container" aria-label="Sidebar navigation">
      {/* First option for now */}
      <button
        type="button"
        className="sidebar-btn active"
        title="Canvas & Nodes"
        aria-label="Canvas & Nodes"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      </button>
    </aside>
  );
}
