import { useState, useEffect } from 'react';
import DotGridCanvas from './components/Canvas/DotGridCanvas';
import MovableNode from './components/Node/MovableNode';
import Thread from './components/Thread/Thread';
import Minimap from './components/Minimap/Minimap';
import ZoomControls from './components/Controls/ZoomControls';
import Sidebar from './components/Sidebar/Sidebar';
import DocumentModal from './components/DocumentModal/DocumentModal';
import ProjectsPage from './components/Projects/ProjectsPage';
import { uploadToCloudinary } from './utils/cloudinary';
import { saveProject } from './utils/db';

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function App() {
  const [currentView, setCurrentView] = useState('projects'); // 'projects' | 'canvas'
  const [currentProject, setCurrentProject] = useState(null);

  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [nodes, setNodes] = useState({});
  const [selectedDocNode, setSelectedDocNode] = useState(null);
  const [notification, setNotification] = useState(null);

  // Auto-dismiss notification after 4 seconds
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 4000);
    return () => clearTimeout(timer);
  }, [notification]);

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

  const persistProjectNodes = (updatedNodes) => {
    if (currentProject) {
      saveProject({
        ...currentProject,
        nodes: updatedNodes,
        updatedAt: new Date().toISOString(),
      }).catch((err) => console.error('Failed to auto-save project nodes:', err));
    }
  };

  const handleNodeMove = (id, newX, newY) => {
    setNodes((prev) => {
      const next = {
        ...prev,
        [id]: {
          ...prev[id],
          x: newX,
          y: newY,
        },
      };
      persistProjectNodes(next);
      return next;
    });
  };

  const handleRenameNode = (id, newName) => {
    setNodes((prev) => {
      if (!prev[id]) return prev;
      const next = {
        ...prev,
        [id]: {
          ...prev[id],
          name: newName,
        },
      };
      persistProjectNodes(next);
      return next;
    });
    setSelectedDocNode((prev) => (prev && prev.id === id ? { ...prev, name: newName } : prev));
  };

  // Direct canvas drag-and-drop handler with Cloudinary upload
  const handleFileDrop = async (file, pos) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setNotification(`"${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB size limit.`);
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const defaultX = (viewport.width / 2 - camera.x) / camera.zoom - 140;
    const defaultY = (viewport.height / 2 - camera.y) / camera.zoom - 40;

    const initialNode = {
      id: tempId,
      name: file.name,
      fileSize: file.size,
      type: file.type || 'document',
      status: 'uploading',
      uploading: true,
      x: pos ? pos.x : defaultX,
      y: pos ? pos.y : defaultY,
      width: 280,
    };

    // Show immediately on canvas with right-side circular spinner
    setNodes((prev) => {
      const next = { ...prev, [tempId]: initialNode };
      persistProjectNodes(next);
      return next;
    });

    // Trigger Cloudinary upload in background
    try {
      const result = await uploadToCloudinary(file);
      const assignedId = result.public_id || result.asset_id;

      const finalizedNode = {
        ...initialNode,
        id: assignedId,
        publicId: result.public_id,
        assetId: result.asset_id,
        cloudinaryUrl: result.secure_url,
        status: 'not checked',
        uploading: false,
      };

      setNodes((prev) => {
        const next = { ...prev };
        delete next[tempId];
        next[assignedId] = finalizedNode;
        persistProjectNodes(next);
        return next;
      });

      setSelectedDocNode((prev) => (prev && prev.id === tempId ? finalizedNode : prev));
    } catch (err) {
      console.error('Upload error:', err);
      setNotification(`Upload failed: ${err.message || 'Cloudinary error'}`);
      setNodes((prev) => {
        if (!prev[tempId]) return prev;
        const next = {
          ...prev,
          [tempId]: {
            ...prev[tempId],
            status: 'upload failed',
            uploading: false,
          },
        };
        persistProjectNodes(next);
        return next;
      });
      setSelectedDocNode((prev) =>
        prev && prev.id === tempId
          ? { ...prev, status: 'upload failed', uploading: false }
          : prev
      );
    }
  };

  const handleSelectProject = (project) => {
    setCurrentProject(project);
    setNodes(project.nodes || {});
    setCurrentView('canvas');
  };

  // If on Projects starting page, render the Projects view
  if (currentView === 'projects') {
    return <ProjectsPage onSelectProject={handleSelectProject} />;
  }

  const nodeList = Object.values(nodes);

  return (
    <>
      {/* Toast notification for file limits & upload errors */}
      {notification && (
        <div className="app-toast" role="alert">
          <span>{notification}</span>
          <button type="button" onClick={() => setNotification(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      {/* Top-Left Hamburger & Drawer with option to go back to Projects */}
      <Sidebar onGoToProjects={() => setCurrentView('projects')} />

      {/* Top-Right Expandable Interactive Minimap */}
      <Minimap
        nodes={nodes}
        camera={camera}
        viewportWidth={viewport.width}
        viewportHeight={viewport.height}
        onCameraChange={setCamera}
      />

      {/* Bottom-Left Zoom Controls (+ / -) */}
      <ZoomControls
        camera={camera}
        viewportWidth={viewport.width}
        viewportHeight={viewport.height}
        onCameraChange={setCamera}
      />

      {/* Document Detail Modal */}
      <DocumentModal
        node={selectedDocNode}
        isOpen={!!selectedDocNode}
        onClose={() => setSelectedDocNode(null)}
        onRename={handleRenameNode}
      />

      {/* Pannable & Zoomable Dot Grid Canvas with Direct File Drag & Drop */}
      <DotGridCanvas
        camera={camera}
        onCameraChange={setCamera}
        onDropFile={handleFileDrop}
      >
        {/* Dynamic connecting thread between nodes if 2 or more exist */}
        {nodeList.length >= 2 && (
          <Thread start={nodeList[0]} end={nodeList[1]} />
        )}

        {/* Dynamic movable document nodes */}
        {nodeList.map((node) => (
          <MovableNode
            key={node.id}
            id={node.id}
            x={node.x}
            y={node.y}
            width={node.width}
            zoom={camera.zoom}
            data={node}
            onMove={handleNodeMove}
            onClick={() => setSelectedDocNode(node)}
          />
        ))}
      </DotGridCanvas>
    </>
  );
}
