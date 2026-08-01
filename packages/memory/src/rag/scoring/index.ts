/**
 * RAG Scoring Functions
 *
 * @module @persistence/memory/rag/scoring
 * @description Barrel export for retrieval scoring operations.
 *
 * Scoring functions for RAG (Retrieval-Augmented Generation):
 *
 * INDIVIDUAL SCORES:
 * - recency: Exponential decay based on age
 * - importance: Log-scaled based on content volume
 *
 * COMBINED SCORING:
 * - combined: Weighted combination of all factors
 *
 * SCORING PIPELINE:
 * ```
 * 1. Calculate similarity (cosine) from embeddings
 * 2. Calculate recency from timestamp
 * 3. Calculate importance from message count
 * 4. Combine with weights: 0.6*sim + 0.25*rec + 0.15*imp
 * 5. Apply MMR for diversity (optional)
 * ```
 *
 * USAGE:
 * ```typescript
 * import {
 *   calculateRecencyScore,
 *   calculateImportanceScore,
 *   calculateCombinedScore,
 *   DEFAULT_SCORING_WEIGHTS
 * } from '@persistence/memory/rag/scoring';
 *
 * // Individual scores
 * const recency = calculateRecencyScore(summary.created_at);
 * const importance = calculateImportanceScore(summary.message_count);
 *
 * // Combined scoring
 * const combined = calculateCombinedScore(similarity, recency, importance);
 * ```
 *
 * @upstream Used by: platform retrieval functions
 * @downstream Aggregates: recency.ts, importance.ts, combined.ts
 */

// ============================================================================
// RECENCY SCORING
// ============================================================================
// Exponential decay based on age. Recent memories score higher.

export {
  calculateRecencyScore,
  calculateRecencyScoreWithConfig,
  daysUntilThreshold,
} from './recency';

// ============================================================================
// IMPORTANCE SCORING
// ============================================================================
// Log-scaled based on content volume. Bigger summaries score higher.

export {
  calculateImportanceScore,
  calculateImportanceScoreWithConfig,
  messagesForScore,
} from './importance';

// ============================================================================
// COMBINED SCORING
// ============================================================================
// Weighted combination of all factors.

export {
  calculateCombinedScore,
  createScoreBreakdown,
  validateWeights,
  normalizeWeights,
  sortByScore,
  filterByMinScore,
} from './combined';
