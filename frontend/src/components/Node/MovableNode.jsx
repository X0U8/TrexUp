import { useState, useRef } from 'react';
import { getNodeResolvedDimensions } from '../../utils/treeLayout';
import './MovableNode.css';

export default function MovableNode({
  id,
  x,
  y,
  width = 280,
  zoom = 1,
  data = {},
  isSelected = false,
  onDragStart,
  onMove,
  onDragEnd,
  onClick,
  onPortStart,
  onPortEnd,
  onDropWorkflow,
  isWorkflowDragging = false,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isWorkflowTarget, setIsWorkflowTarget] = useState(false);
  const [thumbBroken, setThumbBroken] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, initialX: 0, initialY: 0 });
  const hasMovedRef = useRef(false);

  const handlePointerDown = (e) => {
    // If clicking a port, do not drag the node
    if (e.target.closest('.exp-port')) {
      return;
    }
    e.stopPropagation();
    hasMovedRef.current = false;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: x,
      initialY: y,
    };
    onDragStart?.(id);
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
    onDragEnd?.(id);

    // If not dragged, treat as click to open modal or select
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
  const isExtracting = Boolean(data.extracting) || status === 'extracting';
  const isLoading = isUploading || isExtracting;

  const dims = getNodeResolvedDimensions(data);
  const resolvedWidth = dims.width;
  const resolvedHeight = dims.height;

  // A generated or extracted image shows a small thumbnail on its card (hidden if the file is missing).
  const storedPath = data.local_path || data.localPath || '';
  const thumbUrl =
    !isResource && /\.(png|jpe?g|webp|gif)$/i.test(storedPath)
      ? `http://127.0.0.1:8001/storage/documents/${encodeURIComponent(storedPath.split(/[\\/]/).pop())}`
      : '';

  const nodeTitle = isUploading
    ? 'Loading document...'
    : isExtracting
      ? 'Extracting knowledge...'
      : 'Click to inspect node';

  return (
    <div
      className={`movable-node ${isResource ? 'resource-node' : 'info-node'} type-${rawType} ${isDragging ? 'dragging' : ''} ${isSelected ? 'selected-tree-node' : ''} ${!isResource && isWorkflowDragging ? 'workflow-droppable' : ''} ${isWorkflowTarget ? 'workflow-drop-target' : ''}`}
      data-node-id={id}
      style={{
        width: `${resolvedWidth}px`,
        height: `${resolvedHeight}px`,
        transform: `translate3d(${x}px, ${y}px, 0)`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDragOver={(e) => {
        // Only non-file and non-resource nodes can accept workflow drops
        if (isResource) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        setIsWorkflowTarget(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setIsWorkflowTarget(false);
      }}
      onDrop={(e) => {
        if (isResource) return;
        setIsWorkflowTarget(false);
        e.preventDefault();
        e.stopPropagation();
        let raw = '';
        try {
          raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
        } catch {
          // ignore
        }
        let parsed = null;
        if (raw) {
          try {
            parsed = JSON.parse(raw);
          } catch {
            // ignore
          }
        }
        onDropWorkflow?.(parsed, data, { clientX: e.clientX, clientY: e.clientY });
      }}
      title={nodeTitle}
    >
      <div className="node-content">
        <div className="node-title-row">
          {thumbUrl && !thumbBroken && (
            <img className="node-thumb" src={thumbUrl} alt="" onError={() => setThumbBroken(true)} />
          )}
          {!isResource && <span className={`node-type-dot-inline type-${rawType}`} title={rawType.replace('_', ' ')} />}
          <span className="node-filename">{displayName}</span>
          {isLoading && (
            <div
              className="node-spinner"
              title={isUploading ? 'Uploading...' : 'Extracting...'}
            />
          )}
        </div>

        {isResource && (
          <div className="node-badges-row">
            <span className="node-category-tag resource">
              <span className="node-type-dot" />
              <span>Resource</span>
            </span>
            {isUploading ? (
              <span className="node-status-badge uploading">uploading...</span>
            ) : isExtracting ? (
              <span className="node-status-badge extracting">extracting...</span>
            ) : null}
          </div>
        )}
      </div>

      {/* Two side connection dots for extracted nodes only (iron ore raw resources have no ports) */}
      {!isResource && (
        <>
          <div
            className="exp-port left"
            onPointerDown={(e) => {
              e.stopPropagation();
              onPortStart?.(id, 'left', e);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              onPortEnd?.(id, 'left');
            }}
            title="Connect relationship"
          />
          <div
            className="exp-port right"
            onPointerDown={(e) => {
              e.stopPropagation();
              onPortStart?.(id, 'right', e);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              onPortEnd?.(id, 'right');
            }}
            title="Connect relationship"
          />
        </>
      )}
    </div>
  );
}
