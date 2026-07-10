/**
 * Statistical Utility Functions
 *
 * @module @persistence/memory/rag/math/statistics
 * @description Pure math functions for vector normalization and basic statistics.
 *
 * These functions support embedding operations:
 * - normalizeVector: Convert to unit vector for cosine similarity
 * - mean: Calculate average for centering
 * - standardDeviation: Measure spread for outlier detection
 *
 * @upstream Called by:
 *   - rag/math/similarity.ts - For normalized comparisons
 *   - rag/scoring/ - For score normalization
 * @downstream Calls:
 *   - None (pure math)
 */

import type { EmbeddingFloat32 } from '../types';

/**
 * @description Normalizes a vector to unit length (magnitude 1).
 *
 * Unit vectors are useful for cosine similarity since:
 * cos(θ) = a · b when ||a|| = ||b|| = 1
 *
 * Returns zero vector when input has zero magnitude.
 *
 * @upstream Called by: Pre-processing for similarity calculations, embedding normalization
 * @downstream Calls: None (pure math)
 *
 * @param {ArrayLike<number>} vector - Vector to normalize
 * @returns {Float32Array} Float32Array with unit length (or zero vector if magnitude is 0)
 *
 * @example
 * const normalized = normalizeVector([3, 4]);
 * // Returns Float32Array([0.6, 0.8]) - magnitude is now 1
 *
 * const zero = normalizeVector([0, 0, 0]);
 * // Returns Float32Array([0, 0, 0]) - zero vector unchanged
 */
export function normalizeVector(vector: ArrayLike<number>): Float32Array {
  if (!vector || vector.length === 0) {
    return new Float32Array(0);
  }

  let magnitudeSquared = 0;
  for (let i = 0; i < vector.length; i++) {
    magnitudeSquared += vector[i] * vector[i];
  }

  if (magnitudeSquared === 0) {
    return new Float32Array(vector.length);
  }

  const magnitude = Math.sqrt(magnitudeSquared);
  const normalized = new Float32Array(vector.length);

  for (let i = 0; i < vector.length; i++) {
    normalized[i] = vector[i] / magnitude;
  }

  return normalized;
}

/**
 * @description Calculates the arithmetic mean of numeric values.
 *
 * Returns 0 for empty or null arrays.
 *
 * @upstream Called by: standardDeviation(), score aggregation, statistics analysis
 * @downstream Calls: None (pure math)
 *
 * @param {ArrayLike<number>} values - Array of numeric values
 * @returns {number} Mean value (0 when empty)
 *
 * @example
 * mean([1, 2, 3, 4, 5]); // Returns 3
 * mean([]);              // Returns 0
 * mean([10]);            // Returns 10
 */
export function mean(values: ArrayLike<number>): number {
  if (!values || values.length === 0) {
    return 0;
  }

  let total = 0;
  for (let i = 0; i < values.length; i++) {
    total += values[i];
  }

  return total / values.length;
}

/**
 * @description Calculates population standard deviation.
 *
 * Measures the spread of values around the mean.
 * Uses population formula (N denominator), not sample formula (N-1).
 *
 * @upstream Called by: Outlier detection, score normalization, metrics analysis
 * @downstream Calls: mean() if providedMean is not given
 *
 * @param {ArrayLike<number>} values - Array of numeric values
 * @param {number} [providedMean] - Optional precomputed mean (optimization)
 * @returns {number} Standard deviation (0 when empty)
 *
 * @example
 * standardDeviation([1, 2, 3, 4, 5]);     // Returns ~1.414
 * standardDeviation([5, 5, 5, 5]);        // Returns 0 (no spread)
 *
 * // With precomputed mean (faster for large arrays)
 * const mu = mean(values);
 * const sigma = standardDeviation(values, mu);
 */
export function standardDeviation(
  values: ArrayLike<number>,
  providedMean?: number
): number {
  if (!values || values.length === 0) {
    return 0;
  }

  const mu = typeof providedMean === 'number' ? providedMean : mean(values);
  let varianceSum = 0;

  for (let i = 0; i < values.length; i++) {
    const diff = values[i] - mu;
    varianceSum += diff * diff;
  }

  return Math.sqrt(varianceSum / values.length);
}

/**
 * @description Calculates the magnitude (L2 norm) of a vector.
 *
 * @upstream Called by: Vector normalization, similarity calculations
 * @downstream Calls: None (pure math)
 *
 * @param {ArrayLike<number>} vector - Vector to measure
 * @returns {number} Magnitude (0 for empty vectors)
 *
 * @example
 * magnitude([3, 4]); // Returns 5
 * magnitude([1, 0, 0]); // Returns 1
 */
export function magnitude(vector: ArrayLike<number>): number {
  if (!vector || vector.length === 0) {
    return 0;
  }

  let sum = 0;
  for (let i = 0; i < vector.length; i++) {
    sum += vector[i] * vector[i];
  }

  return Math.sqrt(sum);
}

/**
 * @description Calculates the dot product of two vectors.
 *
 * @upstream Called by: Similarity calculations, similarity.ts cosineSimilarity()
 * @downstream Calls: None (pure math)
 *
 * @param {ArrayLike<number>} a - First vector
 * @param {ArrayLike<number>} b - Second vector
 * @returns {number} Dot product value
 * @throws {Error} If vectors have different lengths
 *
 * @example
 * dotProduct([1, 2, 3], [4, 5, 6]); // Returns 32 (1*4 + 2*5 + 3*6)
 */
export function dotProduct(
  a: ArrayLike<number>,
  b: ArrayLike<number>
): number {
  if (!a || !b || a.length !== b.length) {
    throw new Error('Vectors must have the same length for dotProduct');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }

  return sum;
}
