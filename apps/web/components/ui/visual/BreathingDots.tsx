/**
 * BreathingDots - Animated status indicator
 *
 * @module components/ui/visual/BreathingDots
 * @description Pulsing dots that indicate active/running state. Uses the
 * breathing animation from the design system (CSS variable --breath-duration).
 *
 * The dots pulse in sequence with staggered delays to create a "breathing"
 * effect. Useful for showing that something is alive/running.
 *
 * @upstream Called by:
 *   - ClaudeExistenceLoop.jsx - header running indicator
 *   - LoginForm.jsx - logo animation (currently has inline version)
 * @downstream Calls: None (pure presentational)
 *
 * @example
 * // Default 3 dots for running indicator
 * <BreathingDots />
 *
 * // Small size for inline use
 * <BreathingDots size="sm" />
 *
 * // Only show when running
 * {isRunning && <BreathingDots />}
 *
 * @antipattern
 * // WRONG: Hardcoded animation-delay values
 * style={{ animationDelay: '150ms' }}
 * // CORRECT: Use consistent stagger pattern
 */

/**
 * Size presets for dots
 * @type {Object.<string, {dot: string, gap: string, middle: string}>}
 */
const SIZE_MAP = {
  sm: { dot: 'w-2 h-2', gap: 'gap-1.5', middle: 'w-2.5 h-2.5' },
  md: { dot: 'w-3 h-3', gap: 'gap-2', middle: 'w-4 h-4' },
  lg: { dot: 'w-4 h-4', gap: 'gap-2.5', middle: 'w-5 h-5' },
};

interface BreathingDotsProps {
  size?: 'sm' | 'md' | 'lg';
  count?: number;
  className?: string;
}

/**
 * Breathing Dots Status Indicator
 *
 * @param {Object} props
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Dot size preset
 * @param {number} [props.count=3] - Number of dots (1-5)
 * @param {string} [props.className] - Additional CSS classes
 * @returns {JSX.Element}
 */
export function BreathingDots({ size = 'md', count = 3, className = '' }: BreathingDotsProps) {
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md;
  const clampedCount = Math.min(5, Math.max(1, count));

  // Create array of dots with staggered delays
  const dots = Array.from({ length: clampedCount }, (_, i) => {
    // Middle dot is slightly larger for visual interest
    const isMiddle = clampedCount >= 3 && i === Math.floor(clampedCount / 2);
    const dotSize = isMiddle ? sizeClasses.middle : sizeClasses.dot;

    // Stagger animation delay - 150ms between each dot
    const delay = i * 0.15;

    return (
      <div
        key={i}
        className={`${dotSize} rounded-full bg-cyan-400 breathing-dot`}
        style={{ animationDelay: `${delay}s` }}
      />
    );
  });

  return (
    <div
      className={`flex items-center ${sizeClasses.gap} ${className}`}
      role="status"
      aria-label="Active"
    >
      {dots}
    </div>
  );
}


export default BreathingDots;
