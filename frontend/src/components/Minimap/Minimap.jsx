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

    Object.values(nodes || {}).forEach((n) => {
      if (!n) return;
      const nx = typeof n.x === 'number' && !isNaN(n.x) ? n.x : 0;
      const ny = typeof n.y === 'number' && !isNaN(n.y) ? n.y : 0;
      const nw = typeof n.width === 'number' && !isNaN(n.width) && n.width > 0 ? n.width : 280;
      const nh = typeof n.height === 'number' && !isNaN(n.height) && n.height > 0 ? n.height : 72;

      minX = Math.min(minX, nx);
      minY = Math.min(minY, ny);
      maxX = Math.max(maxX, nx + nw);
      maxY = Math.max(maxY, ny + nh);
    });

    // Add generous padding around the bounds
    const spanX = Math.max(maxX - minX, 600);
    const spanY = Math.max(maxY - minY, 400);
    const paddingX = Math.max(spanX * 0.4, 400);
    const paddingY = Math.max(spanY * 0.4, 300);

    return {
      minX: minX - paddingX,
      minY: minY - paddingY,
      width: Math.max(spanX + paddingX * 2, 800),
      height: Math.max(spanY + paddingY * 2, 600),
    };
  }, [nodes, camera, viewportWidth, viewportHeight]);

  const scale = useMemo(() => {
    const sX = worldBounds.width > 0 ? mapWidth / worldBounds.width : 0.05;
    const sY = worldBounds.height > 0 ? mapHeight / worldBounds.height : 0.05;
    const s = Math.min(sX, sY);
    return typeof s === 'number' && !isNaN(s) && s > 0 ? s : 0.05;
  }, [mapWidth, mapHeight, worldBounds]);

  // Center the content in the minimap
  const safeScale = scale || 0.05;
  const offsetX = (mapWidth - (worldBounds.width || 800) * safeScale) / 2;
  const offsetY = (mapHeight - (worldBounds.height || 600) * safeScale) / 2;

  // Viewport rectangle in minimap space (the middle visible area box)
  const viewRect = useMemo(() => {
    const zoom = typeof camera?.zoom === 'number' && camera.zoom > 0 ? camera.zoom : 1;
    const camX = typeof camera?.x === 'number' && !isNaN(camera.x) ? camera.x : 0;
    const camY = typeof camera?.y === 'number' && !isNaN(camera.y) ? camera.y : 0;

    const viewWorldX = -camX / zoom;
    const viewWorldY = -camY / zoom;
    const viewWorldW = (viewportWidth || 1920) / zoom;
    const viewWorldH = (viewportHeight || 1080) / zoom;

    const rawX = (viewWorldX - worldBounds.minX) * safeScale + offsetX;
    const rawY = (viewWorldY - worldBounds.minY) * safeScale + offsetY;
    const rawW = viewWorldW * safeScale;
    const rawH = viewWorldH * safeScale;

    return {
      x: typeof rawX === 'number' && !isNaN(rawX) ? rawX : 0,
      y: typeof rawY === 'number' && !isNaN(rawY) ? rawY : 0,
      w: typeof rawW === 'number' && !isNaN(rawW) ? Math.max(rawW, 12) : 12,
      h: typeof rawH === 'number' && !isNaN(rawH) ? Math.max(rawH, 10) : 10,
    };
  }, [camera, viewportWidth, viewportHeight, worldBounds, safeScale, offsetX, offsetY]);

  // Transform ONLY the actual existing nodes into minimap bars (NO extra rectangles)
  const nodeBars = useMemo(() => {
    return Object.values(nodes || {})
      .filter(Boolean)
      .map((node) => {
        const nx = typeof node.x === 'number' && !isNaN(node.x) ? node.x : 0;
        const ny = typeof node.y === 'number' && !isNaN(node.y) ? node.y : 0;
        const nw = typeof node.width === 'number' && !isNaN(node.width) && node.width > 0 ? node.width : 280;
        const nh = typeof node.height === 'number' && !isNaN(node.height) && node.height > 0 ? node.height : 72;

        const rawX = (nx - worldBounds.minX) * safeScale + offsetX;
        const rawY = (ny - worldBounds.minY) * safeScale + offsetY;
        const rawW = nw * safeScale;
        const rawH = nh * safeScale;

        return {
          id: node.id || `node-${Math.random()}`,
          x: typeof rawX === 'number' && !isNaN(rawX) ? rawX : 0,
          y: typeof rawY === 'number' && !isNaN(rawY) ? rawY : 0,
          w: typeof rawW === 'number' && !isNaN(rawW) ? Math.max(rawW, 14) : 14,
          h: typeof rawH === 'number' && !isNaN(rawH) ? Math.max(rawH, 8) : 8,
        };
      });
  }, [nodes, worldBounds, safeScale, offsetX, offsetY]);

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

      const targetWorldX = mapClickX / safeScale + worldBounds.minX;
      const targetWorldY = mapClickY / safeScale + worldBounds.minY;

      // Center the camera at this world point
      const zoom = camera.zoom || 1;
      const newCamX = viewportWidth / 2 - targetWorldX * zoom;
      const newCamY = viewportHeight / 2 - targetWorldY * zoom;

      onCameraChange?.({ ...camera, x: newCamX, y: newCamY });
    };

    updateCameraFromMap(e.clientX, e.clientY);
  }, [camera, viewportWidth, viewportHeight, safeScale, worldBounds, offsetX, offsetY, onCameraChange]);

  const handleMapPointerMove = useCallback((e) => {
    if (!isDraggingMap.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const mapClickX = e.clientX - rect.left - offsetX;
    const mapClickY = e.clientY - rect.top - offsetY;

    const targetWorldX = mapClickX / safeScale + worldBounds.minX;
    const targetWorldY = mapClickY / safeScale + worldBounds.minY;

    const zoom = camera.zoom || 1;
    const newCamX = viewportWidth / 2 - targetWorldX * zoom;
    const newCamY = viewportHeight / 2 - targetWorldY * zoom;

    onCameraChange?.({ ...camera, x: newCamX, y: newCamY });
  }, [camera, viewportWidth, viewportHeight, safeScale, worldBounds, offsetX, offsetY, onCameraChange]);

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
