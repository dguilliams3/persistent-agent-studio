/**
 * Meta-Summarization Orchestrator
 *
 * @module @persistence/memory/summarization/orchestrator/meta-summarize
 * @description Pure transformation: Summary[] → MetaSummaryDraft
 *
 * DESIGN PHILOSOPHY:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  Meta-summarization consolidates summaries into higher-level summaries. │
 * │                                                                         │
 * │  Input:  Summary[] (existing summaries to consolidate)                  │
 * │  Output: MetaSummaryDraft (ready for DB insertion)                      │
 * │                                                                         │
 * │  The key difference from regular summarization:                         │
 * │  - source_type is 'summary' not 'history'                               │
 * │  - source_ids are SummaryId values not HistoryId values                 │
 * │  - message_count is sum of consolidated summaries' counts               │
 * │  - time range spans all consolidated summaries                          │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * @upstream Used by: platform/services/summarization.js metaSummarize()
 * @downstream Uses: parser/parse-meta, prompt-builder
 */

import type { Summary, SummaryId, ISOTimestamp } from '../../types';
import { DEFAULT_METADATA } from '../../types';
import type {
  MetaSummarizeRequest,
  MetaSummarizeResult,
  MetaSummaryDraft,
  LLMAdapter,
  EmbeddingAdapter,
} from './types';
import { parseMetaSummaryResponse } from '../parser';
import {
  buildMetaSummarizePrompt,
  formatSummariesForMeta,
  computeTimeRangeFromSummaries,
} from './prompt-builder';

/**
 * Consolidate summaries into a meta-summary.
 *
 * Pure transformation: Summary[] → MetaSummaryDraft
 * All I/O is injected via adapters.
 *
 * @param request - Summaries, focus hints, and config
 * @param llm - LLM adapter (caller provides implementation)
 * @param embedder - Optional embedding adapter
 * @returns MetaSummarizeResult (discriminated union: success or failure)
 *
 * @example
 * ```typescript
 * // Platform usage
 * const summaries = await getActiveSummaries(db);
 * const config = await getMetaSummarizeConfig(db);
 *
 * const result = await metaSummarize(
 *   { summaries, focusHints: 'Focus on relationship development', config },
 *   { complete: (p) => callLLM(p, env) },
 *   { generate: (t) => generateEmbedding(t, env) }
 * );
 *
 * if (result.success) {
 *   await insertSummary(db, result.draft);
 *   await archiveSummaries(db, result.consumedIds);
 * }
 * ```
 */
export async function metaSummarize(
  request: MetaSummarizeRequest,
  llm: LLMAdapter,
  embedder?: EmbeddingAdapter
): Promise<MetaSummarizeResult> {
  const startTime = Date.now();
  const { summaries, focusHints, config } = request;

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 1: Validate input
  // ──────────────────────────────────────────────────────────────────────────

  if (summaries.length === 0) {
    return {
      success: false,
      error: 'No summaries to consolidate',
      preservedCount: 0,
      durationMs: Date.now() - startTime,
    };
  }

  if (summaries.length < 2) {
    return {
      success: false,
      error: 'Need at least 2 summaries to consolidate',
      preservedCount: summaries.length,
      durationMs: Date.now() - startTime,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 2: Format summaries for LLM prompt
  // ──────────────────────────────────────────────────────────────────────────

  const summariesText = formatSummariesForMeta(summaries);
  const timeRange = computeTimeRangeFromSummaries(summaries);

  // Calculate total message count (sum of all source summaries)
  const totalMessageCount = summaries.reduce(
    (sum, s) => sum + s.message_count,
    0
  );

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 3: Build prompt
  // ──────────────────────────────────────────────────────────────────────────

  const prompt = buildMetaSummarizePrompt(
    summariesText,
    timeRange,
    summaries.length,
    totalMessageCount,
    config.instructions,
    focusHints
  );

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 4: Call LLM (via injected adapter)
  // ──────────────────────────────────────────────────────────────────────────

  let rawResponse: string;
  try {
    rawResponse = await llm.complete({
      system: config.systemPrompt,
      prompt,
      maxTokens: config.maxResponseTokens,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: `LLM call failed: ${message}`,
      preservedCount: summaries.length,
      durationMs: Date.now() - startTime,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 5: Parse response
  // ──────────────────────────────────────────────────────────────────────────

  const parsed = parseMetaSummaryResponse(rawResponse, {
    summaryCount: summaries.length,
    minConsolidateCount: 2,
    summaryField: 'consolidated_summary',
  });

  // Log parsing warnings
  if (parsed.errors.length > 0) {
    console.warn('[metaSummarize] Parser warnings:', parsed.errors);
  }

  // Check if we got a valid summary
  if (!parsed.consolidatedSummary) {
    return {
      success: false,
      error: 'No consolidated summary in response. ' + parsed.errors.join('; '),
      preservedCount: summaries.length,
      durationMs: Date.now() - startTime,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 6: Validate summary length
  // ──────────────────────────────────────────────────────────────────────────

  if (parsed.consolidatedSummary.trim().length < config.minSummaryLength) {
    return {
      success: false,
      error: `Summary too short (${parsed.consolidatedSummary.length} chars, min ${config.minSummaryLength}). Summaries preserved.`,
      preservedCount: summaries.length,
      durationMs: Date.now() - startTime,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 7: Determine which summaries were consumed
  // ──────────────────────────────────────────────────────────────────────────

  // Use indices from parsed response, or all summaries if not specified
  const consumedIndices =
    parsed.indices.length > 0
      ? parsed.indices
      : summaries.map((_, i) => i);

  const consumedSummaries = consumedIndices
    .filter((i) => i >= 0 && i < summaries.length)
    .map((i) => summaries[i]);

  if (consumedSummaries.length < 2) {
    return {
      success: false,
      error: `Only ${consumedSummaries.length} valid summaries to consolidate, need at least 2`,
      preservedCount: summaries.length,
      durationMs: Date.now() - startTime,
    };
  }

  const consumedIds = consumedSummaries.map((s) => s.id as SummaryId);

  // Calculate stats for consumed summaries only
  const consumedMessageCount = consumedSummaries.reduce(
    (sum, s) => sum + s.message_count,
    0
  );
  const consumedTimeRange = computeTimeRangeFromSummaries(consumedSummaries);

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 8: Generate embedding (optional)
  // ──────────────────────────────────────────────────────────────────────────

  let embedding: Float32Array | null = null;
  let embeddingModel: string | null = null;

  if (embedder) {
    try {
      embedding = await embedder.generate(parsed.consolidatedSummary);
      embeddingModel = 'cloudflare-bge-small-en-v1.5';
    } catch (error) {
      console.warn('[metaSummarize] Embedding generation failed (non-fatal):', error);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 9: Build draft
  // ──────────────────────────────────────────────────────────────────────────

  const draft: MetaSummaryDraft = {
    summary: parsed.consolidatedSummary,
    message_count: consumedMessageCount,
    covered_range: consumedTimeRange.display,
    covered_start: consumedTimeRange.start,
    covered_end: consumedTimeRange.end,
    source_type: 'summary',
    source_ids: consumedIds,
    embedding,
    embedding_model: embeddingModel,
    metadata: {
      ...DEFAULT_METADATA,
      ...parsed.metadata,
    },
  };

  return {
    success: true,
    draft,
    consumedIds,
    responseFormat: parsed.format,
    durationMs: Date.now() - startTime,
  };
}
