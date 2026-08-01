/**
 * RAG Retrieval Algorithms
 *
 * @module @persistence/memory/rag/retrieval
 * @description Barrel export for retrieval algorithms including MMR.
 *
 * This module provides the core retrieval algorithms for selecting
 * diverse, relevant results from a pool of candidates:
 *
 * - **MMR (Maximal Marginal Relevance)**: Balances relevance and diversity
 *
 * MMR ALGORITHM:
 * ```
 * For each position 1..k:
 *   Select item maximizing: lambda * relevance - (1-lambda) * max_sim_to_selected
 * ```
 *
 * This prevents "echo chamber" results where all top items are nearly identical.
 *
 * USAGE:
 * ```typescript
 * import { selectByMMR, prepareCandidates } from '@persistence/memory/rag/retrieval';
 *
 * // Prepare candidates (or do it manually)
 * const candidates = prepareCandidates(
 *   summaries,
 *   s => blobToEmbedding(s.embedding),
 *   s => cosineSimilarity(queryEmb, blobToEmbedding(s.embedding)),
 *   (s, sim) => 0.6 * sim + 0.3 * recencyScore + 0.1 * importanceScore,
 *   0.3 // minSimilarity
 * );
 *
 * // Select top 5 diverse results
 * const result = selectByMMR(candidates, queryEmb, {
 *   k: 5,
 *   lambda: 0.7,        // 70% relevance, 30% diversity
 *   minSimilarity: 0.3  // Already filtered, but can filter again
 * });
 *
 * result.selected.forEach(item => {
 *   console.log(`[${item.selectionOrder}] MMR=${item.mmrScore.toFixed(3)}`);
 * });
 * ```
 *
 * LAMBDA VALUES:
 * | lambda | Effect |
 * |--------|--------|
 * | 1.0    | Pure relevance ranking (no diversity) |
 * | 0.7    | Balanced (recommended default) |
 * | 0.5    | Equal weight to relevance and diversity |
 * | 0.3    | Strong diversity preference |
 * | 0.0    | Maximum diversity (ignore relevance) |
 *
 * @upstream Used by: platforms/cloudflare/src/services/embeddings.js
 * @downstream Aggregates: mmr.ts, types.ts
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================
// All retrieval-specific types

export type {
  ScoredCandidate,
  MMRConfig,
  MMRResult,
  MMRSelectedItem,
} from '../types';

export { DEFAULT_MMR_CONFIG } from '../types';

// ============================================================================
// MMR SELECTION
// ============================================================================
// Maximal Marginal Relevance algorithm for diverse retrieval

export {
  selectByMMR,
  selectByMMRSimple,
  prepareCandidates,
} from './mmr';

// ============================================================================
// ORCHESTRATORS
// ============================================================================
// High-level retrieval functions that combine DB queries with scoring and MMR.
// These import from @persistence/db for queries, use local modules for logic.

export {
  retrieveRelevantSummaries,
  retrieveRelevantMemories,
  DEFAULT_RETRIEVAL_CONFIG,
  type RetrievalConfig,
  type ScoreBreakdown,
  type ScoredSummaryResult,
  type ScoredMemoryResult,
  type MemoryRetrievalConfig,
} from './orchestrators';
