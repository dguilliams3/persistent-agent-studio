/**
 * Tier transition definitions and validation.
 *
 * Allowed transitions:
 *   3 -> 2 (STABLE -> PROMOTED):     Promote stable summary to cached tier
 *   4 -> 3 (FRESH -> STABLE):        Stabilize recent summary
 *   3 -> 4 (STABLE -> FRESH):        Demote to dynamic tier
 *   2 -> 3 (PROMOTED -> STABLE):     Demote from promoted
 *   3 -> archived:                   Archive from stable
 *   4 -> archived:                   Archive from fresh
 *   archived -> 4:                   Reactivate to fresh tier
 *
 * NOT allowed:
 *   archived -> 2/3 (must reactivate to 4 first)
 *   2 -> archived (must demote to 3/4 first — promoted means "keep visible")
 *   Any -> 1 (block 1 is system content, not for summaries)
 *   1 -> Any (block 1 doesn't contain summaries)
 */
import type { SummaryTier } from './SummaryTier';

export interface TierTransition {
  from: SummaryTier;
  to: SummaryTier;
}

export const VALID_TRANSITIONS: TierTransition[] = [
  // Promotions (moving "up" toward more cached)
  { from: 3, to: 2 },           // STABLE -> PROMOTED
  { from: 4, to: 3 },           // FRESH -> STABLE
  { from: 4, to: 2 },           // FRESH -> PROMOTED (skip stable)

  // Demotions (moving "down" toward less cached)
  { from: 2, to: 3 },           // PROMOTED -> STABLE
  { from: 3, to: 4 },           // STABLE -> FRESH
  { from: 2, to: 4 },           // PROMOTED -> FRESH (skip stable)

  // Archival (remove from context)
  { from: 3, to: 'archived' },  // STABLE -> archived
  { from: 4, to: 'archived' },  // FRESH -> archived

  // Reactivation (bring back to context)
  { from: 'archived', to: 4 },  // archived -> FRESH
];

/**
 * Check if a tier transition is valid.
 *
 * @param from - Current tier
 * @param to - Target tier
 * @returns True if transition is allowed
 */
export function isValidTransition(from: SummaryTier, to: SummaryTier): boolean {
  if (from === to) return false;  // No-op
  return VALID_TRANSITIONS.some(transition => transition.from === from && transition.to === to);
}
