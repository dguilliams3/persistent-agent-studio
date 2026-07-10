/**
 * RAG Type Definitions
 *
 * @module @persistence/memory/rag/types
 * @description Core types for the RAG (Retrieval-Augmented Generation) subsystem.
 *
 * These types define the structures for:
 * - Embeddings (768-dimensional vectors from BGE model)
 * - Scoring results with similarity, recency, and importance
 * - Scoring weight configurations
 *
 * DESIGN PRINCIPLES:
 * - Zero dependencies - pure type definitions
 * - Compatible with D1 storage (ArrayBuffer for blobs)
 * - Generic scoring for both summaries and notebook entries
 *
 * @upstream Used by: rag/math, rag/storage, rag/scoring, platforms/cloudflare
 * @downstream Uses: None (pure types)
 */

// ════════════════════════════════════════════════════════════════════════════
// EMBEDDING TYPES
// ════════════════════════════════════════════════════════════════════════════

/**
 * 768-dimensional embedding vector from the BGE model.
 *
 * In TypeScript, we use number[] for general compatibility,
 * but at runtime this is often a Float32Array for efficiency.
 *
 * @example
 * const embedding: Embedding = [0.123, -0.456, ...]; // 768 values
 */
export type Embedding = number[];

/**
 * Embedding stored as Float32Array for efficient computation.
 *
 * Use this when performing vector math (cosine similarity, etc.)
 * to avoid conversion overhead.
 */
export type EmbeddingFloat32 = Float32Array;

/**
 * Model identifier for tracking which model generated an embedding.
 *
 * @example 'bge-base-en-v1.5'
 */
export type EmbeddingModel = string;

/**
 * Standard embedding dimension for BGE-base-en-v1.5.
 */
export const EMBEDDING_DIMENSION = 768 as const;

// ════════════════════════════════════════════════════════════════════════════
// SCORING TYPES
// ════════════════════════════════════════════════════════════════════════════

/**
 * Weights for combining multiple scoring factors.
 *
 * All weights should ideally sum to 1.0 for normalized scoring.
 *
 * @example
 * const weights: ScoringWeights = {
 *   similarity: 0.6,  // Semantic relevance is most important
 *   recency: 0.25,    // Recent memories get a boost
 *   importance: 0.15  // Message count matters less
 * };
 */
export interface ScoringWeights {
  /** Weight for semantic similarity (cosine similarity). Range: 0-1 */
  similarity: number;

  /** Weight for temporal recency (exponential decay). Range: 0-1 */
  recency: number;

  /** Weight for importance (log-scaled message count). Range: 0-1 */
  importance: number;
}

/**
 * Default scoring weights for RAG retrieval.
 *
 * These weights prioritize semantic similarity while still
 * considering recency and importance.
 */
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  similarity: 0.6,
  recency: 0.25,
  importance: 0.15,
};

/**
 * Individual score components for a scored result.
 *
 * Each component is normalized to [0, 1] range.
 */
export interface ScoreBreakdown {
  /** Cosine similarity to query embedding. Range: -1 to 1, typically 0 to 1 for text */
  similarity: number;

  /** Recency score from exponential decay. Range: 0 to 1 */
  recency: number;

  /** Importance score from log-scaled metric. Range: 0 to ~1.5 for very large values */
  importance: number;

  /** Weighted combination of all scores */
  combined: number;

  /** MMR score if diversity selection was applied */
  mmr?: number;
}

/**
 * Generic scored result wrapper.
 *
 * Wraps any item type with its score breakdown for ranking.
 *
 * @typeParam T - The type of item being scored (summary, notebook entry, etc.)
 *
 * @example
 * const result: ScoredResult<Summary> = {
 *   item: summary,
 *   scores: {
 *     similarity: 0.85,
 *     recency: 0.72,
 *     importance: 0.45,
 *     combined: 0.76
 *   }
 * };
 */
export interface ScoredResult<T> {
  /** The scored item */
  item: T;

  /** Score breakdown */
  scores: ScoreBreakdown;
}

/**
 * Result with embedding attached (used during MMR selection).
 *
 * @typeParam T - The type of item being scored
 */
export interface ScoredResultWithEmbedding<T> extends ScoredResult<T> {
  /** Embedding vector for diversity calculation */
  embedding: EmbeddingFloat32;
}

// ════════════════════════════════════════════════════════════════════════════
// RECENCY CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for recency score calculation.
 */
export interface RecencyConfig {
  /**
   * Half-life in days for exponential decay.
   *
   * After this many days, recency score is 0.5.
   * After 2x days, score is 0.25. And so on.
   *
   * @default 14
   */
  halflifeDays: number;
}

/**
 * Default recency configuration.
 */
export const DEFAULT_RECENCY_CONFIG: RecencyConfig = {
  halflifeDays: 14,
};

// ════════════════════════════════════════════════════════════════════════════
// IMPORTANCE CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for importance score calculation.
 */
export interface ImportanceConfig {
  /**
   * Maximum expected message count for normalization.
   *
   * Summaries with this many messages score ~1.0.
   * Summaries with more can exceed 1.0.
   *
   * @default 100
   */
  maxExpectedCount: number;

  /**
   * Minimum score for entries with 0 or negative counts.
   *
   * @default 0.1
   */
  minimumScore: number;
}

/**
 * Default importance configuration.
 */
export const DEFAULT_IMPORTANCE_CONFIG: ImportanceConfig = {
  maxExpectedCount: 100,
  minimumScore: 0.1,
};

// ════════════════════════════════════════════════════════════════════════════
// MMR RETRIEVAL TYPES (collapsed from retrieval/types.ts)
// ════════════════════════════════════════════════════════════════════════════

/**
 * A candidate item prepared for MMR selection.
 */
export interface ScoredCandidate<T> {
  item: T;
  embedding: EmbeddingFloat32;
  similarity: number;
  recency?: number;
  importance?: number;
  combinedScore?: number;
}

/**
 * Configuration for MMR (Maximal Marginal Relevance) retrieval.
 */
export interface MMRConfig {
  k: number;
  lambda?: number;
  minSimilarity?: number;
  useCombinedScore?: boolean;
}

/**
 * Default MMR configuration values.
 */
export const DEFAULT_MMR_CONFIG: Required<Omit<MMRConfig, 'k'>> = {
  lambda: 0.7,
  minSimilarity: 0.0,
  useCombinedScore: true,
};

/**
 * A selected item with its MMR score.
 */
export interface MMRSelectedItem<T> extends ScoredCandidate<T> {
  mmrScore: number;
  selectionOrder: number;
}

/**
 * Result of MMR selection.
 */
export interface MMRResult<T> {
  selected: MMRSelectedItem<T>[];
  stats: {
    candidateCount: number;
    filteredCount: number;
    selectedCount: number;
    lambda: number;
  };
}
