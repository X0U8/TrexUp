import './Thread.css';

const getNodeBox = (node) => {
  if (!node) return { width: 175, height: 56, x: 0, y: 0 };
  const isDoc =
    node.category === 'resource' ||
    node.type === 'document' ||
    node.type === 'resource' ||
    Boolean(node.cloudinaryUrl) ||
    Boolean(node.fileSize);
  const type = node.type || (isDoc ? 'document' : 'finding');

  let w = typeof node.width === 'number' && !Number.isNaN(node.width) ? node.width : null;
  let h = typeof node.height === 'number' && !Number.isNaN(node.height) ? node.height : null;

  if (!w || w >= 270) {
    if (isDoc || type === 'document') w = 275;
    else if (type === 'topic') w = 190;
    else if (type === 'subtopic') w = 150;
    else if (type === 'evidence') w = 170;
    else if (type === 'claim') w = 185;
    else w = 185;
  }

  if (!h || h >= 50) {
    if (isDoc || type === 'document') h = 68;
    else if (type === 'topic') h = 44;
    else if (type === 'subtopic') h = 36;
    else if (type === 'evidence') h = 40;
    else if (type === 'claim') h = 42;
    else h = 42;
  }

  return {
    width: w,
    height: h,
    x: typeof node.x === 'number' && !Number.isNaN(node.x) ? node.x : 0,
    y: typeof node.y === 'number' && !Number.isNaN(node.y) ? node.y : 0,
  };
};

export default function Thread({
  id,
  start,
  end,
  condition = '',
  label = '',
  status = 'active', // 'active' | 'analyzing' | 'rejected'
  isRejected = false,
  isAnalyzing = false,
  onClickThread,
  onDelete,
  isInteractive = true,
  isRunning = false,
  isWorkflow = false,
}) {
  if (!start || !end) return null;

  const startBox = getNodeBox(start);
  const endBox = getNodeBox(end);

  const sW = startBox.width;
  const sH = startBox.height;
  const sX = startBox.x;
  const sY = startBox.y;

  const isLive = end.width === 0 && end.height === 0;
  const eW = isLive ? 0 : endBox.width;
  const eH = isLive ? 0 : endBox.height;
  const eX = endBox.x;
  const eY = endBox.y;

  // Docking:
  // For workflow pipelines, strictly connect from source right-side port to target left-side port.
  // For exploration canvas, use smart docking based on relative node positions.
  let startX;
  let endX;
  if (isWorkflow || isLive) {
    startX = sX + sW;
    endX = eX;
  } else if (sX > eX + eW) {
    startX = sX;
    endX = eX + eW;
  } else {
    startX = sX + sW;
    endX = eX;
  }

  const startY = sY + sH / 2;
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
    const curvature = Math.max(dx * 0.45, 45);
    cx1 = startX + curvature;
    cy1 = startY;
    cx2 = endX - curvature;
    cy2 = endY;
  } else {
    const loopOffset = Math.max(Math.abs(dx) * 0.35, 60);
    cx1 = startX + loopOffset;
    cy1 = startY + (dy >= 0 ? 35 : -35);
    cx2 = endX - loopOffset;
    cy2 = endY + (dy >= 0 ? -35 : 35);
  }

  const pathData = `M ${startX} ${startY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${endX} ${endY}`;

  const isError = isRejected || status === 'rejected';
  const isBusy = isRunning || isAnalyzing || status === 'analyzing';

  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClickThread?.(id);
  };

  // Conditions NEVER render as text pills — they are visualized via the elegant darker shade.
  // displayLabel is strictly for exploration relationship labels or rejected/analyzing states.
  const displayLabel = isError
    ? (label || 'No connection')
    : isBusy
    ? (label || 'Analyzing...')
    : (label || '');

  return (
    <svg className="thread-svg-layer">
      {/* Soft glow */}
      <path
        d={pathData}
        className={`thread-glow ${condition ? 'has-condition' : ''} ${isBusy ? 'running' : ''} ${isError ? 'rejected' : ''}`}
      />

      {/* Main clean cable */}
      <path
        d={pathData}
        className={`thread-core ${condition ? 'has-condition' : ''} ${isBusy ? 'running' : ''} ${isError ? 'rejected' : ''}`}
      />

      {/* Port terminal caps */}
      <circle cx={startX} cy={startY} r={4.5} className={`thread-port-glow ${isError ? 'rejected' : ''}`} />
      <circle cx={startX} cy={startY} r={2} className="thread-port-core" />

      {!isLive && (
        <>
          <circle cx={endX} cy={endY} r={4.5} className={`thread-port-glow ${isError ? 'rejected' : ''}`} />
          <circle cx={endX} cy={endY} r={2} className="thread-port-core" />
        </>
      )}

      {/* Interactive Hit Target for selecting and configuring thread */}
      {isInteractive && !isLive && (
        <g
          className="thread-interactive-hit"
          onClick={handleClick}
          onPointerDown={(e) => e.stopPropagation()}
          title={
            isError
              ? 'No connection (Click to delete)'
              : condition
              ? `Condition: ${condition}`
              : displayLabel || 'Click to inspect thread'
          }
        >
          <path
            d={pathData}
            className="thread-hit-path"
            onClick={handleClick}
            onPointerDown={(e) => e.stopPropagation()}
          />
        </g>
      )}
    </svg>
  );
}
