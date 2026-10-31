import { useState, useRef, useEffect } from 'react';
import './App.css';

function App() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });
  const nodeRef = useRef(null);

  // Center node initially
  useEffect(() => {
    const initX = (window.innerWidth - 340) / 2;
    const initY = (window.innerHeight - 220) / 2;
    setPosition({ x: initX, y: initY });
  }, []);

  const handlePointerDown = (e) => {
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    e.target.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.mouseX;
    const deltaY = e.clientY - dragStartRef.current.mouseY;

    setPosition({
      x: dragStartRef.current.posX + deltaX,
      y: dragStartRef.current.posY + deltaY,
    });
  };

  const handlePointerUp = (e) => {
    setIsDragging(false);
    e.target.releasePointerCapture?.(e.pointerId);
  };

  return (
    <div className="app-container">
      {/* Node-Editor Style Dot Grid */}
      <div className="dot-grid-canvas" />

      {/* Soft Ambient Depth Glows */}
      <div className="ambient-glow glow-primary" />
      <div className="ambient-glow glow-secondary" />

      {/* Movable Glass Block Node (No Text) */}
      <div
        ref={nodeRef}
        className={`movable-node ${isDragging ? 'dragging' : ''}`}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
    </div>
  );
}

export default App;
