import './ZoomControls.css';

export default function ZoomControls({
  camera,
  viewportWidth,
  viewportHeight,
  onCameraChange,
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
    <div className="zoom-controls" aria-label="Zoom controls">
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
  );
}
