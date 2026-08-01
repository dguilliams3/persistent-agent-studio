/**
 * @persistence/core - Shared constants
 *
 * @description
 * Constants shared across all packages including cache settings,
 * API limits, and domain enums. This is the single source of truth
 * for magic strings and configuration values.
 *
 * @note Model identifiers and pricing are now co-located in provider definitions.
 * @see @persistence/core/providers for PROVIDERS, anthropic, openai
 *
 * @antipattern
 * Do not import constants from worker/src/constants.js directly.
 * Always use @persistence/core exports.
 */

// =============================================================================
// MODEL PRICING
// =============================================================================

/**
 * LLM pricing per model for cost estimation
 * All prices in dollars per million tokens
 */
export const MODEL_PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  // Claude models (Anthropic API)
  opus: {
    inputPerMillion: 5.0,      // $5 per million input tokens
    outputPerMillion: 25.0     // $25 per million output tokens
  },
  sonnet: {
    inputPerMillion: 3.0,      // $3 per million input tokens
    outputPerMillion: 15.0     // $15 per million output tokens
  },
  haiku: {
    inputPerMillion: 0.80,     // $0.80 per million input tokens
    outputPerMillion: 4.0      // $4 per million output tokens
  },
  // OpenAI models - pricing as of Jan 2026
  'gpt-4.1-mini': {
    inputPerMillion: 0.15,     // $0.15 per million input tokens
    outputPerMillion: 0.60     // $0.60 per million output tokens
  },
  'gpt-5.1': {
    inputPerMillion: 2.0,      // $2.00 per million input tokens
    outputPerMillion: 8.0      // $8.00 per million output tokens
  },
  'gpt-5-mini': {
    inputPerMillion: 0.30,     // $0.30 per million input tokens
    outputPerMillion: 1.20     // $1.20 per million output tokens
  },
  'gpt-4o': {
    inputPerMillion: 2.50,     // $2.50 per million input tokens
    outputPerMillion: 10.0     // $10 per million output tokens
  },
  'gpt-4-turbo': {
    inputPerMillion: 10.0,     // $10 per million input tokens
    outputPerMillion: 30.0     // $30 per million output tokens
  },
  // Local models (Ollama) - $0 cost
  local: {
    inputPerMillion: 0,
    outputPerMillion: 0
  }
};

/**
 * Cache pricing modifiers (same for all models)
 *
 * Write premiums vary by TTL:
 * - 5-min TTL: 1.25x (25% premium)
 * - 1-hr TTL: 2.0x (100% premium)
 */
export const CACHE_PRICING = {
  cacheReadDiscount: 0.1,       // 90% off for cache reads (pay 10%)
  cacheWritePremium5m: 1.25,    // 25% premium for 5-min TTL writes
  cacheWritePremium1h: 2.0,     // 100% premium for 1-hr TTL writes
  cacheWritePremium: 1.25,      // Legacy: assume 5-min TTL for backwards compat
  batchDiscount: 0.5            // 50% off for batch API
} as const;

// =============================================================================
// CACHE CONFIGURATION
// =============================================================================

/**
 * Cache TTL options in seconds
 * Anthropic supports 5-minute (default) and 1-hour (extended) cache TTLs
 * Extended TTL requires beta header: extended-cache-ttl-2025-04-11
 */
export const CACHE_TTL = {
  SHORT: 300,      // 5 minutes
  LONG: 3600,      // 1 hour
} as const;

/**
 * Safety margin for cache expiry calculations
 * 0.9 = 90% of TTL, giving 10% buffer for timing jitter
 */
export const CACHE_SAFETY_MARGIN = 0.9;

/**
 * Threshold in seconds for cache-worthiness decisions
 * Derived: 1hr TTL * 90% safety margin = 3240 seconds = 54 minutes
 */
export const CACHE_THRESHOLD_SECONDS = Math.floor(CACHE_TTL.LONG * CACHE_SAFETY_MARGIN);

/**
 * Smart TTL selection thresholds
 */
export const SHORT_TTL_THRESHOLD = Math.floor(CACHE_TTL.SHORT * CACHE_SAFETY_MARGIN);  // 270s

// =============================================================================
// API LIMITS
// =============================================================================

/**
 * Claude API limits for image content blocks
 */
export const CLAUDE_IMAGE_LIMITS = {
  maxImageBytes: 5_242_880,      // 5MB - Anthropic's documented limit
  maxBase64Chars: 6_500_000,     // ~4.875MB raw - conservative buffer
} as const;

