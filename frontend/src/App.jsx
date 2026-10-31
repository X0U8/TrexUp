import { useState, useEffect } from 'react';
import DotGridCanvas from './components/Canvas/DotGridCanvas';
import MovableNode from './components/Node/MovableNode';
import Thread from './components/Thread/Thread';
import Minimap from './components/Minimap/Minimap';
import ZoomControls from './components/Controls/ZoomControls';
import Sidebar from './components/Sidebar/Sidebar';
import UploadModal from './components/UploadModal/UploadModal';

export default function App() {
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [nodes, setNodes] = useState({});
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Track viewport resize
  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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

  const nodeList = Object.values(nodes);

  return (
    <>
      {/* Compact Floating Left Sidebar with 1 option */}
      <Sidebar />

      {/* Top-Right Expandable Interactive Minimap */}
      <Minimap
        nodes={nodes}
        camera={camera}
        viewportWidth={viewport.width}
        viewportHeight={viewport.height}
        onCameraChange={setCamera}
      />

      {/* Bottom-Left Controls (+ / - and Upload icon) */}
      <ZoomControls
        camera={camera}
        viewportWidth={viewport.width}
        viewportHeight={viewport.height}
        onCameraChange={setCamera}
        onOpenUpload={() => setIsUploadOpen(true)}
      />

      {/* Upload Modal (opens when upload icon is clicked) */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
      />

      {/* Pannable & Zoomable Dot Grid Canvas */}
      <DotGridCanvas camera={camera} onCameraChange={setCamera}>
        {/* Dynamic connecting thread between nodes if 2 or more exist */}
        {nodeList.length >= 2 && (
          <Thread start={nodeList[0]} end={nodeList[1]} />
        )}

        {/* Dynamic movable glass blocks */}
        {nodeList.map((node) => (
          <MovableNode
            key={node.id}
            id={node.id}
            x={node.x}
            y={node.y}
            width={node.width}
            height={node.height}
            zoom={camera.zoom}
            onMove={handleNodeMove}
          />
        ))}
      </DotGridCanvas>
    </>
  );
}
