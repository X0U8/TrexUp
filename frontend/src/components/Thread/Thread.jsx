import './Thread.css';

export default function Thread({ start, end }) {
  if (!start || !end) return null;

  // Calculate connection anchor ports
  const isStartLeft = start.x + start.width / 2 < end.x + end.width / 2;

  const startX = isStartLeft ? start.x + start.width : start.x;
  const startY = start.y + start.height / 2;

  const endX = isStartLeft ? end.x : end.x + end.width;
  const endY = end.y + end.height / 2;

  // Calculate dynamic bezier curve control offsets
  const dx = Math.abs(endX - startX);
  const curvature = Math.max(dx * 0.45, 60);

  const cx1 = isStartLeft ? startX + curvature : startX - curvature;
  const cy1 = startY;

  const cx2 = isStartLeft ? endX - curvature : endX + curvature;
  const cy2 = endY;

  const pathData = `M ${startX} ${startY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${endX} ${endY}`;

  return (
    <svg className="thread-svg-layer">
      {/* Soft muted grey glow */}
      <path d={pathData} className="thread-glow" />

      {/* Main clean grey cable */}
      <path d={pathData} className="thread-core" />

      {/* Port terminal caps */}
      <circle cx={startX} cy={startY} r={4.5} className="thread-port-glow" />
      <circle cx={startX} cy={startY} r={2} className="thread-port-core" />

      <circle cx={endX} cy={endY} r={4.5} className="thread-port-glow" />
      <circle cx={endX} cy={endY} r={2} className="thread-port-core" />
    </svg>
  );
}
