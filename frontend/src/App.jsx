import { useState, useEffect } from 'react';
import DotGridCanvas from './components/Canvas/DotGridCanvas';
import MovableNode from './components/Node/MovableNode';
import Thread from './components/Thread/Thread';

const NODE_WIDTH = 320;
const NODE_HEIGHT = 200;

export default function App() {
  const [nodes, setNodes] = useState({
    node1: { id: 'node1', x: 0, y: 0, width: NODE_WIDTH, height: NODE_HEIGHT },
    node2: { id: 'node2', x: 0, y: 0, width: NODE_WIDTH, height: NODE_HEIGHT },
  });

  // Position the two blocks nicely side-by-side on initial mount
  useEffect(() => {
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    const gap = 160;
    const totalWidth = NODE_WIDTH * 2 + gap;
    const startX = Math.max((screenW - totalWidth) / 2, 60);
    const startY = Math.max((screenH - NODE_HEIGHT) / 2, 60);

    setNodes({
      node1: {
        id: 'node1',
        x: startX,
        y: startY,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      },
      node2: {
        id: 'node2',
        x: startX + NODE_WIDTH + gap,
        y: startY + 30, // slight offset for organic initial look
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      },
    });
  }, []);

  const handleNodeMove = (id, newX, newY) => {
    setNodes((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        x: newX,
        y: newY,
      },
    }));
  };

  return (
    <DotGridCanvas>
      {/* Dynamic non-fixed connecting thread */}
      <Thread start={nodes.node1} end={nodes.node2} />

      {/* Two movable glass blocks */}
      <MovableNode
        id="node1"
        x={nodes.node1.x}
        y={nodes.node1.y}
        width={nodes.node1.width}
        height={nodes.node1.height}
        onMove={handleNodeMove}
      />

      <MovableNode
        id="node2"
        x={nodes.node2.x}
        y={nodes.node2.y}
        width={nodes.node2.width}
        height={nodes.node2.height}
        onMove={handleNodeMove}
      />
    </DotGridCanvas>
  );
}
