import { useState, useMemo } from 'react';
import './Minimap.css';

export default function Minimap({ nodes = {}, viewportWidth = 1920, viewportHeight = 1080 }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Virtual canvas dimensions represented by the minimap
  const virtualWorld = useMemo(() => ({
    width: Math.max(viewportWidth * 1.8, 2600),
    height: Math.max(viewportHeight * 1.8, 1800),
  }), [viewportWidth, viewportHeight]);

  // Minimap widget dimensions
  const mapWidth = isExpanded ? 330 : 190;
  const mapHeight = isExpanded ? 235 : 135;

  const scaleX = mapWidth / virtualWorld.width;
  const scaleY = mapHeight / virtualWorld.height;

  // Viewport box position in the minimap (centered in virtual world)
  const viewRect = useMemo(() => {
    const originX = (virtualWorld.width - viewportWidth) / 2;
    const originY = (virtualWorld.height - viewportHeight) / 2;

    return {
      x: originX * scaleX,
      y: originY * scaleY,
      w: viewportWidth * scaleX,
      h: viewportHeight * scaleY,
    };
  }, [virtualWorld, viewportWidth, viewportHeight, scaleX, scaleY]);

  // Transform active nodes into minimap coordinate bars
  const nodeBars = useMemo(() => {
    const originX = (virtualWorld.width - viewportWidth) / 2;
    const originY = (virtualWorld.height - viewportHeight) / 2;

    return Object.values(nodes).map((node) => ({
      id: node.id,
      x: (originX + node.x) * scaleX,
      y: (originY + node.y) * scaleY,
      w: Math.max(node.width * scaleX, 16),
      h: Math.max(node.height * scaleY, 8),
    }));
  }, [nodes, virtualWorld, viewportWidth, viewportHeight, scaleX, scaleY]);

  // Background map landscape rectangles (matching the user's reference image)
  const landscapeBars = useMemo(() => {
    const bars = [
      { id: 'b1', x: 0.12, y: 0.35, w: 22, h: 6 },
      { id: 'b2', x: 0.18, y: 0.34, w: 28, h: 6 },
      { id: 'b3', x: 0.22, y: 0.39, w: 24, h: 7 },
      { id: 'b4', x: 0.14, y: 0.44, w: 26, h: 6 },
      { id: 'b5', x: 0.16, y: 0.53, w: 20, h: 6 },
      { id: 'b6', x: 0.10, y: 0.57, w: 24, h: 7 },
      { id: 'b7', x: 0.20, y: 0.57, w: 32, h: 10 },
      { id: 'b8', x: 0.28, y: 0.67, w: 20, h: 6 },
      { id: 'b9', x: 0.36, y: 0.52, w: 22, h: 6 },
      { id: 'b10', x: 0.42, y: 0.47, w: 26, h: 6 },
      { id: 'b11', x: 0.88, y: 0.45, w: 26, h: 6 },
    ];

    return bars.map((b) => ({
      id: b.id,
      x: b.x * mapWidth,
      y: b.y * mapHeight,
      w: isExpanded ? b.w * 1.5 : b.w,
      h: isExpanded ? b.h * 1.4 : b.h,
    }));
  }, [mapWidth, mapHeight, isExpanded]);

  return (
    <div
      className={`minimap-container ${isExpanded ? 'expanded' : 'compact'}`}
      onClick={() => setIsExpanded(!isExpanded)}
      title="Toggle map size"
    >
      <div className="minimap-inner">
        {/* Subtle grid pattern */}
        <div className="minimap-grid" />

        {/* Reference landscape node bars */}
        {landscapeBars.map((bar) => (
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

        {/* Dynamic active movable node bars */}
        {nodeBars.map((bar) => (
          <div
            key={bar.id}
            className="minimap-bar"
            style={{
              transform: `translate3d(${bar.x}px, ${bar.y}px, 0)`,
              width: `${bar.w}px`,
              height: `${bar.h}px`,
              background: 'rgba(203, 213, 225, 0.95)',
              borderColor: 'rgba(148, 163, 184, 0.8)',
            }}
          />
        ))}

        {/* Middle box: the visible area */}
        <div
          className="minimap-viewfinder"
          style={{
            transform: `translate3d(${viewRect.x}px, ${viewRect.y}px, 0)`,
            width: `${viewRect.w}px`,
            height: `${viewRect.h}px`,
          }}
        />

        {/* Expand / Collapse trigger */}
        <div className="minimap-expand-btn">
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
