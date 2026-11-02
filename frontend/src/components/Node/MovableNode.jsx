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

  const isResource =
    data.category === 'resource' ||
    data.type === 'document' ||
    data.type === 'resource' ||
    Boolean(data.cloudinaryUrl) ||
    Boolean(data.fileSize);

  const rawType = data.type || (isResource ? 'document' : 'finding');
  const displayName = (data.title || data.name || (isResource ? 'Untitled Document' : 'Untitled Node')).replace(/\.node$/i, '');
  const status = data.status || (isResource ? 'not checked' : 'proposed');
  const isUploading = Boolean(data.uploading);

  return (
    <div
      className={`movable-node ${isResource ? 'resource-node' : 'info-node'} type-${rawType} ${isDragging ? 'dragging' : ''}`}
      style={{
        width: `${width}px`,
        transform: `translate3d(${x}px, ${y}px, 0)`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      title={isUploading ? 'Uploading to Cloudinary...' : 'Click to inspect node'}
    >
      <div className="node-content">
        <div className="node-title-row">
          <span className="node-filename">{displayName}</span>
          {isUploading && <div className="node-spinner" title="Uploading..." />}
        </div>

        <div className="node-badges-row">
          {isResource ? (
            <>
              <span className="node-category-tag resource">Resource</span>
              <span className={`node-status-badge ${isUploading ? 'uploading' : ''}`}>
                {isUploading ? 'uploading...' : status}
              </span>
            </>
          ) : (
            <>
              <span className={`node-category-tag info ${rawType}`}>
                {rawType.replace('_', ' ')}
              </span>
              <span className="node-status-badge info">
                {status}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
