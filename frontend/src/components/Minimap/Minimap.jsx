import { useState, useMemo, useRef, useCallback } from 'react';
import './Minimap.css';

export default function Minimap({
  nodes = {},
  camera = { x: 0, y: 0, zoom: 1 },
  viewportWidth = 1920,
  viewportHeight = 1080,
  onCameraChange,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const mapRef = useRef(null);
  const isDraggingMap = useRef(false);

  // Dimensions of minimap widget
  const mapWidth = isExpanded ? 340 : 200;
  const mapHeight = isExpanded ? 240 : 140;

  // Compute bounding box of all actual nodes + current visible viewport in world coordinates
  const worldBounds = useMemo(() => {
    const viewWorldX = -camera.x / camera.zoom;
    const viewWorldY = -camera.y / camera.zoom;
    const viewWorldW = viewportWidth / camera.zoom;
    const viewWorldH = viewportHeight / camera.zoom;

    let minX = viewWorldX;
    let minY = viewWorldY;
    let maxX = viewWorldX + viewWorldW;
    let maxY = viewWorldY + viewWorldH;

    Object.values(nodes).forEach((n) => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    });

    // Add generous padding around the bounds
    const paddingX = Math.max((maxX - minX) * 0.4, 400);
    const paddingY = Math.max((maxY - minY) * 0.4, 300);

    return {
      minX: minX - paddingX,
      minY: minY - paddingY,
      width: maxX - minX + paddingX * 2,
      height: maxY - minY + paddingY * 2,
    };
  }, [nodes, camera, viewportWidth, viewportHeight]);

  const scale = useMemo(() => {
    const sX = mapWidth / worldBounds.width;
    const sY = mapHeight / worldBounds.height;
    return Math.min(sX, sY);
  }, [mapWidth, mapHeight, worldBounds]);

  // Center the content in the minimap
  const offsetX = (mapWidth - worldBounds.width * scale) / 2;
  const offsetY = (mapHeight - worldBounds.height * scale) / 2;

  // Viewport rectangle in minimap space (the middle visible area box)
  const viewRect = useMemo(() => {
    const viewWorldX = -camera.x / camera.zoom;
    const viewWorldY = -camera.y / camera.zoom;
    const viewWorldW = viewportWidth / camera.zoom;
    const viewWorldH = viewportHeight / camera.zoom;

    return {
      x: (viewWorldX - worldBounds.minX) * scale + offsetX,
      y: (viewWorldY - worldBounds.minY) * scale + offsetY,
      w: Math.max(viewWorldW * scale, 12),
      h: Math.max(viewWorldH * scale, 10),
    };
  }, [camera, viewportWidth, viewportHeight, worldBounds, scale, offsetX, offsetY]);

  // Transform ONLY the actual existing nodes into minimap bars (NO extra rectangles)
  const nodeBars = useMemo(() => {
    return Object.values(nodes).map((node) => ({
      id: node.id,
      x: (node.x - worldBounds.minX) * scale + offsetX,
      y: (node.y - worldBounds.minY) * scale + offsetY,
      w: Math.max(node.width * scale, 14),
      h: Math.max(node.height * scale, 8),
    }));
  }, [nodes, worldBounds, scale, offsetX, offsetY]);

  // Click or drag inside minimap to pan the main camera
  const handleMapPointerDown = useCallback((e) => {
    // Prevent toggling expand when interacting with the map
    if (e.target.closest('.minimap-expand-btn')) return;
    e.stopPropagation();

    isDraggingMap.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);

    const updateCameraFromMap = (clientX, clientY) => {
      const rect = mapRef.current.getBoundingClientRect();
      const mapClickX = clientX - rect.left - offsetX;
      const mapClickY = clientY - rect.top - offsetY;

      const targetWorldX = mapClickX / scale + worldBounds.minX;
      const targetWorldY = mapClickY / scale + worldBounds.minY;

      // Center the camera at this world point
      const newCamX = viewportWidth / 2 - targetWorldX * camera.zoom;
      const newCamY = viewportHeight / 2 - targetWorldY * camera.zoom;

      onCameraChange?.({ ...camera, x: newCamX, y: newCamY });
    };

    updateCameraFromMap(e.clientX, e.clientY);
  }, [camera, viewportWidth, viewportHeight, scale, worldBounds, offsetX, offsetY, onCameraChange]);

  const handleMapPointerMove = useCallback((e) => {
    if (!isDraggingMap.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const mapClickX = e.clientX - rect.left - offsetX;
    const mapClickY = e.clientY - rect.top - offsetY;

    const targetWorldX = mapClickX / scale + worldBounds.minX;
    const targetWorldY = mapClickY / scale + worldBounds.minY;

    const newCamX = viewportWidth / 2 - targetWorldX * camera.zoom;
    const newCamY = viewportHeight / 2 - targetWorldY * camera.zoom;

    onCameraChange?.({ ...camera, x: newCamX, y: newCamY });
  }, [camera, viewportWidth, viewportHeight, scale, worldBounds, offsetX, offsetY, onCameraChange]);

  const handleMapPointerUp = useCallback((e) => {
    isDraggingMap.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, []);

  return (
    <div
      ref={mapRef}
      className={`minimap-container ${isExpanded ? 'expanded' : 'compact'}`}
      onPointerDown={handleMapPointerDown}
      onPointerMove={handleMapPointerMove}
      onPointerUp={handleMapPointerUp}
      title="Click or drag on map to navigate view"
    >
      <div className="minimap-inner">
        {/* Subtle dot matrix */}
        <div className="minimap-grid" />

        {/* ONLY actual nodes that exist on canvas */}
        {nodeBars.map((bar) => (
          <div
            key={bar.id}
            className="minimap-bar"
            style={{
              transform: `translate3d(${bar.x}px, ${bar.y}px, 0)`,
              width: `${bar.w}px`,
              height: `${bar.h}px`,
            }}
          />
        ))}

        {/* Middle box: the moving visible viewport area */}
        <div
          className="minimap-viewfinder"
          style={{
            transform: `translate3d(${viewRect.x}px, ${viewRect.y}px, 0)`,
            width: `${viewRect.w}px`,
            height: `${viewRect.h}px`,
          }}
        />

        {/* Expand / Collapse toggle button */}
        <div
          className="minimap-expand-btn"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          title={isExpanded ? 'Collapse map' : 'Expand map'}
        >
          {isExpanded ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M4 14h6m0 0v6m0-6L3 21M20 10h-6m0 0V4m0 6l7-7" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M15 3h6m0 0v6m0-6l-7 7M9 21H3m0 0v-6m0 6l7-7" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
