/**
 * Web Agent Core Service
 *
 * @module @persistence/services/web-agent/service
 * @description Pure service for web digest - no side effects.
 *
 * This is a stateless service that:
 * - Fetches topics in parallel via SearchGateway
 * - Optionally synthesizes results with a single LLM call
 * - Returns raw data - consumers handle logging/state
 *
 * @upstream Called by:
 *   - Post-processors (digestExecutionPostProcessor)
 *   - Cron digest (cron handler in platforms/cloudflare/src/index.js)
 *   - Platform action handlers
 * @downstream Calls:
 *   - SearchGateway.search() - for parallel topic searches
 *   - callLLM() - for optional synthesis (only if synthesize=true)
 *
 * @see SPEC_v2.md in runs/RUN-20260130-2242-web-agent-architecture/
 */

import type { DrizzleD1 } from "@persistence/db";
import type { SearchGateway, SimpleSearchResult } from "../search/index.js";
import type { WebAgentConfig, PartialWebAgentConfig } from "./types";
import {
  DEFAULT_RETRY_ATTEMPTS,
  DEFAULT_BACKOFF_MS,
  getWebAgentStateKeys,
} from "./types";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Request for a digest run. Pure input - no config/state dependencies.
 */
export interface DigestRequest {
  /** Topics to search */
  topics: string[];

  /** Combine all results into one briefing via LLM? Default: false */
  synthesize?: boolean;

  /** Provider for synthesis LLM ('openai' | 'anthropic'). Default: 'openai' */
  synthesisProvider?: "openai" | "anthropic";

  /** Model for synthesis ('gpt-4o-mini', 'haiku', etc.). Default: 'gpt-4o-mini' */
  synthesisModel?: string;

  /** Custom prompt for synthesis. Default: standard briefing prompt */
  synthesisPrompt?: string;
}

/**
 * Result for a single topic search.
 */
export interface TopicSearchResult {
  topic: string;
  searchQuery: string;
  content: string; // Raw search result from doWebSearch
  success: boolean;
  error?: string;
  durationMs: number;
}

/**
 * Full digest result - pure data, no side effects applied.
 */
export interface DigestResult {
  /** Results per topic */
  topics: TopicSearchResult[];

  /** Combined briefing (only if synthesize=true) */
  synthesis?: string;

  /** Synthesis metadata (only if synthesize=true) */
  synthesisMetadata?: {
    provider: string;
    model: string;
    tokens: { input: number; output: number };
    cost: number;
  };

  /** Total duration in ms */
  durationMs: number;

  /** Topics that succeeded */
  successCount: number;

  /** Topics that failed */
  errorCount: number;
}

/**
 * Dependencies for runDigest - minimal, no state functions needed.
 */
export interface DigestDeps {
  /** Search gateway (preferred) - single entry point for all search */
  searchGateway: SearchGateway;

  /** LLM call function (only needed if synthesize=true) */
  callLLM?: (
    opts: {
      provider: string;
      model: string;
      system: string;
      messages: Array<{ role: string; content: string }>;
      maxTokens: number;
      reasoning?: string;
    },
    env: unknown,
  ) => Promise<{
    content: string;
    metadata?: {
      cost?: number;
      tokens?: { input: number; output: number };
    };
  }>;

  /** Environment (for callLLM) */
  env: {
    [key: string]: unknown;
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = DEFAULT_RETRY_ATTEMPTS,
  backoffMs: number = DEFAULT_BACKOFF_MS,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        const waitMs = backoffMs * Math.pow(2, attempt - 1);
        await sleep(waitMs);
      }
    }
  }

  throw lastError;
}

// =============================================================================
// CORE SERVICE
// =============================================================================

/**
 * @description Run a web digest - pure service, no side effects.
 *
 * Fetches all topics in parallel, optionally synthesizes into one briefing.
 * Returns raw data - consumers handle logging, state updates, notifications.
 *
 * @param request - Topics and synthesis options
 * @param deps - doWebSearch, callLLM (optional), env
 * @returns DigestResult with topic results and optional synthesis
 *
 * @example
 * // Simple parallel fetch, no synthesis
 * const result = await runDigest(
 *   { topics: ['US-China', 'EU policy', 'Tech'] },
 *   { doWebSearch, env }
 * );
 * // result.topics = [{ topic, content, success }, ...]
 *
 * @example
 * // With synthesis into one briefing
 * const result = await runDigest(
 *   { topics: ['US-China', 'EU policy'], synthesize: true },
 *   { doWebSearch, callLLM, env }
 * );
 * // result.synthesis = "Combined briefing..."
 */