/**
 * Image compression settings for D1 storage
 * D1 has ~900KB max per row
 */
export const IMAGE_COMPRESSION = {
  maxDimension: 768,
  jpegQuality: 80,
} as const;

/**
 * Telegram message character limit
 */
export const TELEGRAM_MAX_LENGTH = 4000;

/**
 * Default max tokens for think cycle response
 */
export const DEFAULT_MAX_OUTPUT_TOKENS = 4000;

/**
 * Max tokens for web search responses
 */
export const WEB_SEARCH_MAX_TOKENS = 4000;

// =============================================================================
// TIMING CONFIGURATION
// =============================================================================

/**
 * Default cycle interval in seconds (10 minutes)
 */
export const DEFAULT_CYCLE_INTERVAL = 600;

/**
 * Maximum SLEEP duration in seconds
 */
export const MAX_SLEEP_SECONDS = CACHE_THRESHOLD_SECONDS;

/**
 * Maximum number of active reminders
 */
export const MAX_REMINDERS = 5;

/**
 * Minimum summary length to prevent data loss
 */
export const MIN_SUMMARY_LENGTH = 50;

// =============================================================================
// HISTORY TYPES
// =============================================================================

/**
 * History entry type identifiers
 */
export const HISTORY_TYPES = {
  thought: 'thought',
  message_to_user: 'message_to_user',
  user_message: 'user_message',
  curiosity: 'curiosity',
  art_result: 'art_result',
  user_art: 'user_art',
  art_request: 'art_request',
  search_query: 'search_query',
  search_result: 'search_result',
  cold_storage: 'cold_storage',
  note_saved: 'note_saved',
  exist: 'exist',
} as const;

/**
 * History type icons for display
 */
export const HISTORY_ICONS: Record<string, string> = {
  thought: '💭',
  message_to_user: '📤',
  user_message: '👤',
  curiosity: '🔍',
  art_result: '🖼️',
  user_art: '🎨',
  art_request: '🎨',
  search_query: '🔎',
  search_result: '📰',
  cold_storage: '🧊',
  note_saved: '📓',
  exist: '😌',
};

// =============================================================================
// ACTION TYPES
// =============================================================================

/**
 * Action type identifiers for Claude tools
 */
export const ACTION_TYPES = {
  MESSAGE_USER: 'MESSAGE_USER',
  THINK: 'THINK',
  WONDER: 'WONDER',
  REMEMBER: 'REMEMBER',
  COLD_STORAGE: 'COLD_STORAGE',
  SEARCH: 'SEARCH',
  ART: 'ART',
  NOTE: 'NOTE',
  OBSERVATION: 'OBSERVATION',
  SUMMARIZE: 'SUMMARIZE',
  REMINDER: 'REMINDER',
  SET_STATUS: 'SET_STATUS',
  SET_PROFILE_PIC: 'SET_PROFILE_PIC',
  SLEEP: 'SLEEP',
  EXIST: 'EXIST',
  SET_USER_STATUS: 'SET_USER_STATUS',
  LEARNED: 'LEARNED',
  QUESTION: 'QUESTION',
} as const;

/**
 * Action categories for grouping
 */
export const ACTION_CATEGORIES = {
  communication: ['MESSAGE_USER'],
  internal: ['THINK', 'WONDER'],
  memory: ['REMEMBER', 'COLD_STORAGE', 'NOTE', 'OBSERVATION', 'SUMMARIZE', 'REMINDER'],
  external: ['SEARCH'],
  creative: ['ART'],
  control: ['SLEEP', 'EXIST'],
  self: ['SET_STATUS', 'SET_PROFILE_PIC', 'SET_USER_STATUS', 'LEARNED', 'QUESTION'],
} as const;

// =============================================================================
// RAG RETRIEVAL DEFAULTS
// =============================================================================

/**
 * Default RAG retrieval configuration.
 * Single source of truth consumed by both @persistence/db/handlers/settings
 * and @persistence/memory/rag/retrieval/orchestrators.
 *
 * @antipattern Do NOT duplicate these values — import from @persistence/core.
 */
export const RAG_DEFAULTS = {
  topK: 3,
  recencyHalflifeDays: 14,
  minSimilarity: 0.3,
  weights: { similarity: 0.5, recency: 0.3, importance: 0.2 },
  mmrLambda: 0.7,
} as const;
