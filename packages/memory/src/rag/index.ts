/**
 * RAG (Retrieval-Augmented Generation) Subsystem
 *
 * @module @persistence/memory/rag
 * @description Core RAG utilities for semantic memory retrieval.
 *
 * This module provides the mathematical and utility functions for RAG:
 *
 * - **math/**: Vector similarity and statistics (cosine, euclidean, normalize)
 * - **storage/**: Blob conversion for D1 storage (Float32Array ↔ ArrayBuffer)
 * - **scoring/**: Multi-factor scoring (recency, importance, combined)
 * - **retrieval/**: MMR algorithm for diverse result selection
 *
 * The actual embedding generation (via Cloudflare AI) and database queries
 * remain in the platform layer. This package provides the pure logic.
 *
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  @persistence/memory/rag                                                 │
 * │  ├── index.ts        ← You are here (barrel export)                      │
 * │  ├── types.ts        ← Embedding, ScoringWeights, ScoreBreakdown        │
 * │  ├── math/           ← cosineSimilarity, normalizeVector, mean           │
 * │  ├── storage/        ← embeddingToBlob, blobToEmbedding                  │
 * │  ├── scoring/        ← recency, importance, combined scoring             │
 * │  └── retrieval/      ← MMR (Maximal Marginal Relevance) algorithm        │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * USAGE:
 * ```typescript
 * // Full import via namespace
 * import { rag } from '@persistence/memory';
 * const similarity = rag.cosineSimilarity(embA, embB);
 * const blob = rag.embeddingToBlob(embedding);
 * const score = rag.calculateCombinedScore(sim, rec, imp);
 *
 * // Direct submodule imports
 * import { cosineSimilarity } from '@persistence/memory/rag/math';
 * import { embeddingToBlob } from '@persistence/memory/rag/storage';
 * import { calculateRecencyScore } from '@persistence/memory/rag/scoring';
 * import { selectByMMR } from '@persistence/memory/rag/retrieval';
 * ```
 *
 * WHY PURE FUNCTIONS:
 * The Basin Pattern separates pure logic from I/O. These functions:
 * - Take data in, return data out
 * - No database queries
 * - No external API calls
 * - Easy to unit test
 * - Portable across platforms
 *
 * @upstream Used by: platforms/cloudflare/src/services/embeddings.js
 * @downstream Aggregates: math/, storage/, scoring/ submodules
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  Embedding,
  EmbeddingFloat32,
  EmbeddingModel,
  ScoringWeights,
  ScoreBreakdown,
  ScoredResult,
  ScoredResultWithEmbedding,
  RecencyConfig,
  ImportanceConfig,
} from './types';

export {
  EMBEDDING_DIMENSION,
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_RECENCY_CONFIG,
  DEFAULT_IMPORTANCE_CONFIG,
} from './types';

// ============================================================================
// SUBMODULE NAMESPACE EXPORTS
// ============================================================================

// Math module - vector similarity and statistics
export * as math from './math';

// Storage module - blob conversion for D1
export * as storage from './storage';

// Scoring module - recency, importance, combined
export * as scoring from './scoring';

// Retrieval module - MMR algorithm for diverse selection
export * as retrieval from './retrieval';

// ============================================================================
// CONVENIENCE RE-EXPORTS (most commonly used)
// ============================================================================

// Math
export {
  cosineSimilarity,
  euclideanDistance,
  distanceToSimilarity,
  normalizeVector,
  mean,
  standardDeviation,
  magnitude,
  dotProduct,
} from './math';

// Storage
export {
  embeddingToBlob,
  blobToEmbedding,
  validateEmbeddingBlob,
} from './storage';

// Scoring
export {
  calculateRecencyScore,
  calculateRecencyScoreWithConfig,
  calculateImportanceScore,
  calculateImportanceScoreWithConfig,
  calculateCombinedScore,
  createScoreBreakdown,
  validateWeights,
  normalizeWeights,
  sortByScore,
  filterByMinScore,
  daysUntilThreshold,
  messagesForScore,
} from './scoring';

// Retrieval (low-level MMR)
export {
  selectByMMR,
  selectByMMRSimple,
  prepareCandidates,
} from './retrieval';

// Retrieval types (MMR)
export type {
  ScoredCandidate,
  MMRConfig,
  MMRResult,
  MMRSelectedItem,
} from './retrieval';

export { DEFAULT_MMR_CONFIG } from './retrieval';

// ============================================================================
// ORCHESTRATORS (high-level retrieval)
// ============================================================================
// These combine @persistence/db queries with scoring and MMR.
// They are the primary API for RAG retrieval from platform code.

export {
  retrieveRelevantSummaries,
  retrieveRelevantMemories,
  DEFAULT_RETRIEVAL_CONFIG,
} from './retrieval';

export type {
  RetrievalConfig,
  ScoreBreakdown as OrchestratorScoreBreakdown,
  ScoredSummaryResult,
  ScoredMemoryResult,
  MemoryRetrievalConfig,
} from './retrieval';
