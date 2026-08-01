/**
 * Cache Boundary Management
 *
 * @module @persistence/memory/context/cache
 * @description Barrel export for cache boundary calculation and management.
 *
 * This module provides the logic for stable cache boundary tracking, which
 * minimizes cache invalidation by keeping prefix/tail split points stable
 * across multiple cycles.
 *
 * KEY CONCEPTS:
 * - **Boundary ID**: The ID of the last entry/summary in the cached prefix
 * - **Token-based thresholds**: Boundaries shift based on token counts, not entry counts
 * - **Stable splits**: Boundaries only shift when necessary (tail exceeds threshold)
 * - **Separate boundaries**: History and summaries have independent boundaries
 *
 * USAGE:
 * ```typescript
 * import { cache } from '@persistence/memory/context';
 *
 * const historyResult = cache.calculateHistoryBoundary(history, boundaryId, config);
 * if (historyResult.shifted) {
 *   console.log(historyResult.logMessage);
 *   await saveState('history_prefix_boundary_id', historyResult.boundaryId);
 * }
 *
 * const summaryResult = cache.calculateSummaryBoundary(summaries, boundaryId, config);
 * if (summaryResult.shifted) {
 *   console.log(summaryResult.logMessage);
 *   await saveState('summary_prefix_boundary_id', summaryResult.boundaryId);
 * }
 * ```
 *
 * @upstream Used by:
 *   - context/builder/ - Context assembly orchestrator
 *   - platforms/cloudflare/src/prompts/build-system-prompt.js - During migration
 * @downstream Aggregates:
 *   - cache/types.ts - Type definitions
 *   - cache/boundary.ts - Boundary calculation logic
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  CacheConfig,
  CacheBoundaryState,
  HistoryBoundaryResult,
  SummaryBoundaryResult
} from '../types';

// ============================================================================
// FUNCTION EXPORTS
// ============================================================================

export {
  estimateHistoryTokens,
  estimateSummaryTokens,
  calculateHistoryBoundary,
  calculateSummaryBoundary
} from './boundary';
