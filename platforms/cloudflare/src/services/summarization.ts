/**
 * Summarization service - Platform wiring layer
 *
 * @module services/summarization
 * @description Wires platform I/O to @persistence/memory/summarization orchestrator.
 *
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  Platform (this file) handles:                                          │
 * │    - Fetching entries/summaries from DB                                 │
 * │    - Loading config from state                                          │
 * │    - Providing LLM and embedding adapters                               │
 * │    - Persisting results (insert, delete, archive)                       │
 * │    - Tracking stats in state                                            │
 * │                                                                         │
 * │  Package (@persistence/memory) handles:                                 │
 * │    - Formatting entries for prompts                                     │
 * │    - Building prompts                                                   │
 * │    - Calling LLM (via adapter)                                          │
 * │    - Parsing responses                                                  │
 * │    - Building typed drafts                                              │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Import note: CloudflareEmbeddingProvider is imported directly from
 * @persistence/embedding (not from services/index.js). The embedding re-exports
 * were removed from services/index.js as part of the embedding extraction — this
 * file and any other consumer should import from @persistence/embedding directly.
 *
 * @upstream Called by: SUMMARIZE action executor, /summarize endpoint, Telegram commands
 * @downstream Uses: @persistence/memory/summarization/orchestrator, @persistence/embedding
 */
import {
  getState,
  setState,
  getHistoryCount,
  getOldestHistory,
  deleteHistoryByIds,
  addSummary,
  getActiveSummaries,
  archiveSummaries,
} from "../db/index.js";
import {
  formatEasternDateTime,
  validateEntriesForSummarization,
} from "../utils/index.js";
// Use workspace package - relative paths don't resolve correctly with wrangler bundling
import {
  summarize,
  metaSummarize as packageMetaSummarize,
  DEFAULT_PROMPTS,
} from "@persistence/memory";
import { SUMMARIZE_CONFIG, MIN_SUMMARY_LENGTH } from "../constants.js";
import { callLLM } from "./response-normalizer-integration.js";
import { getDefaultProvider, getModelConfig } from "@persistence/llm";
import { CloudflareEmbeddingProvider } from "@persistence/embedding";
import { embeddingToBlob } from "@persistence/memory";
import type { Env } from "../bootstrap.js";

// ════════════════════════════════════════════════════════════════════════════
// ADAPTER FACTORIES
// ════════════════════════════════════════════════════════════════════════════

/**
 * Creates an LLM adapter for the summarization orchestrator.
 *
 * @param {string} provider - LLM provider ('anthropic' | 'openai')
 * @param {string} model - Model ID
 * @param {Object} env - Cloudflare environment with API keys
 * @returns {import('@persistence/memory').LLMAdapter}
 */
function createLLMAdapter(provider: string, model: string, env: Env) {
  return {
    complete: async ({
      system,
      prompt,
      maxTokens,
    }: {
      system: string;
      prompt: string;
      maxTokens: number;
    }) => {
      const result = await callLLM(
        {
          provider,
          model,
          system,
          messages: [{ role: "user", content: prompt }],
          maxTokens,
          // Disable reasoning for summarization (maximize output tokens)
          reasoning: provider === "openai" ? "none" : undefined,
        },
        env,
      );
      return result.content;
    },
  };
}

/**
 * Creates an embedding adapter for the summarization orchestrator.
 *
 * Uses CloudflareEmbeddingProvider from @persistence/embedding (not from the
 * services barrel — embedding re-exports were extracted to @persistence/embedding
 * as a standalone package). The AI binding (env.AI) is passed directly to
 * CloudflareEmbeddingProvider.fromBinding().
 *
 * @param {Object} env - Cloudflare environment with AI binding
 * @returns {import('@persistence/memory').EmbeddingAdapter}
 */
