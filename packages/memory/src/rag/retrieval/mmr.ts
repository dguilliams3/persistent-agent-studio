/**
 * Maximal Marginal Relevance (MMR) Selection Algorithm
 *
 * @module @persistence/memory/rag/retrieval/mmr
 * @description Pure implementation of MMR for diverse retrieval.
 *
 * MMR balances relevance to the query with diversity among selected results.
 * It iteratively selects items that maximize:
 *
 *   MMR(d) = lambda * Sim(d, query) - (1 - lambda) * max(Sim(d, selected))
 *
 * WHERE:
 * - lambda: Trade-off parameter (1.0 = pure relevance, 0.0 = max diversity)
 * - Sim(d, query): Relevance score (similarity or combined score)
 * - max(Sim(d, selected)): Maximum similarity to any already-selected item
 *
 * WHY MMR:
 * Simple top-k by similarity often returns redundant results. If your top 5
 * summaries are all about "career planning", you miss other relevant topics.
 * MMR penalizes items similar to those already selected, promoting diversity.
 *
 * ALGORITHM:
 * 1. Filter candidates by minSimilarity threshold
 * 2. Select first item with highest relevance score
 * 3. For each remaining position:
 *    a. Calculate MMR for each remaining candidate
 *    b. Select candidate with highest MMR
 *    c. Add to selected set
 * 4. Return selected items with MMR scores
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/services/embeddings.js - retrieveRelevantSummaries()
 *   - platforms/cloudflare/src/services/embeddings.js - retrieveRelevantMemories()
 * @downstream Calls:
 *   - ../math/similarity.ts - cosineSimilarity() for diversity calculation
 *
 * @example
 * import { selectByMMR } from '@persistence/memory/rag/retrieval';
 *
 * // Prepare candidates with embeddings and scores
 * const candidates = summaries.map(s => ({
 *   item: s,
 *   embedding: blobToEmbedding(s.embedding),
 *   similarity: cosineSimilarity(queryEmb, s.embedding),
 *   combinedScore: 0.6 * similarity + 0.3 * recency + 0.1 * importance
 * }));
 *
 * // Select diverse top-5
 * const result = selectByMMR(candidates, queryEmb, { k: 5, lambda: 0.7 });
 *
 * result.selected.forEach(item => {
 *   console.log(`MMR ${item.mmrScore.toFixed(3)}: ${item.item.covered_range}`);
 * });
 */

import { cosineSimilarity } from '../math';
import type { EmbeddingFloat32 } from '../types';
import type {
  ScoredCandidate,
  MMRConfig,
  MMRResult,
  MMRSelectedItem,
  DEFAULT_MMR_CONFIG,
} from '../types';

/**
 * @description Selects items using Maximal Marginal Relevance
 *
 * Balances relevance to query with diversity among selected results.
 * Items are selected iteratively, each time choosing the one that
 * maximizes: lambda * relevance - (1 - lambda) * max(similarity to selected)
 *
 * @upstream Called by: retrieveRelevantSummaries(), retrieveRelevantMemories(), platforms/cloudflare/src/services/embeddings.js
 * @downstream Calls: cosineSimilarity() for diversity calculation
 *
 * @typeParam T - Type of items being selected
 * @param {ScoredCandidate<T>[]} candidates - Items to select from, with embeddings and scores
 * @param {EmbeddingFloat32} queryEmbedding - The query vector (used only for reference, similarity already computed)
 * @param {MMRConfig} config - MMR configuration (k, lambda, minSimilarity)
 * @returns {MMRResult<T>} Selected items with MMR scores and selection statistics
 *
 * @example
 * const result = selectByMMR(candidates, queryEmb, {
 *   k: 5,
 *   lambda: 0.7,        // 70% relevance, 30% diversity
 *   minSimilarity: 0.3  // Ignore items with combined score < 0.3
 * });
 *
 * @note The queryEmbedding parameter is included for API consistency but not
 * used directly - similarity scores should already be computed on candidates.
 * The diversity calculation uses cosine similarity between candidate embeddings.
 */
