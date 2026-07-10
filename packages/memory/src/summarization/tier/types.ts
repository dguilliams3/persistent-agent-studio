/**
 * Tier Types for Summarization
 *
 * @module @persistence/memory/summarization/tier/types
 * @description Type definitions for the summary tier system.
 *
 * The tier system manages summary visibility and cache efficiency using
 * explicit block numbers that map directly to Anthropic cache positions:
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  BLOCK 2 (PROMOTED)                                   [RARELY CHANGES]  │
 * │  - Pinned/promoted summaries in Anthropic's cache                       │
 * │  - Stable across cycles → cache hits → cheaper                          │
 * │  - Manually promoted important summaries                                │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                    ↓
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  BLOCK 3 (STABLE)                                     [DAILY CHANGES]   │
 * │  - Most summaries live here                                             │
 * │  - Changes daily as new summaries are created                           │
 * │  - Learned, questions, notebook content                                 │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                    ↓
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  BLOCK 4 (FRESH)                                      [EVERY CYCLE]     │
 * │  - Recent summaries, RAG results                                        │
 * │  - Growing buffer awaiting stabilization                                │
 * │  - Still in active context (Claude sees them)                           │
 * │  - Auto-triggers metasummarize when too large                           │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                    ↓
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  'archived' (RAG Archive)                             [NOT IN CONTEXT]  │
 * │  - Summaries moved by metasummarize or manual action                    │
 * │  - NOT in active context (Claude doesn't see them directly)             │
 * │  - Still searchable via RAG/embeddings                                  │
 * │  - Soft-deleted with lineage tracking (replaced_by_id)                  │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * @upstream Used by: tier/transitions.ts, summarization service
 * @downstream Uses: ../../types.ts for core types
 */

// ============================================================================
// CORE TYPES (imported from canonical source)
// ============================================================================

// Import and re-export core tier types
export type { SummaryTier, ContextBlock } from '../../types';
export { BLOCK, TIER_SORT_ORDER, isValidTransition, VALID_TRANSITIONS, isInContext } from '../../types';

// For local use in this file
import type { SummaryTier } from '../../types';
import { BLOCK } from '../../types';

/**
 * Tier configuration for a persona.
 */
export interface TierConfig {
  /** Maximum tokens in cached tier before rolling */
  cachedTokenThreshold: number;

  /** Target tokens for cached tier after rolling */
  cachedTokenTarget: number;

  /** Maximum tokens in tail tier before auto-metasummarize */
  tailTokenThreshold: number;

  /** Target tokens for tail tier after metasummarize */
  tailTokenTarget: number;

  /** Minimum summaries to keep in each tier */
  minSummariesPerTier: number;

  /** Whether auto-metasummarize is enabled */
  autoMetaEnabled: boolean;

  /** Minimum summaries required for metasummarize */
  minMetaConsolidateCount: number;
}

/**
 * Default tier configuration values.
 */
export const DEFAULT_TIER_CONFIG: TierConfig = {
  cachedTokenThreshold: 4000,
  cachedTokenTarget: 2000,
  tailTokenThreshold: 6000,
  tailTokenTarget: 3000,
  minSummariesPerTier: 2,
  autoMetaEnabled: true,
  minMetaConsolidateCount: 2
};

// ============================================================================
// TIER TRANSITIONS (semantic names for transitions)
// ============================================================================

/**
 * Semantic names for tier transitions.
 *
 * These names describe the intent of the transition:
 * - promote: Move "up" toward more cached (3→2, 4→3, 4→2)
 * - demote: Move "down" toward less cached (2→3, 3→4, 2→4)
 * - archive: Remove from context (3→archived, 4→archived)
 * - reactivate: Bring back to context (archived→4)
 * - stabilize: Move from fresh to stable (4→3)
 *
 * @note The actual validity of transitions is defined in ../../types.ts VALID_TRANSITIONS
 */
export type TierTransitionName =
  | 'promote'    // Move up: 3→2, 4→2
  | 'demote'     // Move down: 2→3, 2→4, 3→4
  | 'stabilize'  // Fresh to stable: 4→3
  | 'archive'    // Remove from context: 3/4→archived
  | 'reactivate'; // Bring back: archived→4

