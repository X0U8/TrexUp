import { getNodeResolvedDimensions } from '../../utils/treeLayout';
import './Thread.css';

const getNodeBox = (node, isWorkflow = false) => {
  if (!node) return { width: 175, height: 56, x: 0, y: 0 };

  const isWf =
    isWorkflow ||
    node.type === 'engine' ||
    node.type === 'agent' ||
    (node.type === 'input' && !node.category) ||
    (node.type === 'output' && !node.category) ||
    Boolean(node.engineId) ||
    Boolean(node.modelId);

  if (isWf) {
    return {
      width: typeof node.width === 'number' && !Number.isNaN(node.width) ? node.width : 185,
      height: 56,
      x: typeof node.x === 'number' && !Number.isNaN(node.x) ? node.x : 0,
      y: typeof node.y === 'number' && !Number.isNaN(node.y) ? node.y : 0,
    };
  }

  const dims = getNodeResolvedDimensions(node);
  return {
    width: dims.width,
    height: dims.height,
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
  status = 'active', // 'active' | 'analyzing' | 'rejected' | 'completed' | 'failed' | 'running'
  kind = '',
  isRejected = false,
  isAnalyzing = false,
  isManual = false,
  onClickThread,
  onDelete,
  isInteractive = true,
  isRunning = false,
  isWorkflow = false,
}) {
  if (!start || !end) return null;

  const startBox = getNodeBox(start, isWorkflow);
  const endBox = getNodeBox(end, isWorkflow);

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

  const isWorkflowRun = kind === 'workflow_run';
  const isError = isRejected || status === 'rejected' || (isWorkflowRun && status === 'failed');
  const isBusy = isRunning || isAnalyzing || status === 'analyzing' || (isWorkflowRun && status === 'running');
  const wfClass = isWorkflowRun ? `workflow-run wf-status-${status}` : '';

  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClickThread?.(id);
  };

  // Conditions NEVER render as text pills — they are visualized via the elegant darker shade.
  // displayLabel is strictly for exploration relationship labels or rejected/analyzing states.
  const displayLabel = isWorkflowRun
    ? `${label || 'Workflow Run'} (${status})`
    : isError
    ? (label || 'No connection')
    : isBusy
    ? (label || 'Analyzing...')
    : (label || '');

  const midX = 0.125 * startX + 0.375 * cx1 + 0.375 * cx2 + 0.125 * endX;
  const midY = 0.125 * startY + 0.375 * cy1 + 0.375 * cy2 + 0.125 * endY;

  return (
    <svg className="thread-svg-layer">
      {/* Soft glow */}
      <path
        d={pathData}
        className={`thread-glow ${condition ? 'has-condition' : ''} ${isBusy ? 'running' : ''} ${isError ? 'rejected' : ''} ${isManual ? 'is-manual' : ''} ${wfClass}`}
      />

      {/* Main clean cable */}
      <path
        d={pathData}
        className={`thread-core ${condition ? 'has-condition' : ''} ${isBusy ? 'running' : ''} ${isError ? 'rejected' : ''} ${isManual ? 'is-manual' : ''} ${wfClass}`}
      />

      {/* Port terminal caps */}
      <circle cx={startX} cy={startY} r={2.5} className={`thread-port-glow ${isError ? 'rejected' : ''} ${isManual ? 'is-manual' : ''} ${wfClass}`} />
      <circle cx={startX} cy={startY} r={1.2} className="thread-port-core" />

      {!isLive && (
        <>
          <circle cx={endX} cy={endY} r={2.5} className={`thread-port-glow ${isError ? 'rejected' : ''} ${isManual ? 'is-manual' : ''} ${wfClass}`} />
          <circle cx={endX} cy={endY} r={1.2} className="thread-port-core" />
        </>
      )}

      {/* Workflow Run Badge Pill on Thread Curve */}
      {isWorkflowRun && !isLive && (
        <g
          className="thread-wf-badge"
          transform={`translate(${midX}, ${midY})`}
          onClick={handleClick}
          title={displayLabel}
        >
          <circle r={4} className={`thread-wf-dot ${isError ? 'failed' : status === 'running' ? 'running' : 'completed'}`} />
        </g>
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
