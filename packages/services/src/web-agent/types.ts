/**
 * Web Agent Digest System Types
 *
 * @module @persistence/services/web-agent/types
 * @description Type definitions for the web agent digest system.
 *
 * The web agent fetches web information on configurable topics,
 * summarizes via LLM, and logs to history for Clio's context window.
 *
 * @upstream State table (getState/setState) for config storage
 * @downstream runWebAgent(), loadWebAgentConfig(), isWebAgentDue()
 *
 * @see SPEC_v2.md in runs/RUN-20260130-2242-web-agent-architecture/
 */

import type { DrizzleD1 } from "@persistence/db";

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/**
 * @description Configuration for a scheduled web agent task.
 * Topics are searched, results summarized, and logged to history.
 *
 * @upstream State table (getState/setState)
 * @downstream runWebAgent(), loadWebAgentConfig()
 */
export interface WebAgentConfig {
  /** State key prefix for this agent's config (e.g., 'web_agent_geopolitical') */
  statePrefix: string;

  /** LLM provider for summarization */
  provider: "openai" | "anthropic";

  /** Model ID (e.g., 'gpt-4o-mini', 'haiku') */
  model: string;

  /** Topics to research (max MAX_TOPICS, enforced by DIGEST action) */
  topics: string[];

  /** Hours between runs (default: 6) */
  intervalHours: number;

  /**
   * Max articles per topic
   * NOTE: Currently unused - doWebSearch() returns plain text, not structured articles.
   * Retained for future enhancement when article-level data becomes available.
   */
  maxArticlesPerTopic: number;

  /** History type for results (must be in HISTORY_TYPES, e.g., 'web_digest') */
  historyType: string;

  /** System prompt for summarization LLM */
  systemPrompt: string;

  /** Optional: UTC hour to target (0-23). If set, only runs during this hour. */
  targetHourUTC?: number;
}

/**
 * @description Partial config for preset defaults and state loading.
 */
export type PartialWebAgentConfig = Partial<WebAgentConfig>;

// =============================================================================
// RESULT TYPES
// =============================================================================

/**
 * @description Result from processing a single topic.
 *
 * NOTE: The `articles` array is always empty in the current implementation.
 * doWebSearch() returns plain text summaries, not structured article data.
 * Field retained for future enhancement when article-level data becomes available.
 */
export interface TopicDigestResult {
  /** The topic that was searched */
  topic: string;

  /** The actual search query sent to the search service */
  searchQuery: string;

  /**
   * Parsed article data from search results.
   * NOTE: Always empty in current implementation - doWebSearch() returns text only.
   * @future Will be populated when search service returns structured data.
   */
  articles: Array<{
    title: string;
    url: string;
    snippet?: string;
  }>;

  /** LLM-generated summary of the search results */
  summary: string;

  /** Provider used for summarization (e.g., 'openai') */
  provider: string;

  /** Model used for summarization (e.g., 'gpt-4o-mini') */
  model: string;

  /** Token usage from the LLM call */
  tokens: {
    input: number;
    output: number;
  };

  /** Cost in USD for this topic's LLM call */
  cost: number;
}

/**
 * @description Full result from a web agent run.
 */
export interface WebAgentRunResult {
  /** Whether the run completed (may be true even if some topics failed) */
  success: boolean;

  /** Number of topics successfully processed */
  topicsProcessed: number;

  /** Results for each successfully processed topic */
  results: TopicDigestResult[];

  /** Total cost in USD for all LLM calls */
  totalCost: number;

  /** Duration of the run in milliseconds */
  durationMs: number;

  /** ISO timestamp of next scheduled run (if interval-based) */
  nextRunAt?: string;

  /** Error messages for any topics that failed */
  errors?: string[];
}

// =============================================================================
// DEPENDENCY INJECTION TYPES
// =============================================================================

/**
 * @description Dependencies injected into runWebAgent().
 * Uses dependency injection for testability and decoupling.
 */
export interface WebAgentDeps {
  /** D1 database instance */
  db: DrizzleD1;

  /**
   * LLM call function from response-normalizer-integration.js
   * Signature: (opts, env) => Promise<{ content, metadata: { cost, tokens, ... } }>
   */
  callLLM: (
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
    metadata: {
      cost: number;
      tokens: {
        input: number;
        output: number;
      };
    };
  }>;

