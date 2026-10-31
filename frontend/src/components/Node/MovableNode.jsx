import { useState, useRef } from 'react';
import './MovableNode.css';

export default function MovableNode({ id, x, y, width = 320, height = 110, zoom = 1, onMove }) {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, initialX: 0, initialY: 0 });

  const handlePointerDown = (e) => {
    e.stopPropagation(); // prevent panning canvas while dragging node
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

    onMove(id, dragStartRef.current.initialX + deltaX, dragStartRef.current.initialY + deltaY);
  };

  const handlePointerUp = (e) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      className={`movable-node ${isDragging ? 'dragging' : ''}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate3d(${x}px, ${y}px, 0)`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}
