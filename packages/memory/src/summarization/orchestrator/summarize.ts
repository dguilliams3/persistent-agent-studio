/**
 * History Summarization Orchestrator
 *
 * @module @persistence/memory/summarization/orchestrator/summarize
 * @description Pure transformation: HistoryEntry[] → SummaryDraft
 *
 * DESIGN PHILOSOPHY:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  This function is a PURE TRANSFORMER.                                   │
 * │                                                                         │
 * │  It receives:                                                           │
 * │    - HistoryEntry[] (caller fetched from DB)                           │
 * │    - LLMAdapter (caller provides their LLM implementation)              │
 * │    - EmbeddingAdapter (optional, caller provides)                       │
 * │                                                                         │
 * │  It returns:                                                            │
 * │    - SummaryDraft (ready for DB insertion)                             │
 * │    - consumedIds (entries safe to delete)                               │
 * │                                                                         │
 * │  It NEVER:                                                              │
 * │    - Touches the database directly                                      │
 * │    - Makes LLM calls except through the adapter                         │
 * │    - Cares what LLM provider is being used                              │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * CALLER RESPONSIBILITIES:
 * 1. Fetch entries from DB
 * 2. Call summarize()
 * 3. Insert draft into DB
 * 4. Delete consumed entries from DB
 *
 * @upstream Used by: platform/services/summarization.js
 * @downstream Uses: formatter/, parser/, prompt-builder
 */

import type { HistoryId, ISOTimestamp } from '../../types';
import { DEFAULT_METADATA } from '../../types';
import type {
  SummarizeRequest,
  SummarizeResult,
  SummaryDraft,
  LLMAdapter,
  EmbeddingAdapter,
  ComputedTimeRange,
} from './types';
import { formatEntriesForSummarization } from '../formatter';
import { parseHistorySummaryResponse } from '../parser';
import { buildSummarizePrompt, formatDateRange } from './prompt-builder';

/**
 * Compress history entries into a summary.
 *
 * Pure transformation: HistoryEntry[] → SummaryDraft
 * All I/O is injected via adapters.
 *
 * @param request - Entries, focus hints, and config
 * @param llm - LLM adapter (caller provides implementation)
 * @param embedder - Optional embedding adapter
 * @returns SummarizeResult (discriminated union: success or failure)
 *
 * @example
 * ```typescript
 * // Platform usage
 * const entries = await getOldestHistory(db, 50);
 * const config = await getSummarizeConfig(db);
 *
 * const result = await summarize(
 *   { entries, focusHints: 'Focus on conversations', config },
 *   { complete: (p) => callLLM(p, env) },
 *   { generate: (t) => generateEmbedding(t, env) }
 * );
 *
 * if (result.success) {
 *   await insertSummary(db, result.draft);
 *   await deleteHistoryByIds(db, result.consumedIds);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Testing with mock
 * const mockLLM: LLMAdapter = {
 *   complete: async () => JSON.stringify({
 *     summary: 'Test summary content',
 *     included_ids: [1, 2, 3],
 *     metadata: { themes: ['testing'] }
 *   })
 * };
 *
 * const result = await summarize(request, mockLLM);
 * expect(result.success).toBe(true);
 * ```
 */
export async function summarize(
  request: SummarizeRequest,
  llm: LLMAdapter,
  embedder?: EmbeddingAdapter
): Promise<SummarizeResult> {
  const startTime = Date.now();
  const { entries, focusHints, config } = request;

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 1: Validate input
  // ──────────────────────────────────────────────────────────────────────────

  if (entries.length === 0) {
    return {
      success: false,
      error: 'No entries to summarize',
      preservedCount: 0,
      durationMs: Date.now() - startTime,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 2: Format entries for LLM prompt
  // ──────────────────────────────────────────────────────────────────────────

  const formatted = formatEntriesForSummarization(entries, {
    maxTotalTokens: 8000, // Leave room for response
    maxEntryLength: 1000,
    includeIdMarkers: true,
    replaceImages: true,
  });

  // Build valid IDs set for response validation
  const validIds = new Set(entries.map((e) => e.id as number));

  // Compute time range with ISO timestamps
  const timeRange = computeTimeRangeFromEntries(entries);

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 3: Build prompt
  // ──────────────────────────────────────────────────────────────────────────

  const prompt = buildSummarizePrompt(
    formatted.text,
    timeRange,
    entries.length,
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
      preservedCount: entries.length,
      durationMs: Date.now() - startTime,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 5: Parse response
  // ──────────────────────────────────────────────────────────────────────────

  const parsed = parseHistorySummaryResponse(rawResponse, {
    validIds,
    fallbackIds: [...validIds],
  });

  // Log parsing warnings (non-fatal)
  if (parsed.errors.length > 0) {
    console.warn('[summarize] Parser warnings:', parsed.errors);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 6: Validate summary length (prevent data loss)
  // ──────────────────────────────────────────────────────────────────────────

  if (!parsed.summary || parsed.summary.trim().length < config.minSummaryLength) {
    return {
      success: false,
      error: `Summary too short (${parsed.summary?.length || 0} chars, min ${config.minSummaryLength}). Entries preserved.`,
      preservedCount: entries.length,
      durationMs: Date.now() - startTime,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 7: Generate embedding (optional, non-fatal if fails)
  // ──────────────────────────────────────────────────────────────────────────

  let embedding: Float32Array | null = null;
  let embeddingModel: string | null = null;

  if (embedder) {
    try {
      embedding = await embedder.generate(parsed.summary);
      embeddingModel = 'cloudflare-bge-small-en-v1.5'; // Default, could be passed via config
    } catch (error) {
      // Non-fatal - summary works without embedding
      console.warn('[summarize] Embedding generation failed (non-fatal):', error);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 8: Build draft
  // ──────────────────────────────────────────────────────────────────────────

  const consumedIds = parsed.includedIds as HistoryId[];

  const draft: SummaryDraft = {
    summary: parsed.summary,
    message_count: consumedIds.length,
    covered_range: timeRange.display,
    covered_start: timeRange.start,
    covered_end: timeRange.end,
    source_type: 'history',
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

// ════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Computes time range from history entries.
 *
 * @param entries - History entries
 * @returns ComputedTimeRange with display string and ISO timestamps
 */
function computeTimeRangeFromEntries(
  entries: { created_at: ISOTimestamp | string }[]
): ComputedTimeRange {
  if (entries.length === 0) {
    const now = new Date().toISOString() as ISOTimestamp;
    return { display: 'No entries', start: now, end: now };
  }

  // Find earliest and latest timestamps
  let earliest: Date | null = null;
  let latest: Date | null = null;

  for (const entry of entries) {
    const date = new Date(entry.created_at);

    if (!earliest || date < earliest) {
      earliest = date;
    }
    if (!latest || date > latest) {
      latest = date;
    }
  }

  // Should never happen given length check
  if (!earliest || !latest) {
    const now = new Date().toISOString() as ISOTimestamp;
    return { display: 'Unknown range', start: now, end: now };
  }

  // Format display string
  const display = formatDateRange(earliest, latest);

  return {
    display,
    start: earliest.toISOString() as ISOTimestamp,
    end: latest.toISOString() as ISOTimestamp,
  };
}

// formatDateRange is imported from prompt-builder.ts (single source of truth)
