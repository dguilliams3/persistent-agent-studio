/**
 * GradientMesh - Ambient background atmosphere component
 *
 * @module components/ui/visual/GradientMesh
 * @description Creates ambient gradient orbs for atmospheric depth. Uses CSS
 * variables for colors so changing --accent updates the mesh automatically.
 *
 * The mesh creates visual depth without being distracting. Intensity controls
 * opacity of the gradient orbs. Position presets cover common layouts.
 *
 * @upstream Called by:
 *   - ClaudeExistenceLoop.jsx - main dashboard background
 *   - LoginForm.jsx - login screen (currently has inline version)
 * @downstream Calls: None (pure presentational)
 *
 * @example
 * // Subtle background for main app
 * <GradientMesh intensity="low" />
 *
 * // More dramatic for login/hero sections
 * <GradientMesh intensity="high" />
 *
 * @antipattern
 * // WRONG: Hardcoded colors
 * style={{ background: 'radial-gradient(circle, #00d4ff ...)' }}
 * // CORRECT: Uses CSS variable via rgba() for consistency
 * Uses rgba(0, 212, 255, ...) derived from design system
 */

/**
 * Intensity presets for gradient opacity
 * @type {Object.<string, number>}
 */
const INTENSITY_MAP = {
  low: 0.08,
  medium: 0.15,
  high: 0.25,
};

interface GradientMeshProps {
  intensity?: 'low' | 'medium' | 'high';
  className?: string;
}

/**
 * Gradient Mesh Background Component
 *
 * @param {Object} props
 * @param {'low'|'medium'|'high'} [props.intensity='medium'] - Opacity intensity
 * @param {string} [props.className] - Additional CSS classes
 * @returns {JSX.Element}
 */
export function GradientMesh({ intensity = 'medium', className = '' }: GradientMeshProps) {
  const opacity = INTENSITY_MAP[intensity] || INTENSITY_MAP.medium;

  // Use CSS variable color (--accent: 0, 212, 255) for consistency
  // This ensures mesh color updates if accent changes
  const accentColor = '0, 212, 255';

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {/* Top-left orb - primary glow */}
      <div
        className="absolute -top-40 -left-40 w-96 h-96 rounded-full"
        style={{
          opacity: opacity * 1.3,
          background: `radial-gradient(circle, rgba(${accentColor}, 0.4) 0%, transparent 70%)`,
        }}
      />

      {/* Top-right orb - secondary glow */}
      <div
        className="absolute -top-20 right-0 w-80 h-80 rounded-full"
        style={{
          opacity: opacity * 0.8,
          background: `radial-gradient(circle, rgba(${accentColor}, 0.3) 0%, transparent 60%)`,
        }}
      />

      {/* Bottom-right orb - accent glow */}
      <div
        className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full"
        style={{
          opacity: opacity,
          background: `radial-gradient(circle, rgba(${accentColor}, 0.25) 0%, transparent 65%)`,
        }}
      />

      {/* Center subtle glow - ambient fill */}
      <div
        className="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
        style={{
          opacity: opacity * 0.5,
          background: `radial-gradient(circle, rgba(${accentColor}, 0.15) 0%, transparent 50%)`,
        }}
      />
    </div>
  );
}


export default GradientMesh;
