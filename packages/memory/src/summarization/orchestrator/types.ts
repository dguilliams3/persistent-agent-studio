/**
 * Orchestrator Types for Summarization
 *
 * @module @persistence/memory/summarization/orchestrator/types
 * @description Type-driven interfaces for the summarization orchestrator.
 *
 * DESIGN PHILOSOPHY:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  The orchestrator is a PURE TRANSFORMER between types.                  │
 * │                                                                         │
 * │  Input:  HistoryEntry[] or Summary[]                                    │
 * │  Output: SummaryDraft or MetaSummaryDraft                               │
 * │                                                                         │
 * │  All I/O (LLM calls, embeddings) is INJECTED via adapters.              │
 * │  The package doesn't know or care what LLM you're using.                │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * TYPE FLOW:
 * ```
 * HistoryEntry[] ─┬─> SummarizeRequest ─> summarize() ─> SummarizeResult
 *                 │                                            │
 *                 │                              ┌─────────────┘
 *                 │                              ▼
 *                 │                    { success: true, draft: SummaryDraft }
 *                 │                    { success: false, error, preservedCount }
 *                 │
 * Summary[] ──────┴─> MetaSummarizeRequest ─> metaSummarize() ─> MetaSummarizeResult
 *                                                                       │
 *                                                       ┌───────────────┘
 *                                                       ▼
 *                                    { success: true, draft: MetaSummaryDraft }
 *                                    { success: false, error, preservedCount }
 * ```
 *
 * @upstream Used by: orchestrator/summarize.ts, orchestrator/meta-summarize.ts
 * @downstream Uses: ../../types.ts for HistoryEntry, Summary, branded IDs
 */

import type {
  HistoryEntry,
  HistoryId,
  Summary,
  SummaryId,
  SummaryMetadata,
  ISOTimestamp,
} from '../../types';

// ════════════════════════════════════════════════════════════════════════════
// ADAPTER INTERFACES - LLM-Agnostic I/O
// ════════════════════════════════════════════════════════════════════════════

/**
 * Parameters for an LLM completion call.
 *
 * Minimal interface that any LLM can implement:
 * - Claude, GPT, Llama, Mistral, local models, mock for testing
 */
export interface LLMCompletionParams {
  /** System prompt / instructions */
  system: string;

  /** User prompt / content to process */
  prompt: string;

  /** Maximum tokens in response */
  maxTokens: number;
}

/**
 * LLM adapter interface.
 *
 * The orchestrator doesn't know what LLM it's talking to.
 * Caller provides an implementation that wraps their specific LLM.
 *
 * @example Platform implementation
 * ```typescript
 * const llmAdapter: LLMAdapter = {
 *   complete: async (params) => {
 *     const result = await callLLM({
 *       provider: 'anthropic',
 *       model: 'claude-sonnet-4-20250514',
 *       system: params.system,
 *       messages: [{ role: 'user', content: params.prompt }],
 *       maxTokens: params.maxTokens,
 *     }, env);
 *     return result.content;
 *   }
 * };
 * ```
 *
 * @example Mock for testing
 * ```typescript
 * const mockLLM: LLMAdapter = {
 *   complete: async () => JSON.stringify({
 *     summary: 'Test summary',
 *     included_ids: [1, 2, 3],
 *     metadata: {}
 *   })
 * };
 * ```
 */
export interface LLMAdapter {
  /**
   * Complete a prompt and return the response text.
   *
   * @param params - System prompt, user prompt, max tokens
   * @returns Raw response text from the LLM
   * @throws On LLM API errors (caller handles)
   */
  complete(params: LLMCompletionParams): Promise<string>;
}

/**
 * Embedding adapter interface.
 *
 * Optional - summaries work without embeddings, but RAG retrieval is better with them.
 *
 * @example Platform implementation
 * ```typescript
 * const embedAdapter: EmbeddingAdapter = {
 *   generate: async (text) => {
 *     const result = await generateEmbedding(text, env);
 *     return result.embedding;
 *   }
 * };
 * ```
 */
