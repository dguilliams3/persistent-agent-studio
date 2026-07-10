/**
 * Cache Boundary Management
 *
 * @module @persistence/memory/context/cache/boundary
 * @description Pure functions for calculating stable cache boundaries.
 *
 * PROBLEM: Dynamic splits invalidate cache every cycle
 * - If we always split at "last 25% of entries", the prefix changes constantly
 * - Every new entry invalidates the cache = expensive cache writes every cycle
 *
 * SOLUTION: Stable boundary tracking with threshold-based shifting
 * - Track a "boundary ID" (entry/summary ID) that rarely changes
 * - Only shift the boundary when tail grows too large (token-based threshold)
 * - This gives us ~N cache hits before paying for invalidation
 *
 * EXAMPLE (historyTailTokenTarget=6K, threshold=12K):
 * - Cycle 1: Set boundary at entry 100, tail=22-30 (~6K tokens)
 * - Cycles 2-10: Boundary stays at 100, tail grows to 22-40 (~11K tokens)
 * - Cycle 11: Tail hits 12K tokens, shift boundary to 130 (new tail=31-40, ~6K)
 * - Cache invalidated ONCE for 10+ cycles of hits
 *
 * @upstream Used by:
 *   - platforms/cloudflare/src/prompts/build-system-prompt.js - During migration
 *   - context/builder/ - Will use after extraction complete
 * @downstream Calls:
 *   - None (pure logic, no I/O)
 */

import type { HistoryEntry, Summary, HistoryId, SummaryId } from '../../types';
import type {
  CacheConfig,
  HistoryBoundaryResult,
  SummaryBoundaryResult
} from '../types';

// ============================================================================
// TOKEN ESTIMATION
// ============================================================================

/**
 * Estimate token count for a history entry.
 *
 * Uses stored token_count if available, otherwise rough approximation
 * (~4 chars per token for English text).
 *
 * @description Quickly estimates token count for boundary calculations
 * @upstream Called by: calculateHistoryBoundary()
 * @downstream Calls: None (pure logic)
 *
 * @param {HistoryEntry} entry - History entry to estimate
 * @returns {number} Estimated token count
 *
 * @example
 * const tokens = estimateHistoryTokens(entry);
 * console.log(`Entry uses ~${tokens} tokens`);
 */
export function estimateHistoryTokens(entry: HistoryEntry): number {
  if ('token_count' in entry && entry.token_count) {
    return entry.token_count as number;
  }
  const content = entry?.content || '';
  return Math.ceil(content.length / 4);
}

/**
 * Estimate token count for a summary.
 *
 * Uses stored token_count if available, otherwise rough approximation
 * from summary length.
 *
 * @description Quickly estimates token count for summary boundary calculations
 * @upstream Called by: calculateSummaryBoundary()
 * @downstream Calls: None (pure logic)
 *
 * @param {Summary} summary - Summary to estimate
 * @returns {number} Estimated token count
 *
 * @example
 * const tokens = estimateSummaryTokens(summary);
 * console.log(`Summary uses ~${tokens} tokens`);
 */
export function estimateSummaryTokens(summary: Summary): number {
  if ('token_count' in summary && summary.token_count) {
    return summary.token_count as number;
  }
  return summary?.summary ? Math.ceil(summary.summary.length / 4) : 0;
}

// ============================================================================
// HISTORY BOUNDARY CALCULATION
// ============================================================================

/**
 * Calculate stable boundary for history prefix/tail split.
 *
 * ALGORITHM:
 * 1. If no boundary exists, initialize by working backwards from end
 * 2. If tail exceeds threshold AND has enough entries, shift boundary forward
 * 3. Otherwise, keep existing boundary (maximize cache hits)
 *
 * The boundary is INCLUSIVE in the prefix:
 * - Entries 1 through boundaryId → prefix (cached)
 * - Entries after boundaryId → tail (uncached)
 *
 * @description Pure function to calculate the stable history boundary ID
 * @upstream Called by: context/builder/, platforms/cloudflare/src/prompts/build-system-prompt.js
 * @downstream Calls: estimateHistoryTokens()
 *
 * @param {HistoryEntry[]} history - Full history array (chronologically sorted)
 * @param {HistoryId|null} currentBoundaryId - Current boundary ID (null if not initialized)
 * @param {CacheConfig} config - Cache configuration
 * @returns {HistoryBoundaryResult} Boundary calculation result with updated ID and metadata
 *
 * @example
 * const result = calculateHistoryBoundary(history, boundaryId, config);
 * if (result.shifted) {
 *   console.log(result.logMessage);
 *   // Update state with result.boundaryId
 * }
 */