export function selectByMMR<T>(
  candidates: ScoredCandidate<T>[],
  queryEmbedding: EmbeddingFloat32,
  config: MMRConfig
): MMRResult<T> {
  // Apply defaults
  const {
    k,
    lambda = 0.7,
    minSimilarity = 0.0,
    useCombinedScore = true,
  } = config;

  const candidateCount = candidates.length;

  // Step 1: Filter by minSimilarity threshold
  const filtered = candidates.filter((c) => {
    const score = useCombinedScore && c.combinedScore !== undefined
      ? c.combinedScore
      : c.similarity;
    return score >= minSimilarity;
  });

  const filteredCount = filtered.length;

  // Handle edge cases
  if (filteredCount === 0) {
    return {
      selected: [],
      stats: {
        candidateCount,
        filteredCount: 0,
        selectedCount: 0,
        lambda,
      },
    };
  }

  // Step 2: Initialize selection
  const selected: MMRSelectedItem<T>[] = [];
  const remaining = [...filtered];

  // Step 3: Iteratively select items using MMR
  while (selected.length < k && remaining.length > 0) {
    let bestIdx = -1;
    let bestMMR = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];

      // Get relevance score (combined or raw similarity)
      const relevance = useCombinedScore && candidate.combinedScore !== undefined
        ? candidate.combinedScore
        : candidate.similarity;

      // Calculate max similarity to any already-selected item
      let maxSimToSelected = 0;
      for (const sel of selected) {
        const simToSelected = cosineSimilarity(candidate.embedding, sel.embedding);
        maxSimToSelected = Math.max(maxSimToSelected, simToSelected);
      }

      // MMR formula: lambda * relevance - (1 - lambda) * maxSimToSelected
      const mmrScore = lambda * relevance - (1 - lambda) * maxSimToSelected;

      if (mmrScore > bestMMR) {
        bestMMR = mmrScore;
        bestIdx = i;
      }
    }

    // Select the winner
    if (bestIdx >= 0) {
      const winner = remaining[bestIdx];
      selected.push({
        ...winner,
        mmrScore: bestMMR,
        selectionOrder: selected.length,
      });
      remaining.splice(bestIdx, 1);
    } else {
      // Should not happen, but break to prevent infinite loop
      break;
    }
  }

  return {
    selected,
    stats: {
      candidateCount,
      filteredCount,
      selectedCount: selected.length,
      lambda,
    },
  };
}

/**
 * @description Simplified MMR selection that returns only items (no metadata)
 *
 * Convenience wrapper when you just need the selected items without
 * MMR scores or selection statistics.
 *
 * @upstream Called by: Simple retrieval use cases
 * @downstream Calls: selectByMMR()
 *
 * @typeParam T - Type of items being selected
 * @param {ScoredCandidate<T>[]} candidates - Items to select from
 * @param {EmbeddingFloat32} queryEmbedding - The query vector
 * @param {MMRConfig} config - MMR configuration
 * @returns {T[]} Just the selected items in order
 *
 * @example
 * const items = selectByMMRSimple(candidates, queryEmb, { k: 3 });
 * items.forEach(item => console.log(item.title));
 */
export function selectByMMRSimple<T>(
  candidates: ScoredCandidate<T>[],
  queryEmbedding: EmbeddingFloat32,
  config: MMRConfig
): T[] {
  const result = selectByMMR(candidates, queryEmbedding, config);
  return result.selected.map((s) => s.item);
}

/**
 * @description Pre-filters candidates and prepares them for MMR selection
 *
 * Helper function to transform raw items into ScoredCandidates ready for MMR.
 * Handles score computation and filtering in one step.
 *
 * @upstream Called by: Platform retrieval functions, platforms/cloudflare/src/services/embeddings.js
 * @downstream Calls: None (pure transformation)
 *
 * @typeParam T - Type of items being prepared
 * @param {T[]} items - Raw items to prepare
 * @param {Function} getEmbedding - Function to extract embedding from item
 * @param {Function} getSimilarity - Function to compute similarity for item
 * @param {Function} [getCombinedScore] - Optional function to compute combined score
 * @param {number} [minSimilarity] - Minimum similarity to include (default 0)
 * @returns {ScoredCandidate<T>[]} Array of ScoredCandidates ready for selectByMMR
 *
 * @example
 * const candidates = prepareCandidates(
 *   summaries,
 *   s => blobToEmbedding(s.embedding),
 *   s => cosineSimilarity(queryEmb, s.embedding),
 *   s => 0.6 * s.similarity + 0.3 * s.recency + 0.1 * s.importance,
 *   0.3
 * );
 */
export function prepareCandidates<T>(
  items: T[],
  getEmbedding: (item: T) => EmbeddingFloat32,
  getSimilarity: (item: T) => number,
  getCombinedScore?: (item: T, similarity: number) => number,
  minSimilarity: number = 0
): ScoredCandidate<T>[] {
  const candidates: ScoredCandidate<T>[] = [];

  for (const item of items) {
    try {
      const embedding = getEmbedding(item);
      const similarity = getSimilarity(item);

      if (similarity < minSimilarity) {
        continue;
      }

      const combinedScore = getCombinedScore
        ? getCombinedScore(item, similarity)
        : undefined;

      candidates.push({
        item,
        embedding,
        similarity,
        combinedScore,
      });
    } catch {
      // Skip items that fail embedding extraction
      continue;
    }
  }

  return candidates;
}
