import './Thread.css';

export default function Thread({
  id,
  start,
  end,
  onDelete,
  isInteractive = true,
}) {
  if (!start || !end) return null;

  const sW = typeof start.width === 'number' && !Number.isNaN(start.width) ? start.width : 175;
  const sH = typeof start.height === 'number' && !Number.isNaN(start.height) ? start.height : 56;
  const sX = typeof start.x === 'number' && !Number.isNaN(start.x) ? start.x : 0;
  const sY = typeof start.y === 'number' && !Number.isNaN(start.y) ? start.y : 0;

  const eW = typeof end.width === 'number' && !Number.isNaN(end.width) ? end.width : 175;
  const eH = typeof end.height === 'number' && !Number.isNaN(end.height) ? end.height : 56;
  const eX = typeof end.x === 'number' && !Number.isNaN(end.x) ? end.x : 0;
  const eY = typeof end.y === 'number' && !Number.isNaN(end.y) ? end.y : 0;

  // Source port is ALWAYS on the RIGHT side of the source node
  const startX = sX + sW;
  const startY = sY + sH / 2;

  // Target port is ALWAYS on the LEFT side of the target node
  // If end is a live cursor point (width === 0 and height === 0), use eX, eY directly
  const isLive = eW === 0 && eH === 0;
  const endX = isLive ? eX : eX;
  const endY = isLive ? eY : eY + eH / 2;

  if (
    !Number.isFinite(startX) ||
    !Number.isFinite(startY) ||
    !Number.isFinite(endX) ||
    !Number.isFinite(endY)
  ) {
    return null;
  }

  // Calculate dynamic, smooth bezier curve
  const dx = endX - startX;
  const dy = endY - startY;

  let cx1, cy1, cx2, cy2;
  if (dx >= 0) {
    // Normal forward flow from right port to left port
    const curvature = Math.max(dx * 0.45, 45);
    cx1 = startX + curvature;
    cy1 = startY;
    cx2 = endX - curvature;
    cy2 = endY;
  } else {
    // Backward loop (target node is to the left of source)
    const loopOffset = Math.max(Math.abs(dx) * 0.35, 60);
    cx1 = startX + loopOffset;
    cy1 = startY + (dy >= 0 ? 35 : -35);
    cx2 = endX - loopOffset;
    cy2 = endY + (dy >= 0 ? -35 : 35);
  }

  const pathData = `M ${startX} ${startY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${endX} ${endY}`;

  // Approximate curve midpoint for hover delete indicator
  const midX = 0.125 * startX + 0.375 * cx1 + 0.375 * cx2 + 0.125 * endX;
  const midY = 0.125 * startY + 0.375 * cy1 + 0.375 * cy2 + 0.125 * endY;

  const handleRemove = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onDelete?.(id, start?.id, end?.id);
  };

  return (
    <svg className="thread-svg-layer">
      {/* Soft muted grey glow */}
      <path d={pathData} className="thread-glow" />

      {/* Main clean cable */}
      <path d={pathData} className="thread-core" />

      {/* Port terminal caps */}
      <circle cx={startX} cy={startY} r={4.5} className="thread-port-glow" />
      <circle cx={startX} cy={startY} r={2} className="thread-port-core" />

      {!isLive && (
        <>
          <circle cx={endX} cy={endY} r={4.5} className="thread-port-glow" />
          <circle cx={endX} cy={endY} r={2} className="thread-port-core" />
        </>
      )}

      {/* Invisible wider hit-target for left-click removal */}
      {isInteractive && onDelete && (
        <g
          className="thread-interactive-hit"
          onClick={handleRemove}
          onPointerDown={(e) => e.stopPropagation()}
          title="Left click to remove thread"
        >
          <path
            d={pathData}
            className="thread-hit-path"
            onClick={handleRemove}
            onPointerDown={(e) => e.stopPropagation()}
          />
          {/* Subtle delete cross badge at midpoint on hover */}
          <g
            className="thread-delete-pill"
            transform={`translate(${midX}, ${midY})`}
            onClick={handleRemove}
            onPointerDown={(e) => {
              e.stopPropagation();
              handleRemove(e);
            }}
          >
            <circle r="10" className="thread-delete-circle" />
            <path d="M -4 -4 L 4 4 M 4 -4 L -4 4" className="thread-delete-x" />
          </g>
        </g>
      )}
    </svg>
  );
}
