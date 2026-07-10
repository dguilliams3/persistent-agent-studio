/**
 * Summary Split Logic
 *
 * @module @persistence/memory/context/stats/split-summaries
 * @description Splits summaries by tier and boundary into categories.
 *
 * This is the SINGLE SOURCE OF TRUTH for summary categorization.
 * Both context builder and stats API use this function.
 *
 * TIER SEMANTICS:
 * - Tier 2 (PROMOTED): Block 2 - excluded here, handled separately
 * - Tier 3 (PINNED): Block 3 prefix - user manually froze
 * - Tier 4 (DYNAMIC): Split by boundary into auto-rolled (prefix) vs tail
 *
 * @upstream Used by:
 *   - context/builder/build-context.ts - Context assembly
 *   - platforms/cloudflare/src/services/summary-config.js - Stats API
 * @downstream Calls:
 *   - ../../summarization/formatter - estimateTokens
 */

import type { Summary, SummaryId } from '../../types';
import type { SummarySplitResult, SplitSummariesOptions } from '../types';
import { estimateTokens as defaultEstimateTokens } from '../../summarization';

/**
 * @description Split summaries by tier and boundary into pinned, auto-rolled, and tail.
 *
 * This function implements the core categorization logic:
 * 1. Exclude promoted summaries (tier 2) - they go in Block 2
 * 2. Tier 3 (pinned) always go to prefix
 * 3. Tier 4 (dynamic) split by boundary ID:
 *    - At or before boundary → auto-rolled (prefix)
 *    - After boundary → tail
 *
 * @upstream Called by: build-context.ts, summary-config.js
 * @downstream Calls: estimateTokens()
 *
 * @param summaries - All summaries to split (should be sorted by position/id)
 * @param options - Configuration options
 * @returns Split result with arrays and stats
 *
 * @example
 * const result = splitSummariesByTierAndBoundary(summaries, {
 *   promotedIds: new Set([1, 2, 3]),
 *   boundaryId: 288
 * });
 * // result.pinned = summaries with tier 3
 * // result.autoRolled = tier 4 summaries at/before boundary 288
 * // result.tail = tier 4 summaries after boundary 288
 * // result.prefix = [...pinned, ...autoRolled]
 */
export function splitSummariesByTierAndBoundary(
  summaries: Summary[],
  options: SplitSummariesOptions = {}
): SummarySplitResult {
  const {
    promotedIds = new Set<SummaryId>(),
    boundaryId = null,
    estimateTokens = defaultEstimateTokens
  } = options;

  // Filter out promoted summaries (they go in Block 2)
  const nonPromoted = summaries.filter(s => !promotedIds.has(s.id));

  // TIER 3 (PINNED): Always go to Block 3 prefix, regardless of boundary
  // User explicitly chose to freeze these via UI
  const pinned = nonPromoted.filter(s => s.tier === 3);

  // TIER 4 (DYNAMIC): Boundary system decides Block 3 (auto-rolled) vs Block 4 (tail)
  const dynamic = nonPromoted.filter(s => s.tier === 4);

  // Use boundary ID as numeric cutoff for dynamic summaries
  // Even if the boundary ID itself isn't in tier-4 (e.g., it was pinned),
  // we still split tier-4 summaries by comparing their IDs to the boundary
  let autoRolled: Summary[] = [];
  let tail: Summary[] = [];

  if (boundaryId !== null) {
    // Cast to number for comparison (handles both number and branded number types)
    const boundaryNum = Number(boundaryId);
    // Summaries with id <= boundaryId go to prefix (auto-rolled)
    autoRolled = dynamic.filter(s => Number(s.id) <= boundaryNum);
    // Summaries with id > boundaryId go to tail
    tail = dynamic.filter(s => Number(s.id) > boundaryNum);
  } else {
    // No boundary set - all dynamic go to tail
    tail = dynamic;
  }

  // Combine: Pinned first (user choice), then auto-rolled (boundary system)
  const prefix: Summary[] = [...pinned, ...autoRolled];

  // Calculate token counts
  const getTokens = (s: Summary) => {
    // Prefer stored token_count if available
    if (s.token_count && typeof s.token_count === 'number') {
      return s.token_count;
    }
    // Fall back to estimation from summary text
    return estimateTokens(s.summary || '');
  };

  const pinnedTokens = pinned.reduce((sum, s) => sum + getTokens(s), 0);
  const autoRolledTokens = autoRolled.reduce((sum, s) => sum + getTokens(s), 0);
  const tailTokens = tail.reduce((sum, s) => sum + getTokens(s), 0);

  return {
    pinned,
    autoRolled,
    tail,
    prefix,
    stats: {
      pinnedCount: pinned.length,
      pinnedTokens,
      autoRolledCount: autoRolled.length,
      autoRolledTokens,
      tailCount: tail.length,
      tailTokens,
      totalCount: nonPromoted.length,
      totalTokens: pinnedTokens + autoRolledTokens + tailTokens
    }
  };
}