export interface EmbeddingAdapter {
  /**
   * Generate a vector embedding for text.
   *
   * @param text - Text to embed
   * @returns Vector embedding as Float32Array
   * @throws On embedding API errors (handled gracefully - embedding is optional)
   */
  generate(text: string): Promise<Float32Array>;
}

// ════════════════════════════════════════════════════════════════════════════
// CONFIGURATION TYPES
// ════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for summarization behavior.
 *
 * Loaded from DB state or defaults. Passed to orchestrator.
 */
export interface SummarizeConfig {
  /** Max tokens for LLM response */
  maxResponseTokens: number;

  /**
   * Minimum acceptable summary length (chars).
   * If LLM returns shorter, abort to prevent data loss.
   */
  minSummaryLength: number;

  /** System prompt for the summarizer */
  systemPrompt: string;

  /** Instructions template (injected into user prompt) */
  instructions: string;
}

/**
 * Configuration for meta-summarization.
 *
 * May differ from regular summarization (e.g., higher reasoning effort).
 */
export interface MetaSummarizeConfig {
  /** Max tokens for LLM response */
  maxResponseTokens: number;

  /** Minimum acceptable summary length (chars) */
  minSummaryLength: number;

  /** System prompt for meta-summarization */
  systemPrompt: string;

  /** Instructions template */
  instructions: string;
}

// ════════════════════════════════════════════════════════════════════════════
// REQUEST TYPES - What the orchestrator receives
// ════════════════════════════════════════════════════════════════════════════

/**
 * Request to compress history entries into a summary.
 *
 * Caller fetches entries from DB, passes them here.
 * Package transforms them into a SummaryDraft.
 */
export interface SummarizeRequest {
  /**
   * Entries to compress.
   * Caller is responsible for fetching these from DB.
   * Should be in chronological order (oldest first).
   */
  entries: HistoryEntry[];

  /**
   * Optional focus guidance for the summarizer.
   *
   * LLM-agnostic name (not "claudeNotes").
   * Tells the summarizer what to prioritize preserving.
   *
   * @example "Focus on the conversation about philosophy"
   * @example "Preserve details about the project timeline"
   */
  focusHints?: string;

  /** Configuration for this summarization */
  config: SummarizeConfig;
}

/**
 * Request to compress summaries into a meta-summary.
 *
 * Used for consolidating multiple summaries into one.
 */
export interface MetaSummarizeRequest {
  /**
   * Summaries to compress.
   * Caller fetches these from DB.
   */
  summaries: Summary[];

  /** Optional focus guidance */
  focusHints?: string;

  /** Configuration */
  config: MetaSummarizeConfig;
}

// ════════════════════════════════════════════════════════════════════════════
// DRAFT TYPES - What the orchestrator produces (ready for DB)
// ════════════════════════════════════════════════════════════════════════════

/**
 * A Summary ready for DB insertion, minus DB-assigned fields.
 *
 * The orchestrator produces this. Caller adds:
 * - id (auto-generated by DB)
 * - persona_id (caller knows the persona)
 * - tier (caller decides placement)
 * - tier_position (caller determines order)
 * - created_at (set by DB or caller)
 * - archived_at, replaced_by_id (null for new summaries)
 */
export interface SummaryDraft {
  /** The compressed content (first-person narrative) */
  summary: string;

  /** Number of entries that were compressed */
  message_count: number;

  /** Human-readable time range for display */
  covered_range: string;

  /** Machine-readable start (earliest entry timestamp) */
  covered_start: ISOTimestamp;

  /** Machine-readable end (latest entry timestamp) */
  covered_end: ISOTimestamp;

  /** Always 'history' for first-pass summarization */
  source_type: 'history';

  /** IDs of history entries that were compressed */
  source_ids: HistoryId[];

  /**
   * Vector embedding for semantic retrieval.
   * null if no embedder provided or embedding failed.
   */
  embedding: Float32Array | null;

  /** Model used for embedding (for tracking) */
  embedding_model: string | null;

  /** Extracted metadata (themes, entities, etc.) */
  metadata: SummaryMetadata;
}

