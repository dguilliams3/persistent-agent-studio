/**
 * Z-Score Color Scale Utilities
 *
 * @module tabs/SemanticMonitorTab/utils/colorScales
 * @description Functions for mapping z-scores to visual indicators (colors, classes).
 *
 * Z-scores measure standard deviations from mean. For basin metrics:
 * - |z| < 1: Normal range (~68% of data) - green/success
 * - |z| < 2: Moderate deviation (~95%) - amber/warning
 * - |z| >= 2: Statistical outlier (~5%) - red/danger
 *
 * This module provides both CSS class names (for Tailwind components) and
 * hex color values (for Recharts which requires literal color strings).
 *
 * @upstream Called by:
 *   - components/BasinMetricsCard.jsx - Z-score coloring
 *   - views/TrajectoryView.jsx - Chart point colors
 *   - views/OverviewPanel.jsx - Status indicators
 * @downstream Calls:
 *   - None (pure utility functions)
 */

/**
 * Threshold constants for z-score severity levels
 * Based on standard deviation ranges in normal distribution
 */
export const Z_SCORE_THRESHOLDS = {
  NORMAL: 1,    // Within 1 standard deviation
  WARNING: 2,   // 1-2 standard deviations
  // Beyond 2σ = DANGER
};

/**
 * CSS class names using project's semantic color tokens
 * These map to Tailwind utility classes defined in tailwind.config.js
 *
 * @updated 2026-01-22 - Aligned with Neural Observatory design system
 *   Changed from standard Tailwind (text-success-500) to project semantic tokens
 */
export const Z_SCORE_CLASSES = {
  normal: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-content-secondary',
};

/**
 * Hex color values for charting libraries (Recharts, etc.)
 * These colors match the project's CSS variables for semantic colors
 *
 * @updated 2026-01-22 - Aligned with Neural Observatory design system
 *   Values from src/index.css: --success, --warning, --danger
 */
export const Z_SCORE_COLORS = {
  normal: '#10b981',    // --success: 16, 185, 129 (emerald)
  warning: '#ff9f43',   // --warning: 255, 159, 67 (amber)
  danger: '#ff6b6b',    // --danger: 255, 107, 107 (soft red)
  neutral: '#6e6e8c',   // --text-muted approx (gray)
};

/**
 * @description Maps a z-score to a CSS class name for text coloring
 *
 * @upstream Called by: BasinMetricsCard.jsx, OverviewPanel.jsx
 * @downstream Calls: None
 *
 * @param {number} zScore - The z-score value (can be positive or negative)
 * @returns {string} CSS class name from Z_SCORE_CLASSES
 *
 * @example
 * const className = getZScoreClass(1.5);  // 'text-warning-500'
 * const className = getZScoreClass(-0.5); // 'text-success-500'
 * const className = getZScoreClass(NaN);  // 'text-content-secondary'
 */
export function getZScoreClass(zScore: any) {
  if (!Number.isFinite(zScore)) {
    return Z_SCORE_CLASSES.neutral;
  }

  const magnitude = Math.abs(zScore);

  if (magnitude < Z_SCORE_THRESHOLDS.NORMAL) {
    return Z_SCORE_CLASSES.normal;
  }
  if (magnitude < Z_SCORE_THRESHOLDS.WARNING) {
    return Z_SCORE_CLASSES.warning;
  }
  return Z_SCORE_CLASSES.danger;
}

/**
 * @description Maps a z-score to a hex color value for chart libraries
 *
 * Recharts and similar libraries require literal color values, not CSS classes.
 * This function provides the same semantic mapping as getZScoreClass but returns
 * hex strings.
 *
 * @upstream Called by: TrajectoryView.jsx (Recharts point colors)
 * @downstream Calls: None
 *
 * @param {number} zScore - The z-score value
 * @returns {string} Hex color string (e.g., '#22c55e')
 *
 * @example
 * const fill = getZScoreColor(2.5);  // '#ef4444' (danger)
 * const fill = getZScoreColor(0.8);  // '#22c55e' (normal)
 */
export function getZScoreColor(zScore: any) {
  if (!Number.isFinite(zScore)) {
    return Z_SCORE_COLORS.neutral;
  }

  const magnitude = Math.abs(zScore);

  if (magnitude < Z_SCORE_THRESHOLDS.NORMAL) {
    return Z_SCORE_COLORS.normal;
  }
  if (magnitude < Z_SCORE_THRESHOLDS.WARNING) {
    return Z_SCORE_COLORS.warning;
  }
  return Z_SCORE_COLORS.danger;
}

/**
 * @description Maps a z-score to a severity level string
 *
 * Useful for aria-labels, status messages, and conditional logic.
 *
 * @upstream Called by: views/OverviewPanel.jsx for accessibility labels
 * @downstream Calls: None
 *
 * @param {number} zScore - The z-score value
 * @returns {'normal'|'warning'|'danger'|'unknown'} Severity level string
 *
 * @example
 * const level = getZScoreSeverity(0.5);  // 'normal'
 * const level = getZScoreSeverity(1.8);  // 'warning'
 * const level = getZScoreSeverity(3.2);  // 'danger'
 */
export function getZScoreSeverity(zScore: any) {
  if (!Number.isFinite(zScore)) {
    return 'unknown';
  }

  const magnitude = Math.abs(zScore);

  if (magnitude < Z_SCORE_THRESHOLDS.NORMAL) {
    return 'normal';
  }
  if (magnitude < Z_SCORE_THRESHOLDS.WARNING) {
    return 'warning';
  }
  return 'danger';
}

/**
 * @description Interpolates a color along the z-score gradient
 *
 * For continuous visualizations where discrete buckets aren't sufficient.
 * Uses linear interpolation between green -> amber -> red.
 *
 * @upstream Called by: TrajectoryView.jsx for gradient fills
 * @downstream Calls: None
 *
 * @param {number} zScore - The z-score value (clamped to 0-3 range for interpolation)
 * @returns {string} Interpolated hex color
 *
 * @example
 * const color = interpolateZScoreColor(0);    // Green end
 * const color = interpolateZScoreColor(1);    // Yellow-ish
 * const color = interpolateZScoreColor(2);    // Orange
 * const color = interpolateZScoreColor(3);    // Red end
 */
export function interpolateZScoreColor(zScore: any) {
  if (!Number.isFinite(zScore)) {
    return Z_SCORE_COLORS.neutral;
  }

  // Clamp to 0-3 range for interpolation
  const magnitude = Math.min(Math.abs(zScore), 3);

  // Simple 3-stop gradient: green (0) -> amber (1.5) -> red (3)
  if (magnitude <= 1.5) {
    // Green to amber interpolation
    const t = magnitude / 1.5;
    return lerpColor(Z_SCORE_COLORS.normal, Z_SCORE_COLORS.warning, t);
  } else {
    // Amber to red interpolation
    const t = (magnitude - 1.5) / 1.5;
    return lerpColor(Z_SCORE_COLORS.warning, Z_SCORE_COLORS.danger, t);
  }
}

/**
 * @description Linear interpolation between two hex colors
 *
 * @param {string} color1 - Starting hex color (e.g., '#22c55e')
 * @param {string} color2 - Ending hex color
 * @param {number} t - Interpolation factor (0-1)
 * @returns {string} Interpolated hex color
 */
function lerpColor(color1: any, color2: any, t: any) {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);

  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export default {
  Z_SCORE_THRESHOLDS,
  Z_SCORE_CLASSES,
  Z_SCORE_COLORS,
  getZScoreClass,
  getZScoreColor,
  getZScoreSeverity,
  interpolateZScoreColor,
};
