/**
 * Combined Weighted Scoring
 *
 * @module @persistence/memory/rag/scoring/combined
 * @description Combines multiple scoring factors into a single weighted score.
 *
 * RAG retrieval uses multiple signals to rank results:
 * - Semantic similarity (how relevant is the content?)
 * - Temporal recency (how recent is the memory?)
 * - Importance (how significant was the content?)
 *
 * This module combines these signals using configurable weights.
 *
 * SCORING FORMULA:
 * ```
 * combined = w_sim * similarity + w_rec * recency + w_imp * importance
 *
 * Default weights:
 *   similarity: 0.6  (semantic relevance is primary)
 *   recency:    0.25 (recent memories get boost)
 *   importance: 0.15 (volume matters less)
 * ```
 *
 * @upstream Called by: retrieveRelevantSummaries(), retrieveRelevantMemories()
 * @downstream Calls: None (pure math)
 */

import type { ScoringWeights, ScoreBreakdown } from '../types';
import { DEFAULT_SCORING_WEIGHTS } from '../types';

/**
 * @description Calculates combined weighted score from individual components.
 *
 * Takes separate scoring signals and combines them using configurable weights.
 * All weights should sum to 1.0 for normalized scoring.
 *
 * @upstream Called by: RAG retrieval functions, rag/retrieval/mmr.ts
 * @downstream Calls: None (pure math)
 *
 * @param {number} similarity - Cosine similarity score (typically 0-1)
 * @param {number} recency - Recency decay score (0-1)
 * @param {number} importance - Importance score (0-1+)
 * @param {ScoringWeights} [weights] - Scoring weights (default: 0.6/0.25/0.15)
 * @returns {number} Combined weighted score
 *
 * @example
 * const combined = calculateCombinedScore(
 *   0.85,  // High similarity
 *   0.72,  // Fairly recent
 *   0.45,  // Medium importance
 *   { similarity: 0.6, recency: 0.25, importance: 0.15 }
 * );
 * // Returns: 0.85*0.6 + 0.72*0.25 + 0.45*0.15 = 0.51 + 0.18 + 0.07 = 0.76
 */
export function calculateCombinedScore(
  similarity: number,
  recency: number,
  importance: number,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): number {
  return (
    weights.similarity * similarity +
    weights.recency * recency +
    weights.importance * importance
  );
}

/**
 * @description Creates a complete score breakdown object.
 *
 * Convenience function that computes the combined score and returns
 * all components in a structured format.
 *
 * @upstream Called by: Score analysis, detailed reporting
 * @downstream Calls: calculateCombinedScore()
 *
 * @param {number} similarity - Cosine similarity score
 * @param {number} recency - Recency decay score
 * @param {number} importance - Importance score
 * @param {ScoringWeights} [weights] - Scoring weights
 * @returns {ScoreBreakdown} Complete score breakdown
 *
 * @example
 * const scores = createScoreBreakdown(0.85, 0.72, 0.45);
 * console.log(scores.combined); // 0.76
 * console.log(scores.similarity); // 0.85
 */
export function createScoreBreakdown(
  similarity: number,
  recency: number,
  importance: number,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): ScoreBreakdown {
  return {
    similarity,
    recency,
    importance,
    combined: calculateCombinedScore(similarity, recency, importance, weights),
  };
}

/**
 * @description Validates that scoring weights sum to approximately 1.0.
 *
 * Weights should sum to 1.0 for proper normalization.
 * Allows small epsilon for floating-point errors.
 *
 * @upstream Called by: Configuration validation, setup verification
 * @downstream Calls: None (pure math)
 *
 * @param {ScoringWeights} weights - Scoring weights to validate
 * @param {number} [epsilon] - Tolerance for floating-point comparison (default: 0.001)
 * @returns {boolean} True if weights sum to 1.0 (within epsilon)
 *
 * @example
 * validateWeights({ similarity: 0.6, recency: 0.25, importance: 0.15 }); // true
 * validateWeights({ similarity: 0.5, recency: 0.5, importance: 0.5 });   // false
 */
export function validateWeights(
  weights: ScoringWeights,
  epsilon: number = 0.001
): boolean {
  const sum = weights.similarity + weights.recency + weights.importance;
  return Math.abs(sum - 1.0) < epsilon;
}

/**
 * @description Normalizes weights to sum to 1.0.
 *
 * If weights don't sum to 1.0, this function scales them proportionally.
 *
 * @upstream Called by: Configuration setup, weight adjustment
 * @downstream Calls: None (pure math)
 *
 * @param {ScoringWeights} weights - Weights to normalize
 * @returns {ScoringWeights} Normalized weights that sum to 1.0
 *
 * @example
 * normalizeWeights({ similarity: 2, recency: 1, importance: 1 });
 * // Returns { similarity: 0.5, recency: 0.25, importance: 0.25 }
 */
export function normalizeWeights(weights: ScoringWeights): ScoringWeights {
  const sum = weights.similarity + weights.recency + weights.importance;

  if (sum === 0) {
    // Avoid division by zero - return equal weights
    return { similarity: 1/3, recency: 1/3, importance: 1/3 };
  }

  return {
    similarity: weights.similarity / sum,
    recency: weights.recency / sum,
    importance: weights.importance / sum,
  };
}

/**
 * @description Sorts scored items by combined score (descending).
 *
 * Generic helper for sorting any array of scored items.
 *
 * @upstream Called by: Retrieval pipelines, ranking operations
 * @downstream Calls: None (pure sorting)
 *
 * @typeParam T - Type of items being scored
 * @param {T[]} items - Array of items with scores
 * @param {Function} getScore - Function to extract combined score from item
 * @returns {T[]} Sorted array (highest scores first)
 *
 * @example
 * const sorted = sortByScore(candidates, c => c.scores.combined);
 */
export function sortByScore<T>(
  items: T[],
  getScore: (item: T) => number
): T[] {
  return [...items].sort((a, b) => getScore(b) - getScore(a));
}

/**
 * @description Filters items below a minimum combined score.
 *
 * @upstream Called by: Retrieval pipelines, quality filtering
 * @downstream Calls: None (pure filtering)
 *
 * @typeParam T - Type of items being scored
 * @param {T[]} items - Array of items with scores
 * @param {Function} getScore - Function to extract score from item
 * @param {number} minScore - Minimum score threshold
 * @returns {T[]} Filtered array with only items above threshold
 *
 * @example
 * const relevant = filterByMinScore(candidates, c => c.scores.combined, 0.5);
 */
export function filterByMinScore<T>(
  items: T[],
  getScore: (item: T) => number,
  minScore: number
): T[] {
  return items.filter(item => getScore(item) >= minScore);
}
