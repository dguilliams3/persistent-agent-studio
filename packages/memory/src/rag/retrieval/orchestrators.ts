/**
 * RAG Retrieval Orchestrators
 *
 * @module @persistence/memory/rag/retrieval/orchestrators
 * @description High-level retrieval functions that combine DB queries with scoring and MMR.
 *
 * These orchestrators follow the package architecture:
 * - DB queries are imported from @persistence/db (not raw db.prepare calls here)
 * - Scoring functions from ../scoring/
 * - MMR selection from ./mmr
 *
 * ARCHITECTURE:
 * ```
 * @persistence/db          → getSummariesWithEmbeddings(), getNotebookWithEmbeddings()
 *       ↓
 * @persistence/memory/rag  → orchestrators (this file) combine DB + scoring + MMR
 *       ↓
 * platforms/cloudflare     → imports orchestrators, provides db instance
 * ```
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/services/embeddings.js (to be migrated)
 *   - platforms/cloudflare/src/index.js (context building)
 * @downstream Calls:
 *   - @persistence/db (getSummariesWithEmbeddings, getNotebookWithEmbeddings)
 *   - ./mmr (selectByMMR)
 *   - ../scoring (calculateRecencyScore, calculateImportanceScore)
 *   - ../storage (blobToEmbedding)
 *   - ../math (cosineSimilarity)
 */

import type { DrizzleD1, SummaryRow, NotebookRow } from "@persistence/db";
import {
  getSummariesWithEmbeddings,
  getNotebookWithEmbeddings,
} from "@persistence/db";
import { blobToEmbedding } from "../storage";
import { cosineSimilarity } from "../math";
import { calculateRecencyScore, calculateImportanceScore } from "../scoring";
import { selectByMMR } from "./mmr";
import type { ScoredCandidate } from "../types";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Configuration for retrieval operations.
 */
export interface RetrievalConfig {
  /** Number of results to return. Default: 3 */
  topK?: number;
  /** Minimum cosine similarity threshold. Default: 0.3 */
  minSimilarity?: number;
  /** Days for recency score to decay by 50%. Default: 14 */
  recencyHalflifeDays?: number;
  /** Scoring weights (should sum to ~1). Default: { similarity: 0.5, recency: 0.3, importance: 0.2 } */
  weights?: {
    similarity: number;
    recency: number;
    importance: number;
  };
  /** MMR diversity parameter (1=pure relevance, 0=max diversity). Default: 0.7 */
  mmrLambda?: number;
  /** Include non-archived summaries. Default: true */
  includeActive?: boolean;
}

/**
 * Score breakdown for a retrieved summary.
 */
export interface ScoreBreakdown {
  /** Cosine similarity to query embedding */
  similarity: number;
  /** Recency score (exponential decay) */
  recency: number;
  /** Importance score (based on message count) */
  importance: number;
  /** Weighted combination of above scores */
  combined: number;
  /** MMR score after diversity adjustment (if applicable) */
  mmr?: number;
}

/**
 * A summary with its retrieval scores.
 */
export interface ScoredSummaryResult {
  summary: SummaryRow;
  scores: ScoreBreakdown;
}

/**
 * A memory item (summary or notebook) with its retrieval scores.
 */
export interface ScoredMemoryResult {
  type: "summary" | "notebook";
  item: SummaryRow | NotebookRow;
  scores: {
    similarity: number;
    recency: number;
    combined: number;
  };
}

/**
 * Extended config for memory retrieval (includes notebook cap).
 */