  /**
   * Web search function from services/search.js
   * Signature: (query, apiKey) => Promise<{ result?: string, error?: string }>
   */
  doWebSearch: (
    query: string,
    apiKey: string,
  ) => Promise<{ result?: string; error?: string }>;

  /**
   * History logging function from @persistence/db
   */
  logHistory: (params: {
    db: DrizzleD1;
    type: string;
    content: string;
    internal?: string | null;
    cycleId?: string | number | null;
  }) => Promise<{ id: number } | null>;

  /** Get state value */
  getState: (db: DrizzleD1, key: string) => Promise<string | undefined>;

  /** Set state value */
  setState: (db: DrizzleD1, key: string, value: string | null) => Promise<void>;

  /** Environment with API keys */
  env: {
    ANTHROPIC_API_KEY?: string;
    OPENAI_API_KEY?: string;
    [key: string]: unknown;
  };
}

// =============================================================================
// PRESETS AND CONSTANTS
// =============================================================================

/** Maximum topics allowed per agent to prevent cost runaway */
export const MAX_TOPICS = 10;

/** Default retry attempts for search failures */
export const DEFAULT_RETRY_ATTEMPTS = 3;

/** Default backoff multiplier in ms (1s, 2s, 4s) */
export const DEFAULT_BACKOFF_MS = 1000;

/**
 * @description Preset configurations for common use cases.
 * These provide sensible defaults that can be overridden via state.
 */
export const WEB_AGENT_PRESETS = {
  /**
   * Geopolitical news digest - daily at 6 AM EST (11:00 UTC)
   */
  geopolitical: {
    statePrefix: "web_agent_geopolitical",
    provider: "openai" as const,
    model: "gpt-4o-mini",
    intervalHours: 24,
    maxArticlesPerTopic: 5,
    historyType: "web_digest",
    targetHourUTC: 11, // 6 AM EST = 11:00 UTC
    defaultTopics: [
      "US-China relations",
      "European Union policy",
      "Middle East developments",
    ],
    systemPrompt: `You are a concise geopolitical analyst. Given search results about a topic,
provide a 2-3 paragraph briefing covering: key developments, implications, and what to watch.
Focus on facts, not speculation. Include source attributions when available.`,
  },

  /**
   * Tech news digest - 12 hour interval
   */
  tech: {
    statePrefix: "web_agent_tech",
    provider: "openai" as const,
    model: "gpt-4o-mini",
    intervalHours: 12,
    maxArticlesPerTopic: 3,
    historyType: "web_digest",
    defaultTopics: [
      "AI and machine learning news",
      "Software development trends",
      "Tech industry news",
    ],
    systemPrompt: `You are a tech news summarizer. Given search results, provide a concise
3-paragraph summary of the most important developments. Focus on practical implications
and what it means for developers, researchers, and users.`,
  },

  /**
   * Daily briefing - 24 hour interval, runs at target hour
   */
  daily: {
    statePrefix: "web_agent_daily",
    provider: "openai" as const,
    model: "gpt-4o-mini",
    intervalHours: 24,
    maxArticlesPerTopic: 5,
    historyType: "web_digest",
    targetHourUTC: 14, // 9 AM EST = 14:00 UTC
    defaultTopics: ["World news today", "US politics news"],
    systemPrompt: `You are a daily news briefer. Given search results about a topic,
provide a concise 2-paragraph summary of the most important developments from the past day.
Be factual and balanced. Note any significant changes or emerging trends.`,
  },
} as const;

/**
 * @description Type for preset names.
 */
export type WebAgentPresetName = keyof typeof WEB_AGENT_PRESETS;

/**
 * @description State keys derived from a prefix.
 * Used by loadWebAgentConfig() and the DIGEST action.
 */
export interface WebAgentStateKeys {
  topics: string;
  enabled: string;
  lastRun: string;
  intervalHours: string;
  provider: string;
  model: string;
}

/**
 * @description Get state keys for a given prefix.
 *
 * @param statePrefix - The prefix (e.g., 'web_agent_geopolitical')
 * @returns Object with all state key names
 */
export function getWebAgentStateKeys(statePrefix: string): WebAgentStateKeys {
  return {
    topics: `${statePrefix}_topics`,
    enabled: `${statePrefix}_enabled`,
    lastRun: `${statePrefix}_last_run`,
    intervalHours: `${statePrefix}_interval_hours`,
    provider: `${statePrefix}_provider`,
    model: `${statePrefix}_model`,
  };
}
