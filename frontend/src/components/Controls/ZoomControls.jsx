import './ZoomControls.css';

export default function ZoomControls({
  camera,
  viewportWidth,
  viewportHeight,
  onCameraChange,
  onOpenUpload,
}) {
  const handleZoom = (factor) => {
    const minZoom = 0.3;
    const maxZoom = 2.5;
    const newZoom = Math.min(Math.max(camera.zoom * factor, minZoom), maxZoom);

    if (Math.abs(newZoom - camera.zoom) < 0.001) return;

    // Zoom centered on the viewport middle
    const cx = (viewportWidth || window.innerWidth) / 2;
    const cy = (viewportHeight || window.innerHeight) / 2;

    const newX = cx - (cx - camera.x) * (newZoom / camera.zoom);
    const newY = cy - (cy - camera.y) * (newZoom / camera.zoom);

    onCameraChange({
      x: newX,
      y: newY,
      zoom: newZoom,
    });
  };

  return (
    <div className="bottom-left-dock" aria-label="Canvas controls">
      {/* Zoom + / - buttons */}
      <div className="zoom-controls">
        <button
          type="button"
          className="zoom-btn"
          onClick={() => handleZoom(1.2)}
          aria-label="Zoom in"
          title="Zoom In"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <div className="zoom-divider" />

        <button
          type="button"
          className="zoom-btn"
          onClick={() => handleZoom(1 / 1.2)}
          aria-label="Zoom out"
          title="Zoom Out"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Upload button right beside + - */}
      <button
        type="button"
        className="upload-btn"
        onClick={onOpenUpload}
        aria-label="Upload source"
        title="Upload"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </button>
    </div>
  );
}
