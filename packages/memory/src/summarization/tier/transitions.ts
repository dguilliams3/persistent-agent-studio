/**
 * Tier Transition Logic
 *
 * @module @persistence/tools/definitions/summarize/tier/transitions
 * @description Functions for validating and executing tier transitions.
 *
 * This module contains the business logic for tier changes. The actual
 * database operations are in the platform layer - this module just
 * validates and computes what should happen.
 *
 * TRANSITION RULES:
 * - Summaries flow: tail → cached (promotion) or tail → archived (archival)
 * - Archived can be reactivated back to tail (not directly to cached)
 * - Cached can be demoted to tail or archived directly
 *
 * @upstream Used by: summarization service, routes
 * @downstream Uses: tier/types.ts
 */

import type {
  SummaryTier,
  TierTransitionResult,
  TierConfig,
  MetaTriggerCheck,
  MetaTriggerConditions,
  TierTransitionName
} from './types';
import { DEFAULT_TIER_CONFIG, getTransitionName, BLOCK } from './types';
import { isValidTransition as coreIsValidTransition } from '../../types';

// ============================================================================
// TRANSITION VALIDATION
// ============================================================================

/**
 * Validates if a tier transition is allowed.
 *
 * @param fromTier - Current tier
 * @param toTier - Target tier
 * @returns Whether the transition is valid
 *
 * @example
 * ```typescript
 * isValidTransition('tail', 'cached');    // true (promotion)
 * isValidTransition('archived', 'cached'); // false (must go through tail)
 * ```
 */
export function isValidTransition(
  fromTier: SummaryTier,
  toTier: SummaryTier
): boolean {
  return coreIsValidTransition(fromTier, toTier);
}

/**
 * Gets the transition type for a tier change.
 *
 * @param fromTier - Current tier
 * @param toTier - Target tier
 * @returns Transition type or null if invalid
 */
export function getTransitionType(
  fromTier: SummaryTier,
  toTier: SummaryTier
): TierTransitionName | null {
  if (!isValidTransition(fromTier, toTier)) return null;
  return getTransitionName(fromTier, toTier);
}

/**
 * Format a tier for display in error messages.
 */
function formatTier(tier: SummaryTier): string {
  if (tier === 'archived') return 'archived';
  const names: Record<number, string> = {
    [BLOCK.CONSTITUTION]: 'Block 1 (CONSTITUTION)',
    [BLOCK.PROMOTED]: 'Block 2 (PROMOTED)',
    [BLOCK.STABLE]: 'Block 3 (STABLE)',
    [BLOCK.FRESH]: 'Block 4 (FRESH)',
  };
  return names[tier] ?? `Block ${tier}`;
}

/**
 * Validates a transition and returns detailed result.
 *
 * @param fromTier - Current tier
 * @param toTier - Target tier
 * @returns Validation result with error if invalid
 */
export function validateTransition(
  fromTier: SummaryTier,
  toTier: SummaryTier
): { valid: boolean; error?: string; transition?: TierTransitionName } {
  if (fromTier === toTier) {
    return { valid: false, error: 'Summary is already in this tier' };
  }

  const transition = getTransitionType(fromTier, toTier);
  if (!transition) {
    // Build helpful error message with valid targets
    const validTargets: SummaryTier[] = [];
    if (coreIsValidTransition(fromTier, BLOCK.PROMOTED)) validTargets.push(BLOCK.PROMOTED);
    if (coreIsValidTransition(fromTier, BLOCK.STABLE)) validTargets.push(BLOCK.STABLE);
    if (coreIsValidTransition(fromTier, BLOCK.FRESH)) validTargets.push(BLOCK.FRESH);
    if (coreIsValidTransition(fromTier, 'archived')) validTargets.push('archived');

    // Special case error messages
    let hint = '';
    if (fromTier === 'archived' && typeof toTier === 'number' && toTier !== BLOCK.FRESH) {
      hint = 'Archived summaries must be reactivated to Block 4 (FRESH) first.';
    } else if (fromTier === BLOCK.PROMOTED && toTier === 'archived') {
      hint = 'Promoted summaries must be demoted before archiving (they are pinned for a reason).';
    }

    return {
      valid: false,
      error: `Cannot transition from ${formatTier(fromTier)} to ${formatTier(toTier)}. ` +
        (hint || `Valid targets: ${validTargets.map(formatTier).join(', ')}`)
    };
  }

  return { valid: true, transition };
}

// ============================================================================
// POSITION COMPUTATION
// ============================================================================

/**
 * Computes the default position for a summary entering a tier.
 *
 * Position determines order within a tier. Lower = earlier (older content).
 *
 * @param tier - Target tier
 * @param existingPositions - Current positions in that tier
 * @param options - Options for position computation
 * @returns Computed position
 */
export function computeDefaultPosition(
  tier: SummaryTier,
  existingPositions: number[],
  options: {
    /** Where to insert: 'start', 'end', or specific position */
    insertAt?: 'start' | 'end' | number;
    /** Gap to leave between positions (for future insertions) */
    positionGap?: number;
  } = {}
): number {
  const { insertAt = 'end', positionGap = 100 } = options;

  if (existingPositions.length === 0) {
    return positionGap; // First item gets gap value
  }

  const sorted = [...existingPositions].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  if (insertAt === 'start') {
    // Insert before all existing
    return Math.max(1, min - positionGap);
  }

  if (insertAt === 'end') {
    // Insert after all existing
    return max + positionGap;
  }

  if (typeof insertAt === 'number') {
    // Insert at specific position
    return insertAt;
  }

  return max + positionGap;
}

