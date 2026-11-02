import { useRef, useState, useEffect } from 'react';
import './DotGridCanvas.css';

export default function DotGridCanvas({
  camera,
  onCameraChange,
  onDropFile,
  onDropModel,
  onCanvasPointerMove,
  onCanvasPointerUp,
  onCanvasClick,
  children,
}) {
  const [isPanning, setIsPanning] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const panStartRef = useRef({ mouseX: 0, mouseY: 0, camX: 0, camY: 0 });
  const viewportRef = useRef(null);

  // Smooth wheel zoom centered on cursor
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const clampedDelta = Math.min(Math.max(-e.deltaY, -40), 40);
      const zoomFactor = 1 + clampedDelta * 0.0018;

      const newZoom = Math.min(Math.max(camera.zoom * zoomFactor, 0.3), 2.5);
      if (Math.abs(newZoom - camera.zoom) < 0.001) return;

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newX = mouseX - (mouseX - camera.x) * (newZoom / camera.zoom);
      const newY = mouseY - (mouseY - camera.y) * (newZoom / camera.zoom);

      onCameraChange({ x: newX, y: newY, zoom: newZoom });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [camera, onCameraChange]);

  const handlePointerDown = (e) => {
    if (
      e.target.closest('.movable-node') ||
      e.target.closest('.minimap-container') ||
      e.target.closest('.zoom-controls') ||
      e.target.closest('.hamburger-btn') ||
      e.target.closest('.top-nav-bar') ||
      e.target.closest('.drawer-panel') ||
      e.target.closest('.drawer-backdrop') ||
      e.target.closest('.top-breadcrumbs-nav') ||
      e.target.closest('.doc-modal-backdrop') ||
      e.target.closest('.model-chat-panel') ||
      e.target.closest('.workflow-node') ||
      e.target.closest('.wf-io-backdrop') ||
      e.target.closest('.agent-modal-backdrop') ||
      e.target.closest('.thread-interactive-hit') ||
      e.target.closest('.thread-delete-pill') ||
      e.target.closest('.thread-hit-path')
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
    onCanvasPointerMove?.(e);
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
    onCanvasPointerUp?.(e);
    if (isPanning) {
      const dist = Math.hypot(e.clientX - panStartRef.current.mouseX, e.clientY - panStartRef.current.mouseY);
      if (dist < 5) {
        onCanvasClick?.(e);
      }
    } else {
      onCanvasClick?.(e);
    }
    setIsPanning(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  // Direct file drag and drop on canvas
  const handleDragOver = (e) => {
    e.preventDefault();
    if (!onDropFile && !onDropModel) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);

    // Check if dragging model from ModelsPanel onto canvas
    const rawData = e.dataTransfer.getData('application/json');
    if (rawData && onDropModel && viewportRef.current) {
      try {
        const parsed = JSON.parse(rawData);
        if (parsed?.type === 'workflow-model' && parsed.model) {
          const rect = viewportRef.current.getBoundingClientRect();
          const screenX = e.clientX - rect.left;
          const screenY = e.clientY - rect.top;
          const worldX = (screenX - camera.x) / camera.zoom - 85;
          const worldY = (screenY - camera.y) / camera.zoom - 28;
          onDropModel(parsed.model, { x: worldX, y: worldY });
          return;
        }
      } catch (err) {
        // ignore
      }
    }

    const files = e.dataTransfer.files;
    if (files && files.length > 0 && onDropFile && viewportRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      // Convert to world space
      const worldX = (screenX - camera.x) / camera.zoom - 140;
      const worldY = (screenY - camera.y) / camera.zoom - 45;

      for (let i = 0; i < files.length; i++) {
        onDropFile(files[i], { x: worldX + i * 24, y: worldY + i * 24 });
      }
    }
  };

  const gridStep = 28 * camera.zoom;

  return (
    <div
      ref={viewportRef}
      className={`canvas-viewport ${isPanning ? 'panning' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop overlay prompt when user drags file directly over canvas */}
      {isDragOver && (
        <div className="canvas-drop-overlay">
          Drop file to add node
        </div>
      )}

      {/* Dynamic dot grid */}
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

      {/* World Layer */}
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
