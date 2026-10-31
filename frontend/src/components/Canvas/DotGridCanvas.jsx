import { useRef, useState, useEffect } from 'react';
import './DotGridCanvas.css';

export default function DotGridCanvas({ camera, onCameraChange, children }) {
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ mouseX: 0, mouseY: 0, camX: 0, camY: 0 });
  const viewportRef = useRef(null);

  // Smooth wheel zoom centered on cursor
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      e.preventDefault();
      // Gentle proportional zoom factor (smooth on trackpads and mouse wheels)
      const clampedDelta = Math.min(Math.max(-e.deltaY, -40), 40);
      const zoomFactor = 1 + clampedDelta * 0.0018;

      const newZoom = Math.min(Math.max(camera.zoom * zoomFactor, 0.3), 2.5);
      if (Math.abs(newZoom - camera.zoom) < 0.001) return;

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Maintain focal point under mouse cursor
      const newX = mouseX - (mouseX - camera.x) * (newZoom / camera.zoom);
      const newY = mouseY - (mouseY - camera.y) * (newZoom / camera.zoom);

      onCameraChange({ x: newX, y: newY, zoom: newZoom });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [camera, onCameraChange]);

  const handlePointerDown = (e) => {
    // Only pan if clicking on canvas background directly, not on UI docks or nodes
    if (
      e.target.closest('.movable-node') ||
      e.target.closest('.minimap-container') ||
      e.target.closest('.bottom-left-dock') ||
      e.target.closest('.sidebar-container') ||
      e.target.closest('.upload-modal-container')
    ) {
      return;
    }

    setIsPanning(true);
    panStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      camX: camera.x,
      camY: camera.y,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isPanning) return;
    const deltaX = e.clientX - panStartRef.current.mouseX;
    const deltaY = e.clientY - panStartRef.current.mouseY;

    onCameraChange({
      ...camera,
      x: panStartRef.current.camX + deltaX,
      y: panStartRef.current.camY + deltaY,
    });
  };

  const handlePointerUp = (e) => {
    setIsPanning(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const gridStep = 28 * camera.zoom;

  return (
    <div
      ref={viewportRef}
      className={`canvas-viewport ${isPanning ? 'panning' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Dynamic dot grid scaling and shifting with camera */}
      <div
        className="dot-grid-matrix"
        style={{
          backgroundSize: `${gridStep}px ${gridStep}px`,
          backgroundPosition: `${camera.x}px ${camera.y}px`,
        }}
      />

      {/* Ambient background glows */}
      <div className="ambient-glow glow-primary" />
      <div className="ambient-glow glow-secondary" />

      {/* Transformed World Layer */}
      <div
        className="world-layer"
        style={{
          transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
