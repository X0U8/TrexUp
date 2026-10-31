import './Thread.css';

export default function Thread({ start, end }) {
  if (!start || !end) return null;

  // Calculate connection anchor ports (e.g. from right of start node to left of end node, or dynamically oriented)
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
      <defs>
        <linearGradient id="thread-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#93c5fd" />
        </linearGradient>
      </defs>

      {/* Ambient glow beneath thread */}
      <path d={pathData} className="thread-glow" />

      {/* Main cable thread */}
      <path d={pathData} className="thread-core" />

      {/* Subtle animated energy flow dash */}
      <path d={pathData} className="thread-flow" />

      {/* Port terminal caps */}
      <circle cx={startX} cy={startY} r={5} className="thread-port-glow" />
      <circle cx={startX} cy={startY} r={2.5} className="thread-port-core" />

      <circle cx={endX} cy={endY} r={5} className="thread-port-glow" />
      <circle cx={endX} cy={endY} r={2.5} className="thread-port-core" />
    </svg>
  );
}