export async function runDigest(
  request: DigestRequest,
  deps: DigestDeps,
): Promise<DigestResult> {
  const startTime = Date.now();
  const dateStr = new Date().toISOString().slice(0, 10);

  // 1. Parallel search all topics
  const searchPromises = request.topics.map(
    async (topic): Promise<TopicSearchResult> => {
      const topicStart = Date.now();
      const searchQuery = `${topic} latest news ${dateStr}`;

      try {
        const result = await retryWithBackoff(async () => {
          const res = await deps.searchGateway.searchSimple(searchQuery);
          if (res.error) throw new Error(res.error);
          return res;
        });

        return {
          topic,
          searchQuery,
          content: result.result || "",
          success: true,
          durationMs: Date.now() - topicStart,
        };
      } catch (error) {
        return {
          topic,
          searchQuery,
          content: "",
          success: false,
          error: (error as Error).message,
          durationMs: Date.now() - topicStart,
        };
      }
    },
  );

  const topicResults = await Promise.all(searchPromises);
  const successCount = topicResults.filter((t) => t.success).length;
  const errorCount = topicResults.filter((t) => !t.success).length;

  // 2. Optional synthesis
  let synthesis: string | undefined;
  let synthesisMetadata: DigestResult["synthesisMetadata"];

  if (request.synthesize && deps.callLLM && successCount > 0) {
    const successfulTopics = topicResults.filter((t) => t.success);
    const combined = successfulTopics
      .map((t) => `## ${t.topic}\n\n${t.content}`)
      .join("\n\n---\n\n");

    const prompt =
      request.synthesisPrompt ||
      "Synthesize these topic briefings into one coherent daily digest. Be concise but comprehensive.";

    const llmResult = await deps.callLLM(
      {
        provider: request.synthesisProvider || "openai",
        model: request.synthesisModel || "gpt-4o-mini",
        system: prompt,
        messages: [{ role: "user", content: combined }],
        maxTokens: 2000,
        reasoning: "none",
      },
      deps.env,
    );

    synthesis = llmResult.content;
    synthesisMetadata = {
      provider: request.synthesisProvider || "openai",
      model: request.synthesisModel || "gpt-4o-mini",
      tokens: {
        input: llmResult.metadata?.tokens?.input ?? 0,
        output: llmResult.metadata?.tokens?.output ?? 0,
      },
      cost: llmResult.metadata?.cost ?? 0,
    };
  }

  return {
    topics: topicResults,
    synthesis,
    synthesisMetadata,
    durationMs: Date.now() - startTime,
    successCount,
    errorCount,
  };
}

// =============================================================================
// CONFIG HELPERS (for consumers that use preset/state-based config)
// =============================================================================

/**
 * @description Checks if web agent should run based on enabled state and interval.
 * This is a helper for cron - the core runDigest() doesn't need this.
 */
export async function isWebAgentDue(
  statePrefix: string,
  intervalHours: number,
  deps: {
    db: DrizzleD1;
    getState: (db: DrizzleD1, key: string) => Promise<string | undefined>;
  },
  targetHourUTC?: number,
): Promise<boolean> {
  const stateKeys = getWebAgentStateKeys(statePrefix);

  const enabled = await deps.getState(deps.db, stateKeys.enabled);
  if (enabled !== "true") return false;

  if (targetHourUTC !== undefined) {
    const currentHour = new Date().getUTCHours();
    if (currentHour !== targetHourUTC) return false;
  }

  const lastRun = await deps.getState(deps.db, stateKeys.lastRun);
  if (!lastRun) return true;

  const elapsed = Date.now() - new Date(lastRun).getTime();
  const intervalMs = intervalHours * 60 * 60 * 1000;

  return elapsed >= intervalMs;
}

/**
 * @description Load topics from state for a preset.
 * Helper for consumers that use preset-based configuration.
 */
export async function loadTopicsFromState(
  statePrefix: string,
  deps: {
    db: DrizzleD1;
    getState: (db: DrizzleD1, key: string) => Promise<string | undefined>;
  },
): Promise<string[]> {
  const stateKeys = getWebAgentStateKeys(statePrefix);

  try {
    const topicsJson = await deps.getState(deps.db, stateKeys.topics);
    if (topicsJson) {
      const parsed = JSON.parse(topicsJson);
      if (Array.isArray(parsed)) {
        return parsed.filter((t): t is string => typeof t === "string");
      }
    }
  } catch (e) {
    console.error(
      `[WebAgent] Corrupted topics JSON for ${statePrefix}:`,
      (e as Error).message,
    );
  }

  return [];
}

/**
 * @description Loads web agent config from state table, merging with defaults.
 * Helper for consumers that use preset-based configuration.
 */
export async function loadWebAgentConfig(
  statePrefix: string,
  defaults: PartialWebAgentConfig,
  deps: {
    db: DrizzleD1;
    getState: (db: DrizzleD1, key: string) => Promise<string | undefined>;
  },
): Promise<WebAgentConfig> {
  const stateKeys = getWebAgentStateKeys(statePrefix);
  const topics = await loadTopicsFromState(statePrefix, deps);

  const providerOverride = await deps.getState(deps.db, stateKeys.provider);
  const provider =
    (providerOverride as "openai" | "anthropic") ||
    defaults.provider ||
    "openai";

  const modelOverride = await deps.getState(deps.db, stateKeys.model);
  const model = modelOverride || defaults.model || "gpt-4o-mini";

  const intervalStr = await deps.getState(deps.db, stateKeys.intervalHours);
  const intervalHours = intervalStr
    ? parseInt(intervalStr, 10)
    : defaults.intervalHours || 6;

  return {
    statePrefix,
    provider,
    model,
    topics: topics.length > 0 ? topics : defaults.topics || [],
    intervalHours: Number.isNaN(intervalHours) ? 6 : intervalHours,
    maxArticlesPerTopic: defaults.maxArticlesPerTopic || 5,
    historyType: defaults.historyType || "web_digest",
    systemPrompt:
      defaults.systemPrompt ||
      "Summarize the following search results concisely.",
    targetHourUTC: defaults.targetHourUTC,
  };
}