/**
 * Get the semantic name for a tier transition.
 *
 * @param from - Current tier
 * @param to - Target tier
 * @returns Transition name or null if invalid
 *
 * @example
 * getTransitionName(BLOCK.STABLE, BLOCK.PROMOTED) // → 'promote'
 * getTransitionName(BLOCK.FRESH, BLOCK.STABLE)    // → 'stabilize'
 * getTransitionName(BLOCK.STABLE, 'archived')     // → 'archive'
 */
export function getTransitionName(from: SummaryTier, to: SummaryTier): TierTransitionName | null {
  // Promotion: moving up to a lower block number (more cached)
  if (to === BLOCK.PROMOTED && (from === BLOCK.STABLE || from === BLOCK.FRESH)) return 'promote';

  // Stabilize: specifically fresh→stable
  if (from === BLOCK.FRESH && to === BLOCK.STABLE) return 'stabilize';

  // Demotion: moving down to a higher block number (less cached)
  if (from === BLOCK.PROMOTED && (to === BLOCK.STABLE || to === BLOCK.FRESH)) return 'demote';
  if (from === BLOCK.STABLE && to === BLOCK.FRESH) return 'demote';

  // Archive: remove from context
  if (to === 'archived' && typeof from === 'number') return 'archive';

  // Reactivate: bring back from archive to fresh
  if (from === 'archived' && to === BLOCK.FRESH) return 'reactivate';

  return null;
}

/**
 * Result of a tier transition operation.
 */
export interface TierTransitionResult {
  /** Whether the transition succeeded */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Previous tier */
  fromTier: SummaryTier;

  /** New tier */
  toTier: SummaryTier;

  /** New tier position (if set) */
  position?: number | null;

  /** Database changes count */
  changes?: number;
}

// ============================================================================
// BOUNDARY TRACKING
// ============================================================================

/**
 * Tier boundary state stored in the state table.
 *
 * These boundaries define where the split happens between tiers.
 * They're stored as state keys and shift when thresholds are exceeded.
 */
export interface TierBoundaryState {
  /** ID of last summary in cached tier (all before this are cached) */
  cachedBoundaryId: number | null;

  /** ID of last summary in tail tier (all before this are tail) */
  tailBoundaryId: number | null;

  /** Current token count in cached tier */
  cachedTokenCount: number;

  /** Current token count in tail tier */
  tailTokenCount: number;

  /** When boundaries were last recalculated */
  lastRecalculated: Date;
}

/**
 * State keys for tier boundary tracking.
 */
export const TIER_STATE_KEYS = {
  CACHED_BOUNDARY_ID: 'summary_cached_boundary_id',
  TAIL_BOUNDARY_ID: 'summary_tail_boundary_id',
  CACHED_TOKEN_COUNT: 'summary_cached_tokens',
  TAIL_TOKEN_COUNT: 'summary_tail_tokens',
  LAST_RECALC: 'summary_boundary_recalc_at'
} as const;

// ============================================================================
// AUTO-METASUMMARIZE TRIGGER
// ============================================================================

/**
 * Conditions that trigger auto-metasummarize.
 */
export interface MetaTriggerConditions {
  /** Tail tier exceeds token threshold */
  tailOverThreshold: boolean;

  /** Active summary count exceeds max */
  summaryCountExceeded: boolean;

  /** Minimum time since last metasummarize passed */
  cooldownPassed: boolean;

  /** All conditions met → should trigger */
  shouldTrigger: boolean;
}

/**
 * Result of checking metasummarize trigger conditions.
 */
export interface MetaTriggerCheck {
  /** Whether metasummarize should run */
  shouldRun: boolean;

  /** Why it should or shouldn't run */
  reason: string;

  /** Current conditions */
  conditions: MetaTriggerConditions;

  /** Current metrics */
  metrics: {
    tailTokens: number;
    activeSummaryCount: number;
    lastMetaAt: Date | null;
  };
}