/**
 * Recomputes positions to eliminate gaps after deletions.
 *
 * @param currentPositions - Array of {id, position} objects
 * @param gap - Gap between positions
 * @returns New positions array
 */
export function normalizePositions(
  currentPositions: Array<{ id: number; position: number }>,
  gap: number = 100
): Array<{ id: number; position: number }> {
  // Sort by current position
  const sorted = [...currentPositions].sort((a, b) => a.position - b.position);

  // Assign new positions with consistent gap
  return sorted.map((item, index) => ({
    id: item.id,
    position: (index + 1) * gap
  }));
}

// ============================================================================
// AUTO-METASUMMARIZE TRIGGER
// ============================================================================

/**
 * Checks if auto-metasummarize should be triggered.
 *
 * @param metrics - Current tier metrics
 * @param config - Tier configuration
 * @returns Check result with conditions and recommendation
 */
export function shouldTriggerMetasummarize(
  metrics: {
    tailTokens: number;
    activeSummaryCount: number;
    lastMetaAt: Date | null;
  },
  config: TierConfig = DEFAULT_TIER_CONFIG
): MetaTriggerCheck {
  const { tailTokens, activeSummaryCount, lastMetaAt } = metrics;

  // Check each condition
  const tailOverThreshold = tailTokens > config.tailTokenThreshold;
  const summaryCountExceeded =
    activeSummaryCount > config.minSummariesPerTier * 2 + config.minMetaConsolidateCount;

  // Cooldown: at least 5 minutes between auto-meta operations
  const COOLDOWN_MS = 5 * 60 * 1000;
  const cooldownPassed =
    !lastMetaAt || Date.now() - lastMetaAt.getTime() > COOLDOWN_MS;

  // Auto-meta must be enabled
  const conditions: MetaTriggerConditions = {
    tailOverThreshold,
    summaryCountExceeded,
    cooldownPassed,
    shouldTrigger:
      config.autoMetaEnabled &&
      (tailOverThreshold || summaryCountExceeded) &&
      cooldownPassed
  };

  // Build reason string
  let reason: string;
  if (!config.autoMetaEnabled) {
    reason = 'Auto-metasummarize is disabled';
  } else if (!cooldownPassed) {
    reason = 'Cooldown period has not passed';
  } else if (conditions.shouldTrigger) {
    const reasons: string[] = [];
    if (tailOverThreshold)
      reasons.push(`tail tokens (${tailTokens}) exceed threshold (${config.tailTokenThreshold})`);
    if (summaryCountExceeded)
      reasons.push(`summary count (${activeSummaryCount}) is high`);
    reason = `Should run: ${reasons.join(', ')}`;
  } else {
    reason = 'No trigger conditions met';
  }

  return {
    shouldRun: conditions.shouldTrigger,
    reason,
    conditions,
    metrics
  };
}

// ============================================================================
// TIER BOUNDARY COMPUTATION
// ============================================================================

/**
 * Computes where the boundary should be for a given token target.
 *
 * This is used to determine which summaries go in cached vs tail tier.
 * The boundary is the ID of the last summary in the cached tier.
 *
 * @param summaries - Array of summaries sorted by position/date
 * @param tokenTarget - Target token count for the tier
 * @returns Index of the boundary summary, or -1 if no split needed
 */
export function computeBoundaryIndex(
  summaries: Array<{ id: number; tokenCount: number }>,
  tokenTarget: number
): number {
  if (summaries.length === 0) return -1;

  let cumulativeTokens = 0;
  for (let i = 0; i < summaries.length; i++) {
    cumulativeTokens += summaries[i].tokenCount;
    if (cumulativeTokens >= tokenTarget) {
      return i;
    }
  }

  // All summaries fit within target
  return summaries.length - 1;
}

/**
 * Determines if boundary should shift based on current state.
 *
 * @param currentState - Current tier metrics
 * @param config - Tier configuration
 * @returns Whether boundary should shift and in which direction
 */
export function shouldShiftBoundary(
  currentState: {
    cachedTokens: number;
    tailTokens: number;
  },
  config: TierConfig = DEFAULT_TIER_CONFIG
): { shouldShift: boolean; direction: 'forward' | 'backward' | null; reason: string } {
  const { cachedTokens, tailTokens } = currentState;

  // If tail exceeds threshold, need to shift boundary forward
  // (more summaries go to cached, fewer in tail)
  if (tailTokens > config.tailTokenThreshold) {
    return {
      shouldShift: true,
      direction: 'forward',
      reason: `Tail tokens (${tailTokens}) exceed threshold (${config.tailTokenThreshold})`
    };
  }

  // If cached is way over and tail has room, might shift backward
  // (This is rare - we usually don't want to uncache things)
  if (cachedTokens > config.cachedTokenThreshold * 1.5 && tailTokens < config.tailTokenTarget * 0.5) {
    return {
      shouldShift: true,
      direction: 'backward',
      reason: `Cached is very high (${cachedTokens}) and tail has room`
    };
  }

  return {
    shouldShift: false,
    direction: null,
    reason: 'Token counts within acceptable ranges'
  };
}
