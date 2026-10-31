import './DotGridCanvas.css';

export default function DotGridCanvas({ children }) {
  return (
    <div className="canvas-viewport">
      {/* Node-Editor Style Dot Grid */}
      <div className="dot-grid-matrix" />

      {/* Ambient Blue & White Glow Orbs */}
      <div className="ambient-glow glow-primary" />
      <div className="ambient-glow glow-secondary" />

      {children}
    </div>
  );
}