function createEmbeddingAdapter(env: Env) {
  const provider = CloudflareEmbeddingProvider.fromBinding(env.AI);
  return {
    generate: async (text: string) => {
      const result = await provider.generate(text);
      if (!result.success) {
        throw new Error(result.error?.message || "Embedding generation failed");
      }
      return result.data;
    },
  };
}

// ════════════════════════════════════════════════════════════════════════════
// CONFIG LOADERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Loads summarization config from state table.
 *
 * @param {D1Database} db
 * @returns {Promise<import('@persistence/memory').SummarizeConfig>}
 */
async function loadSummarizeConfig(db: D1Database) {
  const [maxTokens, customSystem, customInstructions] = await Promise.all([
    getState(db, "summary_max_tokens"),
    getState(db, "summarize_system_prompt"),
    getState(db, "summarize_instructions"),
  ]);

  return {
    maxResponseTokens: parseInt(maxTokens || "4000"),
    minSummaryLength: MIN_SUMMARY_LENGTH,
    systemPrompt: customSystem || DEFAULT_PROMPTS.summarize_system,
    instructions: customInstructions || DEFAULT_PROMPTS.summarize_instructions,
  };
}

/**
 * Loads meta-summarization config from state table.
 *
 * @param {D1Database} db
 * @returns {Promise<import('@persistence/memory').MetaSummarizeConfig>}
 */