export function calculateHistoryBoundary(
  history: HistoryEntry[],
  currentBoundaryId: HistoryId | null,
  config: CacheConfig
): HistoryBoundaryResult {
  if (history.length === 0) {
    return {
      boundaryId: null,
      boundaryIndex: -1,
      tailTokenCount: 0,
      shifted: false,
      logMessage: '[Cache] No history entries, no boundary needed'
    };
  }

  const {
    historyTailTokenThreshold,
    historyTailTokenTarget,
    minHistoryTailEntries
  } = config;

  // Find current boundary in array
  let boundaryIndex = currentBoundaryId
    ? history.findIndex(h => h.id === currentBoundaryId)
    : -1;

  // Calculate current tail
  const currentTail = boundaryIndex >= 0
    ? history.slice(boundaryIndex + 1)
    : history;
  const currentTailTokens = currentTail.reduce(
    (sum, entry) => sum + estimateHistoryTokens(entry),
    0
  );

  // INITIALIZATION: No boundary set yet
  if (boundaryIndex === -1) {
    let newBoundaryIndex = history.length - 1;
    let tailTokens = 0;

    // Work backwards from end to find where tail tokens ~= target
    for (let i = history.length - 1; i >= 0; i--) {
      const entryTokens = estimateHistoryTokens(history[i]);
      if (tailTokens + entryTokens > historyTailTokenTarget &&
          i < history.length - minHistoryTailEntries) {
        newBoundaryIndex = i;
        break;
      }
      tailTokens += entryTokens;
    }

    newBoundaryIndex = Math.max(0, newBoundaryIndex);
    const newBoundaryId = history[newBoundaryIndex]?.id;

    if (!newBoundaryId) {
      return {
        boundaryId: null,
        boundaryIndex: -1,
        tailTokenCount: currentTailTokens,
        shifted: false,
        logMessage: '[Cache] Cannot initialize boundary (no valid entry)'
      };
    }

    return {
      boundaryId: newBoundaryId as HistoryId,
      boundaryIndex: newBoundaryIndex,
      tailTokenCount: tailTokens,
      shifted: true,
      logMessage: `[Cache] Initialized history boundary at entry ID ${newBoundaryId} (index ${newBoundaryIndex}, tail ~${tailTokens} tokens, target: ${historyTailTokenTarget})`
    };
  }

  // THRESHOLD CHECK: Shift if tail too large and we have enough entries
  if (currentTailTokens > historyTailTokenThreshold &&
      currentTail.length > minHistoryTailEntries) {

    let newBoundaryIndex = boundaryIndex;
    let tailTokens = currentTailTokens;

    // Remove entries from tail until we're near the target
    for (let i = currentTail.length - 1; i >= minHistoryTailEntries; i--) {
      const entryTokens = estimateHistoryTokens(currentTail[i - minHistoryTailEntries + 1]);
      if (tailTokens - entryTokens < historyTailTokenTarget) break;
      tailTokens -= entryTokens;
      newBoundaryIndex++;
    }

    newBoundaryIndex = Math.min(newBoundaryIndex, history.length - minHistoryTailEntries - 1);

    if (newBoundaryIndex !== boundaryIndex) {
      const newBoundaryId = history[newBoundaryIndex]?.id;
      if (!newBoundaryId) {
        return {
          boundaryId: currentBoundaryId,
          boundaryIndex,
          tailTokenCount: currentTailTokens,
          shifted: false,
          logMessage: '[Cache] Cannot shift boundary (no valid entry at new index)'
        };
      }

      return {
        boundaryId: newBoundaryId as HistoryId,
        boundaryIndex: newBoundaryIndex,
        tailTokenCount: tailTokens,
        shifted: true,
        logMessage: `[Cache] Updated history boundary to entry ID ${newBoundaryId} (tail was ${currentTailTokens}, now ~${tailTokens} tokens, threshold: ${historyTailTokenThreshold})`
      };
    }
  }

  // NO SHIFT: Boundary stays stable
  return {
    boundaryId: currentBoundaryId,
    boundaryIndex,
    tailTokenCount: currentTailTokens,
    shifted: false,
    logMessage: `[Cache] History boundary stable at entry ID ${currentBoundaryId} (tail: ${currentTailTokens} tokens, threshold: ${historyTailTokenThreshold})`
  };
}

// ============================================================================
// SUMMARY BOUNDARY CALCULATION
// ============================================================================