export interface MemoryRetrievalConfig extends RetrievalConfig {
  /** Maximum notebook entries in results. Default: 2 */
  maxNotebookEntries?: number;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

/**
 * Default retrieval configuration.
 *
 * Exported so platform config layers can use these as fallback defaults
 * rather than duplicating the values.
 */
export const DEFAULT_RETRIEVAL_CONFIG: Required<RetrievalConfig> = {
  topK: 3,
  minSimilarity: 0.3,
  recencyHalflifeDays: 14,
  weights: { similarity: 0.5, recency: 0.3, importance: 0.2 },
  mmrLambda: 0.7,
  includeActive: true,
};

// Internal alias for backward compat within this file
const DEFAULT_CONFIG = DEFAULT_RETRIEVAL_CONFIG;

// ============================================================================
// ORCHESTRATORS
// ============================================================================

/**
 * @description Retrieves relevant summaries using weighted scoring and MMR diversity.
 *
 * Pipeline:
 * 1. Fetch summaries with embeddings from @persistence/db
 * 2. Calculate similarity, recency, importance scores for each
 * 3. Filter by minSimilarity threshold
 * 4. Apply MMR for diverse selection
 * 5. Return top-k with full score breakdown
 *
 * @upstream Called by: platforms/cloudflare context building
 * @downstream Calls: @persistence/db (getSummariesWithEmbeddings), selectByMMR
 *
 * @param db - D1 database instance
 * @param queryEmbedding - Embedding vector to search against
 * @param config - Retrieval configuration
 * @returns Array of summaries with scores, sorted by MMR
 *
 * @example
 * const queryEmb = await embeddings.generate(recentHistoryText);
 * const relevant = await retrieveRelevantSummaries(db, queryEmb.data, {
 *   topK: 3,
 *   weights: { similarity: 0.5, recency: 0.3, importance: 0.2 }
 * });
 */
export async function retrieveRelevantSummaries(
  db: DrizzleD1,
  queryEmbedding: Float32Array,
  config: RetrievalConfig = {},
): Promise<ScoredSummaryResult[]> {
  const {
    topK,
    minSimilarity,
    recencyHalflifeDays,
    weights,
    mmrLambda,
    includeActive,
  } = { ...DEFAULT_CONFIG, ...config };

  // 1. Get summaries from @persistence/db
  const summaries = await getSummariesWithEmbeddings(db, {
    includeArchived: true, // Always search full archive for RAG
  });

  // Optionally filter out archived if only active wanted
  const filteredSummaries = includeActive
    ? summaries
    : summaries.filter((s) => s.archived_at === null);

  if (filteredSummaries.length === 0) {
    console.log("[RAG] No summaries with embeddings found");
    return [];
  }

  // 2. Score and prepare candidates
  const candidates: ScoredCandidate<SummaryRow>[] = [];

  for (const summary of filteredSummaries) {
    try {
      // Skip if embedding is null (shouldn't happen due to WHERE clause, but be safe)
      if (!summary.embedding) continue;
      const embedding = blobToEmbedding(summary.embedding);
      const similarity = cosineSimilarity(queryEmbedding, embedding);

      // Skip if below threshold
      if (similarity < minSimilarity) continue;

      const recency = calculateRecencyScore(
        summary.created_at,
        recencyHalflifeDays,
      );
      const importance = calculateImportanceScore(summary.message_count || 0);
      const combined =
        weights.similarity * similarity +
        weights.recency * recency +
        weights.importance * importance;

      candidates.push({
        item: summary,
        embedding,
        similarity,
        combinedScore: combined,
      });
    } catch (e) {
      console.warn(`[RAG] Failed to process summary ${summary.id}:`, e);
    }
  }

  if (candidates.length === 0) {
    console.log(
      `[RAG] No summaries above minSimilarity threshold (${minSimilarity})`,
    );
    return [];
  }

  // 3. Apply MMR for diversity
  const mmrResult = selectByMMR(candidates, queryEmbedding, {
    k: topK,
    lambda: mmrLambda,
    minSimilarity: 0, // Already filtered above
  });

  console.log(
    `[RAG] Retrieved ${mmrResult.selected.length} summaries via MMR ` +
      `(from ${candidates.length} candidates, ${filteredSummaries.length} total)`,
  );

  // 4. Return with full score breakdown
  return mmrResult.selected.map((s) => ({
    summary: s.item,
    scores: {
      similarity: s.similarity,
      recency: calculateRecencyScore(s.item.created_at, recencyHalflifeDays),
      importance: calculateImportanceScore(s.item.message_count || 0),
      combined: s.combinedScore ?? 0,
      mmr: s.mmrScore,
    },
  }));
}

/**
 * @description Retrieves relevant memories from both summaries AND notebook entries.
 *
 * Combines summaries and notebook entries, ranks them by weighted scoring,
 * and returns a mixed result set. Notebook entries are capped to prevent
 * overwhelming summaries.
 *
 * @upstream Called by: platforms/cloudflare context building
 * @downstream Calls: @persistence/db (getSummariesWithEmbeddings, getNotebookWithEmbeddings)
 *
 * @param db - D1 database instance
 * @param queryEmbedding - Embedding vector to search against
 * @param config - Retrieval configuration (includes maxNotebookEntries)
 * @returns Array of memories (summaries + notebooks) with scores
 *
 * @example
 * const memories = await retrieveRelevantMemories(db, queryEmb, {
 *   topK: 5,
 *   maxNotebookEntries: 2
 * });
 * memories.forEach(m => {
 *   if (m.type === 'summary') {
 *     console.log(`Summary: ${m.item.covered_range}`);
 *   } else {
 *     console.log(`Notebook: ${m.item.title}`);
 *   }
 * });
 */
export async function retrieveRelevantMemories(
  db: DrizzleD1,
  queryEmbedding: Float32Array,
  config: MemoryRetrievalConfig = {},
): Promise<ScoredMemoryResult[]> {
  const {
    topK = 5,
    maxNotebookEntries = 2,
    minSimilarity = 0.3,
    recencyHalflifeDays = 14,
    weights = { similarity: 0.6, recency: 0.4, importance: 0 },
    includeActive = true,
  } = config;

  const allCandidates: (ScoredMemoryResult & { _embedding: Float32Array })[] =
    [];

  // 1. Get summaries from @persistence/db
  const summaries = await getSummariesWithEmbeddings(db, {
    includeArchived: true,
  });
  const filteredSummaries = includeActive
    ? summaries
    : summaries.filter((s) => s.archived_at === null);

  for (const summary of filteredSummaries) {
    try {
      // Skip if embedding is null (shouldn't happen due to WHERE clause, but be safe)
      if (!summary.embedding) continue;
      const embedding = blobToEmbedding(summary.embedding);
      const similarity = cosineSimilarity(queryEmbedding, embedding);
      if (similarity < minSimilarity) continue;

      const recency = calculateRecencyScore(
        summary.created_at,
        recencyHalflifeDays,
      );
      const combined =
        weights.similarity * similarity + weights.recency * recency;

      allCandidates.push({
        type: "summary",
        item: summary,
        _embedding: embedding,
        scores: { similarity, recency, combined },
      });
    } catch (e) {
      console.warn(`[RAG] Failed to process summary ${summary.id}:`, e);
    }
  }

  // 2. Get notebook entries from @persistence/db
  const notebooks = await getNotebookWithEmbeddings(db);

  for (const note of notebooks) {
    try {
      // Skip if embedding is null
      if (!note.embedding) continue;
      const embedding = blobToEmbedding(note.embedding);
      const similarity = cosineSimilarity(queryEmbedding, embedding);
      if (similarity < minSimilarity) continue;

      const recency = calculateRecencyScore(
        note.created_at,
        recencyHalflifeDays,
      );
      const combined =
        weights.similarity * similarity + weights.recency * recency;

      allCandidates.push({
        type: "notebook",
        item: note,
        _embedding: embedding,
        scores: { similarity, recency, combined },
      });
    } catch (e) {
      console.warn(`[RAG] Failed to process notebook ${note.id}:`, e);
    }
  }

  if (allCandidates.length === 0) {
    console.log("[RAG] No candidates above similarity threshold");
    return [];
  }

  // 3. Sort by combined score
  allCandidates.sort((a, b) => b.scores.combined - a.scores.combined);

  // 4. Select top results with notebook cap
  const selected: ScoredMemoryResult[] = [];
  let notebookCount = 0;

  for (const candidate of allCandidates) {
    if (selected.length >= topK) break;

    if (candidate.type === "notebook") {
      if (notebookCount >= maxNotebookEntries) continue;
      notebookCount++;
    }

    // Remove internal _embedding field before returning
    selected.push({
      type: candidate.type,
      item: candidate.item,
      scores: candidate.scores,
    });
  }

  const summaryCount = selected.filter((s) => s.type === "summary").length;
  const noteCount = selected.filter((s) => s.type === "notebook").length;
  console.log(
    `[RAG] Retrieved ${selected.length} memories ` +
      `(${summaryCount} summaries, ${noteCount} notebooks) from ${allCandidates.length} candidates`,
  );

  return selected;
}