async function loadMetaSummarizeConfig(db: D1Database) {
  const [maxTokens, customSystem, customInstructions] = await Promise.all([
    getState(db, "meta_summary_max_tokens"),
    getState(db, "meta_system_prompt"),
    getState(db, "meta_instructions"),
  ]);

  return {
    maxResponseTokens: parseInt(maxTokens || "4000"),
    minSummaryLength: MIN_SUMMARY_LENGTH,
    systemPrompt: customSystem || DEFAULT_PROMPTS.meta_system,
    instructions: customInstructions || DEFAULT_PROMPTS.meta_instructions,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// SUMMARIZE HISTORY
// ════════════════════════════════════════════════════════════════════════════

/**
 * Summarizes a batch of old history entries into a condensed summary.
 *
 * Uses the type-driven orchestrator from @persistence/memory.
 *
 * @upstream Called by: SUMMARIZE action executor, /summarize endpoint, Telegram command
 * @downstream Calls: summarize() from package, addSummary, deleteHistoryByIds
 *
 * @param {D1Database} db - The Cloudflare D1 database instance
 * @param {number} startIndex - Starting index (typically 0 for oldest entries)
 * @param {number} count - Number of entries to summarize
 * @param {string} focusHints - Optional focus guidance (was "claudeNotes")
 * @param {Object} env - Environment object with API keys and AI binding
 * @returns {Promise<Object>} Result object with summary details or error
 */
export async function summarizeHistory(
  db: D1Database,
  startIndex: number,
  count: number,
  focusHints: string,
  env: Env,
) {
  const startTime = Date.now();

  try {
    // ────────────────────────────────────────────────────────────────────────
    // STEP 1: Fetch entries (platform I/O)
    // ────────────────────────────────────────────────────────────────────────

    const totalCount = await getHistoryCount(db);
    const history = await getOldestHistory(db, Math.min(count + 10, 100));

    // Constrain count to config limits
    const maxAvailable = history.length;
    const minCount = SUMMARIZE_CONFIG.minSummarizeCount ?? 5;
    const maxCount = SUMMARIZE_CONFIG.maxSummarizeCount ?? 50;
    const actualCount = Math.min(
      Math.max(count, minCount),
      Math.min(maxCount, maxAvailable),
    );

    if (actualCount < minCount) {
      return {
        error: `Not enough history to summarize (need ${SUMMARIZE_CONFIG.minSummarizeCount}, have ${maxAvailable})`,
      };
    }

    const entries = history.slice(0, actualCount);

    // Validate entries
    const validation = validateEntriesForSummarization(
      entries,
      "summarizeHistory",
    );
    if (!validation.valid) {
      return {
        error: `${validation.error} (history length: ${history.length}, actualCount: ${actualCount})`,
      };
    }

    // ────────────────────────────────────────────────────────────────────────
    // STEP 2: Load config and create adapters (platform I/O)
    // ────────────────────────────────────────────────────────────────────────

    const [config, { provider, model }] = await Promise.all([
      loadSummarizeConfig(db),
      getDefaultProvider(db, "summarize"),
    ]);

    const llmAdapter = createLLMAdapter(provider, model, env);
    const embedAdapter = createEmbeddingAdapter(env);

    // ────────────────────────────────────────────────────────────────────────
    // STEP 3: Call orchestrator (pure transformation)
    // ────────────────────────────────────────────────────────────────────────

    const result = await summarize(
      {
        entries:
          entries as unknown as import("@persistence/memory").HistoryEntry[],
        focusHints,
        config,
      },
      llmAdapter,
      embedAdapter,
    );

    if (!result.success) {
      return {
        error: result.error,
        preserved: result.preservedCount,
      };
    }

    // ────────────────────────────────────────────────────────────────────────
    // STEP 4: Persist results (platform I/O)
    // ────────────────────────────────────────────────────────────────────────

    const { draft, consumedIds, responseFormat, durationMs } = result;

    // Convert Float32Array to blob for D1 storage
    const embeddingBlob = draft.embedding
      ? embeddingToBlob(draft.embedding)
      : null;

    // Insert summary
    await addSummary(
      db,
      draft.summary,
      draft.message_count,
      draft.covered_range,
      {
        sourceIds: consumedIds,
        sourceType: draft.source_type,
        embedding: embeddingBlob,
        embeddingModel: draft.embedding_model,
        metadata: draft.metadata,
      },
    );

    // Delete consumed entries
    await deleteHistoryByIds(db, consumedIds);

    // ────────────────────────────────────────────────────────────────────────
    // STEP 5: Return result (same shape as before)
    // ────────────────────────────────────────────────────────────────────────

    return {
      success: true,
      count: consumedIds.length,
      start: 0,
      summary: draft.summary,
      includedIds: consumedIds,
      metadata: draft.metadata,
      entriesOffered: entries.length,
      entriesIncluded: consumedIds.length,
      durationMs,
      provider,
      model,
      timeRange: draft.covered_range,
      responseFormat,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[summarizeHistory] Error:", msg);
    return { error: msg };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// META SUMMARIZE
// ════════════════════════════════════════════════════════════════════════════

/**
 * Meta-summarizes summaries with Claude-driven selection.
 *
 * Uses the type-driven orchestrator from @persistence/memory.
 *
 * Two modes of operation:
 * 1. MANUAL OVERRIDE (indices provided): Consolidate specific summaries by index
 * 2. CLAUDE-DRIVEN (no indices): Consolidate all active summaries
 *
 * @upstream Called by: METASUMMARIZE action executor, /metasummarize endpoint, Telegram command
 * @downstream Calls: metaSummarize() from package, addSummary, archiveSummaries
 *
 * @param {D1Database} db - The Cloudflare D1 database instance
 * @param {number[]|null} indices - Specific indices to consolidate (null = all)
 * @param {string} focusHints - Optional focus guidance (was "claudeNotes")
 * @param {Object} env - Environment object with API keys and AI binding
 * @returns {Promise<Object>} Result object
 */
export async function metaSummarizeWrapper(
  db: D1Database,
  indices: number[] | null,
  focusHints: string,
  env: Env,
) {
  const startTime = Date.now();

  try {
    // ────────────────────────────────────────────────────────────────────────
    // STEP 1: Fetch summaries (platform I/O)
    // ────────────────────────────────────────────────────────────────────────

    const activeSummaries = await getActiveSummaries(db);

    if (activeSummaries.length < 2) {
      return {
        error: `Need at least 2 active summaries to metasummarize (have ${activeSummaries.length})`,
      };
    }

    // If indices provided, select those summaries
    let summariesToConsolidate;
    let selectedIndices;

    if (indices && Array.isArray(indices) && indices.length > 0) {
      selectedIndices = indices
        .filter((i) => i >= 0 && i < activeSummaries.length)
        .sort((a, b) => a - b);

      if (selectedIndices.length < 2) {
        return {
          error: `Need at least 2 valid indices (got ${selectedIndices.length} valid from ${indices.length} provided)`,
        };
      }

      summariesToConsolidate = selectedIndices.map((i) => activeSummaries[i]);
    } else {
      // Use all active summaries
      summariesToConsolidate = activeSummaries;
      selectedIndices = activeSummaries.map((_, i) => i);
    }

    // ────────────────────────────────────────────────────────────────────────
    // STEP 2: Load config and create adapters (platform I/O)
    // ────────────────────────────────────────────────────────────────────────

    const [config, { provider, model }] = await Promise.all([
      loadMetaSummarizeConfig(db),
      getModelConfig(db, "metasummarize").then((r) => ({
        provider: r.provider,
        model: r.model,
      })),
    ]);

    const llmAdapter = createLLMAdapter(provider, model, env);
    const embedAdapter = createEmbeddingAdapter(env);

    // ────────────────────────────────────────────────────────────────────────
    // STEP 3: Call orchestrator (pure transformation)
    // ────────────────────────────────────────────────────────────────────────

    const result = await packageMetaSummarize(
      { summaries: summariesToConsolidate, focusHints, config },
      llmAdapter,
      embedAdapter,
    );

    if (!result.success) {
      return {
        error: result.error,
        preserved: result.preservedCount,
      };
    }

    // ────────────────────────────────────────────────────────────────────────
    // STEP 4: Persist results (platform I/O)
    // ────────────────────────────────────────────────────────────────────────

    const { draft, consumedIds, responseFormat, durationMs } = result;

    // Convert Float32Array to blob for D1 storage
    const embeddingBlob = draft.embedding
      ? embeddingToBlob(draft.embedding)
      : null;

    // Insert new meta-summary
    const newSummaryId = await addSummary(
      db,
      draft.summary,
      draft.message_count,
      draft.covered_range,
      {
        sourceIds: consumedIds,
        sourceType: draft.source_type,
        embedding: embeddingBlob,
        embeddingModel: draft.embedding_model,
        metadata: draft.metadata,
      },
    );

    // Archive consumed summaries
    await archiveSummaries(db, consumedIds, newSummaryId);

    // ────────────────────────────────────────────────────────────────────────
    // STEP 5: Return result (same shape as before)
    // ────────────────────────────────────────────────────────────────────────

    return {
      success: true,
      count: consumedIds.length,
      indices: selectedIndices,
      summary: draft.summary,
      metadata: draft.metadata,
      mode: indices ? "manual_override" : "auto",
      newSummaryId,
      archivedIds: consumedIds,
      summariesBefore: activeSummaries.length,
      summariesConsolidated: consumedIds.length,
      summariesRemaining: activeSummaries.length - consumedIds.length + 1,
      totalMessagesConsolidated: draft.message_count,
      durationMs,
      provider,
      model,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[metaSummarize] Error:", msg);
    return { error: msg };
  }
}

// Keep old function name for backward compatibility
// The old metaSummarize had complex Claude-driven selection logic
// For now, export both - callers can migrate gradually
export { metaSummarizeWrapper as metaSummarizeNew };

/**
 * Legacy metaSummarize with Claude-driven selection.
 *
 * This is the original implementation with full Claude-driven mode.
 * Use metaSummarizeNew for the type-driven version.
 */
export async function metaSummarize(
  db: D1Database,
  indices: number[] | null,
  focusHints: string,
  env: Env,
) {
  // For complex Claude-driven selection, fall back to new wrapper
  // which uses the package orchestrator
  return metaSummarizeWrapper(db, indices, focusHints, env);
}
