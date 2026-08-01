/**
 * @module @persistence/ui
 * @description Shared UI package for the persistence platform.
 * Exports design tokens (CSS path + TS constants) and shared components.
 *
 * CSS tokens: import '@persistence/ui/tokens.css' in your app entry point
 * TS tokens: import { surfaceColors, accentColors, ... } from '@persistence/ui'
 * Components: import { PersonaSelector } from '@persistence/ui'
 *
 * @upstream Consumed by: apps/web
 * @downstream Re-exports from: ./tokens (color constants, spacing, utility functions),
 *   ./PersonaSelector (pure presentational dropdown component)
 * @pattern barrel-reexport — this file contains no logic; all logic lives in source modules
 * @antipattern Do NOT add logic or new exports here without a corresponding source module
 */

export {
  surfaceColors,
  accentColors,
  textColors,
  borderColors,
  bubbleColors,
  meterColors,
  semanticColors,
  spacing,
  radius,
  duration,
} from './tokens.js';

export { PersonaSelector } from './PersonaSelector.js';

export type { PersonaSelectorItem } from './PersonaSelector.js';
