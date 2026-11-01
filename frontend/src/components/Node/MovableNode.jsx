import { useState, useRef } from 'react';
import './MovableNode.css';

export default function MovableNode({
  id,
  x,
  y,
  width = 280,
  zoom = 1,
  data = {},
  onMove,
  onClick,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, initialX: 0, initialY: 0 });
  const hasMovedRef = useRef(false);

  const handlePointerDown = (e) => {
    e.stopPropagation();
    hasMovedRef.current = false;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: x,
      initialY: y,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const deltaX = (e.clientX - dragStartRef.current.mouseX) / zoom;
    const deltaY = (e.clientY - dragStartRef.current.mouseY) / zoom;

    if (Math.hypot(e.clientX - dragStartRef.current.mouseX, e.clientY - dragStartRef.current.mouseY) > 5) {
      hasMovedRef.current = true;
    }

    onMove?.(id, dragStartRef.current.initialX + deltaX, dragStartRef.current.initialY + deltaY);
  };

  const handlePointerUp = (e) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    // If not dragged, treat as click to open modal
    if (!hasMovedRef.current) {
      onClick?.();
    }
  };

  const fileName = data.name || 'Untitled Document';
  const status = data.status || 'not checked';
  const isUploading = Boolean(data.uploading);

  return (
    <div
      className={`movable-node ${isDragging ? 'dragging' : ''}`}
      style={{
        width: `${width}px`,
        transform: `translate3d(${x}px, ${y}px, 0)`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      title={isUploading ? 'Uploading to Cloudinary...' : 'Click to view details'}
    >
      <div className="node-content">
        <div className="node-title-row">
          <svg className="node-file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="14 2 14 8 20 8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="node-filename">{fileName}</span>
          {/* Small circular loading animation on the right side */}
          {isUploading && <div className="node-spinner" title="Uploading..." />}
        </div>

        <div className="node-status-row">
          <span className={`node-status-badge ${isUploading ? 'uploading' : ''}`}>
            {isUploading ? 'uploading...' : status}
          </span>
        </div>
      </div>
    </div>
  );
}
