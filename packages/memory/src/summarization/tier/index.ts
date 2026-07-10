/**
 * Summary Tier System
 *
 * @module @persistence/tools/definitions/summarize/tier
 * @description Barrel export for tier constants, types, and transition logic.
 *
 * The tier system manages where summaries live in Claude's context:
 *
 * CACHED (Block 2) → TAIL (Block 4) → ARCHIVED (RAG only)
 *
 * USAGE:
 * ```typescript
 * import {
 *   SummaryTier,
 *   isValidTransition,
 *   shouldTriggerMetasummarize,
 *   DEFAULT_TIER_CONFIG
 * } from '@persistence/tools/definitions/summarize/tier';
 *
 * // Validate transition
 * if (isValidTransition('tail', 'cached')) {
 *   await promoteSummary(id);
 * }
 *
 * // Check if auto-meta should run
 * const check = shouldTriggerMetasummarize({ tailTokens, activeSummaryCount, lastMetaAt });
 * if (check.shouldRun) {
 *   await runMetasummarize();
 * }
 * ```
 *
 * @upstream Used by: summarization service, routes
 * @downstream Aggregates: tier modules
 */

// Types
export type {
  SummaryTier,
  TierTransitionName,
  TierConfig,
  TierTransitionResult,
  TierBoundaryState,
  MetaTriggerConditions,
  MetaTriggerCheck
} from './types';

// Re-export for backward compatibility
export type { TierTransitionName as TierTransition } from './types';

// Constants (TIER_SORT_ORDER and VALID_TRANSITIONS now come from core types)
export {
  TIER_SORT_ORDER,
  VALID_TRANSITIONS,
  isValidTransition as coreIsValidTransition
} from './types';

export {
  DEFAULT_TIER_CONFIG,
  TIER_STATE_KEYS,
  getTransitionName
} from './types';

// Transition functions
export {
  isValidTransition,
  getTransitionType,
  validateTransition,
  computeDefaultPosition,
  normalizePositions,
  shouldTriggerMetasummarize,
  computeBoundaryIndex,
  shouldShiftBoundary
} from './transitions';
