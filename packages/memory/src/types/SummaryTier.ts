/**
 * What tier/block the summary lives in.
 * Determines visibility in context and Anthropic cache block assignment.
 *
 * NUMERIC TIERS (stored in DB, match BLOCK constants):
 * - 2 (BLOCK.PROMOTED): Block 2 — pinned, rarely changes, best cache hits
 * - 3 (BLOCK.STABLE):   Cached Block — changes infrequently
 * - 4 (BLOCK.FRESH):    Dynamic Tail — changes frequently
 * - 'archived':         RAG Archive — not in context, semantic search only
 *
 * @pattern Store NUMBERS in DB (2, 3, 4) to match BLOCK constants.
 * @pattern Use 'archived' string only for summaries not in any cache block.
 * @antipattern Do NOT use string names ('promoted', 'cached', 'tail') in DB.
 * @antipattern Do NOT use separate boolean flags (e.g., promoted_to_block2).
 */
export type SummaryTier = 2 | 3 | 4 | 'archived';

/**
 * Sort order for tiers (lower = earlier in context).
 *
 * @pattern Numbers match BLOCK constants for cache optimization.
 */
export const TIER_SORT_ORDER: Record<SummaryTier, number> = {
  2: 0,            // BLOCK.PROMOTED — first in context
  3: 1,            // BLOCK.STABLE — middle
  4: 2,            // BLOCK.FRESH — last in context
  'archived': 999, // Not in context
};
