/**
 * @module tokens
 * @description TypeScript constants matching the CSS custom properties
 * defined in tokens.css. Useful for computed styles, conditional logic,
 * and any context where CSS variables are not accessible.
 *
 * @antipattern Do NOT define values here that differ from tokens.css.
 *   These must stay in sync — tokens.css is the source of truth.
 *
 * @upstream Consumed by: PersonaSelector, future shared components
 * @downstream References: tokens.css variable names
 */

/**
 * Surface color tokens — elevation hierarchy.
 * "Breathing dark" — cozy dim lighting, not a server rack.
 */
export const surfaceColors = {
  background: '#252830',
  surface: '#303440',
  surfaceRaised: '#363c4a',
} as const;

/** Accent color tokens — soft steel-blue */
export const accentColors = {
  accent: '#5078a8',
  accentLight: '#6898c0',
} as const;

/** Text color tokens */
export const textColors = {
  primary: '#eaedf5',
  secondary: '#8898b8',
  muted: '#5a7898',
} as const;

/** Border color tokens */
export const borderColors = {
  border: '#363c4a',
  borderSubtle: '#2e3440',
} as const;

/** Chat bubble color tokens */
export const bubbleColors = {
  userBubble: accentColors.accent,
  personaBubble: surfaceColors.surface,
} as const;

/** Meter color tokens — one per meter, matching tokens.css */
export const meterColors = {
  aliveness: '#e07850',
  curiosity: '#50a8e0',
  connection: '#a070d0',
  ease: '#e0a850',
  delight: '#e070a0',
  anxiety: '#e05870',
  activity: '#50c080',
} as const;

/** Semantic color tokens */
export const semanticColors = {
  success: '#50c080',
  warning: '#e0a050',
  danger: '#e05050',
} as const;

/** Spacing scale in rem */
export const spacing = {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.5rem',
} as const;

/** Border radius scale in rem */
export const radius = {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
} as const;

/** Transition duration tokens */
export const duration = {
  fast: '150ms',
  normal: '200ms',
  slow: '300ms',
} as const;
