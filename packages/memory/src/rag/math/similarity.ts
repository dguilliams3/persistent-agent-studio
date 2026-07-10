/**
 * Vector Similarity Functions
 *
 * @module @persistence/memory/rag/math/similarity
 * @description Pure math functions for computing vector similarity and distance.
 *
 * These functions operate on numeric arrays (embeddings) and return
 * scalar similarity/distance values. They are pure functions with
 * zero dependencies - perfect for unit testing.
 *
 * FUNCTIONS:
 * - cosineSimilarity: Angle-based similarity (-1 to 1)
 * - euclideanDistance: Straight-line distance (0 to infinity)
 *
 * @upstream Called by:
 *   - rag/scoring/combined.ts - For weighted scoring
 *   - platforms/cloudflare/src/services/embeddings.js - For retrieval
 * @downstream Calls:
 *   - None (pure math)
 */

import type { EmbeddingFloat32 } from '../types';

/**
 * @description Calculates cosine similarity between two embeddings.
 *
 * Returns a value between -1 and 1, where:
 * - 1 means identical direction (highly similar)
 * - 0 means orthogonal (unrelated)
 * - -1 means opposite direction (rare for text embeddings)
 *
 * Formula: cos(θ) = (a · b) / (||a|| × ||b||)
 *
 * @upstream Called by: findSimilarSummaries(), rankBySimilarity(), MMR selection, rag/retrieval/mmr.ts
 * @downstream Calls: None (pure math)
 *
 * @param {ArrayLike<number>} a - First embedding vector
 * @param {ArrayLike<number>} b - Second embedding vector
 * @returns {number} Cosine similarity score (-1 to 1)
 * @throws {Error} If vectors have different lengths
 *
 * @example
 * const sim = cosineSimilarity(embeddingA, embeddingB);
 * if (sim > 0.8) {
 *   console.log('These texts are semantically very similar');
 * }
 *
 * @note For text embeddings from models like BGE, values typically range
 * from 0.3 (unrelated) to 0.95 (near-identical). Values below 0.3 are rare.
 */
export function cosineSimilarity(
  a: ArrayLike<number>,
  b: ArrayLike<number>
): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * @description Computes Euclidean distance between two embeddings.
 *
 * Returns the straight-line distance in embedding space.
 * Lower values indicate more similar vectors.
 *
 * Formula: d = √(Σ(aᵢ - bᵢ)²)
 *
 * @upstream Called by: Clustering algorithms, outlier detection
 * @downstream Calls: None (pure math)
 *
 * @param {ArrayLike<number>} a - First vector
 * @param {ArrayLike<number>} b - Second vector
 * @returns {number} Euclidean distance (0 to infinity)
 * @throws {Error} If vectors have different lengths or are null/undefined
 *
 * @example
 * const distance = euclideanDistance(embeddingA, embeddingB);
 * if (distance < 0.5) {
 *   console.log('These vectors are very close');
 * }
 *
 * @note For normalized embeddings (unit vectors), Euclidean distance
 * and cosine similarity are monotonically related:
 * d² = 2(1 - cos(θ))
 */
export function euclideanDistance(
  a: ArrayLike<number>,
  b: ArrayLike<number>
): number {
  if (!a || !b || a.length !== b.length) {
    throw new Error('Vectors must have the same length for euclideanDistance');
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * @description Converts Euclidean distance to a similarity score.
 *
 * Uses the formula: similarity = 1 / (1 + distance)
 * Result is bounded to [0, 1] where 1 is identical.
 *
 * @upstream Called by: Retrieval pipelines that use distance-based similarity
 * @downstream Calls: None (pure math)
 *
 * @param {number} distance - Euclidean distance value
 * @returns {number} Similarity score (0 to 1)
 *
 * @example
 * const distance = euclideanDistance(a, b);
 * const similarity = distanceToSimilarity(distance);
 */
export function distanceToSimilarity(distance: number): number {
  return 1 / (1 + distance);
}
