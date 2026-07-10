/**
 * RAG Math Utilities
 *
 * @module @persistence/memory/rag/math
 * @description Barrel export for vector math operations.
 *
 * Pure mathematical functions for embedding operations:
 *
 * SIMILARITY:
 * - cosineSimilarity: Angle-based similarity metric (-1 to 1)
 * - euclideanDistance: Straight-line distance metric (0 to ∞)
 * - distanceToSimilarity: Convert distance to similarity score
 *
 * STATISTICS:
 * - normalizeVector: Convert to unit vector (magnitude 1)
 * - mean: Arithmetic average
 * - standardDeviation: Measure of spread
 * - magnitude: Vector length (L2 norm)
 * - dotProduct: Sum of element-wise products
 *
 * All functions are pure with zero dependencies - they take numbers in
 * and return numbers out.
 *
 * USAGE:
 * ```typescript
 * import { cosineSimilarity, normalizeVector, mean } from '@persistence/memory/rag/math';
 *
 * // Compare two embeddings
 * const similarity = cosineSimilarity(embedding1, embedding2);
 *
 * // Normalize for comparison
 * const normalized = normalizeVector(rawVector);
 *
 * // Calculate average score
 * const avgScore = mean(scores);
 * ```
 *
 * @upstream Used by: rag/scoring, rag/retrieval, platform embedding services
 * @downstream Aggregates: similarity.ts, statistics.ts
 */

// ============================================================================
// SIMILARITY FUNCTIONS
// ============================================================================
// Vector comparison metrics for embedding similarity search.
// cosineSimilarity is the primary metric for text embeddings.

export {
  cosineSimilarity,
  euclideanDistance,
  distanceToSimilarity,
} from './similarity';

// ============================================================================
// STATISTICAL FUNCTIONS
// ============================================================================
// Basic statistics for vector normalization and score analysis.

export {
  normalizeVector,
  mean,
  standardDeviation,
  magnitude,
  dotProduct,
} from './statistics';
