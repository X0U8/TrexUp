import { useState, useRef } from 'react';
import './WorkflowNode.css';

export default function WorkflowNode({
  id,
  title,
  sub,
  type = 'input', // 'input' | 'output' | 'agent'
  x,
  y,
  width = 175,
  zoom = 1,
  isSelected = false,
  onMove,
  onClick,
  onPortStart,
  onPortEnd,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, initialX: 0, initialY: 0 });

  const handlePointerDown = (e) => {
    // If clicking a port or button, do not drag the node
    if (e.target.closest('.wf-port') || e.target.closest('button')) {
      return;
    }
    e.stopPropagation();
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
    onMove?.(id, dragStartRef.current.initialX + deltaX, dragStartRef.current.initialY + deltaY);
  };

  const handlePointerUp = (e) => {
    if (isDragging) {
      setIsDragging(false);
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      const dist = Math.hypot(
        e.clientX - dragStartRef.current.mouseX,
        e.clientY - dragStartRef.current.mouseY
      );
      if (dist < 5) {
        onClick?.(id);
      }
    }
  };

  const hasLeftPort = type === 'output' || type === 'agent';
  const hasRightPort = type === 'input' || type === 'agent';

  const getNodeTooltip = () => {
    if (type === 'input') return 'Click to configure workflow input sources';
    if (type === 'agent') return 'Click to configure agent prompt & model';
    return 'Output';
  };

  return (
    <div
      className={`workflow-node ${type} ${isDragging ? 'dragging' : ''} ${isSelected ? 'selected' : ''}`}
      data-node-id={id}
      style={{
        width: `${width}px`,
        transform: `translate3d(${x}px, ${y}px, 0)`,
      }}
      title={getNodeTooltip()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Join on Left side: input to this node */}
      {hasLeftPort && (
        <div
          className="wf-port port-left"
          data-port-type="in"
          data-node-id={id}
          title="Input join (connect thread here)"
          onPointerUp={(e) => {
            e.stopPropagation();
            onPortEnd?.(id, 'in');
          }}
        />
      )}

      <div className="wf-node-content">
        <div className="wf-node-indicator" />
        <div className="wf-node-text-wrap">
          <span className="wf-node-title">{type === 'output' ? 'Output' : title}</span>
          {type !== 'output' && (
            <span className="wf-node-sub">
              {sub || (type === 'input' ? 'Workflow input' : 'Agent')}
            </span>
          )}
        </div>
      </div>

      {/* Join on Right side: output from this node */}
      {hasRightPort && (
        <div
          className="wf-port port-right"
          data-port-type="out"
          data-node-id={id}
          title="Output join (drag thread from here)"
          onPointerDown={(e) => {
            e.stopPropagation();
            onPortStart?.(id, 'out', e);
          }}
        />
      )}
    </div>
  );
}