/**
 * A MetaSummary draft (from compressing summaries).
 *
 * Same structure as SummaryDraft but source_type is 'summary'
 * and source_ids are SummaryId values.
 */
export interface MetaSummaryDraft {
  /** The consolidated content */
  summary: string;

  /**
   * Total message count from all source summaries.
   * Sum of source summaries' message_count fields.
   */
  message_count: number;

  /** Human-readable time range (spans all source summaries) */
  covered_range: string;

  /** Earliest timestamp from source summaries */
  covered_start: ISOTimestamp;

  /** Latest timestamp from source summaries */
  covered_end: ISOTimestamp;

  /** Always 'summary' for meta-summarization */
  source_type: 'summary';

  /** IDs of summaries that were compressed */
  source_ids: SummaryId[];

  /** Vector embedding */
  embedding: Float32Array | null;

  /** Embedding model used */
  embedding_model: string | null;

  /** Extracted metadata */
  metadata: SummaryMetadata;
}

// ════════════════════════════════════════════════════════════════════════════
// RESULT TYPES - Discriminated unions for success/failure
// ════════════════════════════════════════════════════════════════════════════

/**
 * Successful summarization result.
 */
export interface SummarizeSuccess {
  success: true;

  /** The draft ready for DB insertion */
  draft: SummaryDraft;

  /**
   * IDs of entries that were actually included in the summary.
   * These are safe to delete from history.
   * May be a subset of request.entries if LLM skipped some.
   */
  consumedIds: HistoryId[];

  /** How the LLM response was parsed ('json' | 'legacy' | 'plain') */
  responseFormat: 'json' | 'legacy' | 'plain';

  /** Processing duration in milliseconds */
  durationMs: number;
}

/**
 * Failed summarization result.
 */
export interface SummarizeFailure {
  success: false;

  /** Error message */
  error: string;

  /**
   * Number of entries preserved (not deleted).
   * Caller should NOT delete any entries on failure.
   */
  preservedCount: number;

  /** Processing duration in milliseconds */
  durationMs: number;
}

/**
 * Result of summarize() call.
 *
 * Discriminated union - check success field to narrow type.
 *
 * @example
 * ```typescript
 * const result = await summarize(request, llm, embedder);
 * if (result.success) {
 *   // TypeScript knows: result.draft, result.consumedIds exist
 *   await insertSummary(db, result.draft);
 *   await deleteHistoryByIds(db, result.consumedIds);
 * } else {
 *   // TypeScript knows: result.error, result.preservedCount exist
 *   console.error(`Summarization failed: ${result.error}`);
 * }
 * ```
 */
export type SummarizeResult = SummarizeSuccess | SummarizeFailure;

/**
 * Successful meta-summarization result.
 */
export interface MetaSummarizeSuccess {
  success: true;

  /** The draft ready for DB insertion */
  draft: MetaSummaryDraft;

  /**
   * IDs of summaries that were consolidated.
   * Caller may archive or delete these.
   */
  consumedIds: SummaryId[];

  /** Response format detected */
  responseFormat: 'json' | 'legacy' | 'plain';

  /** Processing duration */
  durationMs: number;
}

/**
 * Failed meta-summarization result.
 */
export interface MetaSummarizeFailure {
  success: false;

  /** Error message */
  error: string;

  /** Number of summaries preserved */
  preservedCount: number;

  /** Processing duration */
  durationMs: number;
}

/**
 * Result of metaSummarize() call.
 */
export type MetaSummarizeResult = MetaSummarizeSuccess | MetaSummarizeFailure;

// ════════════════════════════════════════════════════════════════════════════
// INTERNAL TYPES - Used within orchestrator
// ════════════════════════════════════════════════════════════════════════════

/**
 * Computed time range from entries or summaries.
 *
 * Used internally by orchestrator.
 */
export interface ComputedTimeRange {
  /** Human-readable display string */
  display: string;

  /** Machine-readable start (ISO timestamp) */
  start: ISOTimestamp;

  /** Machine-readable end (ISO timestamp) */
  end: ISOTimestamp;
}