/**
 * Calculate stable boundary for summary prefix/tail split.
 *
 * ALGORITHM:
 * 1. If no boundary exists, initialize with oldest prefixSize summaries
 * 2. If tail exceeds threshold AND has enough summaries, shift boundary forward
 * 3. Otherwise, keep existing boundary (maximize cache hits)
 *
 * The boundary is INCLUSIVE in the prefix:
 * - Summaries 1 through boundaryId → prefix (cached)
 * - Summaries after boundaryId → tail (uncached)
 *
 * @description Pure function to calculate the stable summary boundary ID
 * @upstream Called by: context/builder/, platforms/cloudflare/src/prompts/build-system-prompt.js
 * @downstream Calls: estimateSummaryTokens()
 *
 * @param {Summary[]} summaries - All active summaries (chronologically sorted, oldest first)
 * @param {SummaryId|null} currentBoundaryId - Current boundary ID (null if not initialized)
 * @param {CacheConfig} config - Cache configuration
 * @returns {SummaryBoundaryResult} Boundary calculation result with updated ID and metadata
 *
 * @example
 * const result = calculateSummaryBoundary(summaries, boundaryId, config);
 * if (result.shifted) {
 *   console.log(result.logMessage);
 *   console.log(`Moved ${result.movedCount} summaries into cache`);
 * }
 */
export function calculateSummaryBoundary(
  summaries: Summary[],
  currentBoundaryId: SummaryId | null,
  config: CacheConfig
): SummaryBoundaryResult {
  if (summaries.length === 0) {
    return {
      boundaryId: null,
      boundaryIndex: -1,
      tailTokenCount: 0,
      movedCount: 0,
      shifted: false,
      logMessage: '[Cache] No summaries, no boundary needed'
    };
  }

  const {
    summaryPrefixSize,
    summaryTailTokenThreshold,
    summaryTailTokenTarget,
    minSummaryTailSummaries
  } = config;

  // Find current boundary in array
  let boundaryIndex = currentBoundaryId
    ? summaries.findIndex(s => s.id === currentBoundaryId)
    : -1;

  // INITIALIZATION: No boundary set yet
  if (boundaryIndex === -1) {
    const newBoundaryIndex = Math.min(summaryPrefixSize - 1, summaries.length - 1);
    if (newBoundaryIndex >= 0) {
      const newBoundaryId = summaries[newBoundaryIndex]?.id;
      if (!newBoundaryId) {
        return {
          boundaryId: null,
          boundaryIndex: -1,
          tailTokenCount: 0,
          movedCount: 0,
          shifted: false,
          logMessage: '[Cache] Cannot initialize boundary (no valid summary)'
        };
      }

      return {
        boundaryId: newBoundaryId as SummaryId,
        boundaryIndex: newBoundaryIndex,
        tailTokenCount: 0, // Will be calculated by caller
        movedCount: 0,
        shifted: true,
        logMessage: `[Cache] Initialized summary boundary at ID ${newBoundaryId} (index ${newBoundaryIndex})`
      };
    }
  }

  // Calculate current tail
  const tailSummaries = boundaryIndex >= 0
    ? summaries.slice(boundaryIndex + 1)
    : summaries;
  const tailTokens = tailSummaries.reduce(
    (sum, summary) => sum + estimateSummaryTokens(summary),
    0
  );

  // THRESHOLD CHECK: Shift if tail too large and we have enough summaries
  if (tailTokens > summaryTailTokenThreshold &&
      tailSummaries.length > minSummaryTailSummaries) {

    let tokensToMove = 0;
    let moveCount = 0;

    // Calculate how many summaries to move
    for (let i = 0; i < tailSummaries.length - minSummaryTailSummaries; i++) {
      const summaryTokens = estimateSummaryTokens(tailSummaries[i]);
      if (tailTokens - tokensToMove - summaryTokens < summaryTailTokenTarget) break;
      tokensToMove += summaryTokens;
      moveCount++;
    }

    if (moveCount > 0) {
      const newBoundaryId = tailSummaries[moveCount - 1]?.id;
      if (!newBoundaryId) {
        return {
          boundaryId: currentBoundaryId,
          boundaryIndex,
          tailTokenCount: tailTokens,
          movedCount: 0,
          shifted: false,
          logMessage: '[Cache] Cannot shift boundary (no valid summary at new index)'
        };
      }

      const newBoundaryIndex = boundaryIndex >= 0
        ? boundaryIndex + moveCount
        : moveCount - 1;

      const newTailLength = tailSummaries.length - moveCount;
      const newTailTokens = tailTokens - tokensToMove;

      return {
        boundaryId: newBoundaryId as SummaryId,
        boundaryIndex: newBoundaryIndex,
        tailTokenCount: newTailTokens,
        movedCount: moveCount,
        shifted: true,
        logMessage: `[Cache] Rolled ${moveCount} summaries (${tokensToMove} tok) into frozen cache. Tail now: ${newTailLength} summaries, ~${newTailTokens} tok`
      };
    }
  }

  // NO SHIFT: Boundary stays stable
  return {
    boundaryId: currentBoundaryId,
    boundaryIndex,
    tailTokenCount: tailTokens,
    movedCount: 0,
    shifted: false,
    logMessage: `[Cache] Summary boundary stable (tail: ${tailSummaries.length} summaries, ~${tailTokens} tokens)`
  };
}
