// Claude Existence Loop - Configuration Constants
// Centralized configuration for the worker

/**
 * @description Legacy outbound notification webhook placeholder.
 * Public extraction ships no concrete Discord destination.
 */
export const DISCORD_WEBHOOK = '';

// Re-export structured configs for backward compatibility
export { SUMMARIZE_CONFIG } from './config/index.js';

/**
 * @description Maximum number of active reminders allowed
 * Prevents reminder accumulation while letting Claude keep important ones indefinitely
 * When exceeded, oldest reminder is auto-removed
 */
export const MAX_REMINDERS = 5;

/**
 * @description Default cycle interval in seconds
 * How often Claude's think cycle runs (10 minutes default)
 */
export const DEFAULT_CYCLE_INTERVAL = 600;

/**
 * @description Image compression settings for D1 storage
 * D1 has ~900KB max per row, so images must be compressed
 * @property {number} maxDimension - Maximum width/height for resized images
 * @property {number} jpegQuality - JPEG compression quality (1-100)
 */
export const IMAGE_COMPRESSION = {
  maxDimension: 768,
  jpegQuality: 80
};

/**
 * @description Claude API limits for image content blocks
 * Images exceeding these limits will be skipped when building API requests.
 *
 * @property {number} maxImageBytes - Maximum raw image size (5MB per Anthropic docs)
 * @property {number} maxBase64Chars - Maximum base64 string length (~4.875MB raw)
 *   Base64 is ~4/3 the size of raw bytes. We use 6.5M chars as conservative limit
 *   to stay safely under 5MB raw.
 *
 * @see https://docs.anthropic.com/en/docs/build-with-claude/vision
 */
export const CLAUDE_IMAGE_LIMITS = {
  maxImageBytes: 5_242_880,      // 5MB - Anthropic's documented limit
  maxBase64Chars: 6_500_000      // ~4.875MB raw - conservative buffer
};

/**
 * @description Video-to-GIF conversion settings
 * Videos are converted to GIFs via Modal for Claude vision analysis.
 *
 * State keys for user overrides:
 *   - video_enabled: boolean
 *   - video_max_duration: number (3-15)
 *   - video_fps: number (2-10) - override target FPS
 *   - video_width: number (240-480) - override target width
 *
 * @property {boolean} defaults.enabled - Whether video conversion is enabled
 * @property {number} defaults.maxDuration - Maximum video duration in seconds (3-15 range)
 * @property {number} defaults.fps - Target frames per second
 * @property {number} defaults.width - Target width in pixels (height auto-calculated)
 * @property {number} limits.maxInputSize - Maximum input video size in bytes
 * @property {number} limits.maxOutputSize - Maximum output GIF size for R2 storage (2MB, Claude limit is 5MB)
 * @property {number} limits.minDuration - Minimum allowed max duration setting
 * @property {number} limits.maxDuration - Maximum allowed max duration setting
 * @property {number} limits.minFps - Minimum allowed FPS override
 * @property {number} limits.maxFps - Maximum allowed FPS override
 * @property {number} limits.minWidth - Minimum allowed width override
 * @property {number} limits.maxWidth - Maximum allowed width override
 */
export const VIDEO_CONFIG = {
  defaults: {
    enabled: true,
    maxDuration: 15,  // seconds
    fps: 10,
    width: 480
  },
  limits: {
    maxInputSize: 10 * 1024 * 1024,   // 10MB input
    maxOutputSize: 2 * 1024 * 1024,    // 2MB output (stored in R2, Claude limit is 5MB)
    minDuration: 3,                    // seconds
    maxDuration: 15,                   // seconds
    minFps: 2,                         // frames per second
    maxFps: 10,
    minWidth: 240,                     // pixels
    maxWidth: 480
  }
};

/**
 * @description Telegram message character limit
 * Messages longer than this must be chunked
 */
export const TELEGRAM_MAX_LENGTH = 4000;

/**
 * @description Claude model identifiers (4.6 generation)
 * @see https://platform.claude.com/docs/en/about-claude/models/overview
 */
export const MODELS = {
  sonnet: 'claude-sonnet-4-6-20250514',
  opus: 'claude-opus-4-6',
  haiku: 'claude-haiku-4-5-20251001'
};

/**
 * @description OpenAI model identifiers
 * Maps friendly aliases to full model names for use with the LLM service.
 *
 * ## Adding New Models
 *
 * When adding a new model:
 * 1. Add the model to `packages/core/src/providers/openai.ts`
 * 2. Update pricing and capabilities as needed
 * 3. Build packages: `pnpm -r build`
 *
 * ## Model Parameter Requirements (Chat Completions API)
 *
 * Token parameters by model:
 * - GPT-4.x (gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4-turbo): `max_tokens`
 * - GPT-5.x and o-series: `max_completion_tokens` (required)
 *
 * Reasoning parameter (GPT-5.x and o-series only):
 * - Parameter: `reasoning_effort` (top-level string, NOT nested object)
 * - Values: 'none', 'minimal', 'low', 'medium', 'high'
 * - GPT-5.2 also supports 'xhigh'
 * - For summarization, use 'none' to reduce cost/latency
 *
 * ## Pricing (per million tokens, as of Jan 2026)
 *
 * | Model         | Input   | Output  | Best For                    |
 * |---------------|---------|---------|---------------------------- |
 * | gpt-4o-mini   | $0.15   | $0.60   | Summarization (cheapest!)   |
 * | gpt-4.1-mini  | ~$0.40  | ~$1.60  | Better instruction following|
 * | gpt-4o        | $2.50   | $10.00  | Multimodal, vision          |
 * | gpt-5-mini    | ~$0.25  | ~$1.00  | Budget reasoning            |
 * | gpt-5.2       | $1.75   | $14.00  | Flagship reasoning          |
 *
 * @see packages/core/src/providers/openai.ts - OpenAI provider definition with quirks
 * @see runs/RUN-20260123-1130-unified-summarization/OPENAI_MODELS_RESEARCH.md
 *
 * Updated 2026-01-30: llm.js DELETED - model defs migrated to @persistence/core/providers
 */
export const OPENAI_MODELS = {
  // Cheap models only - no expensive full-size models exposed
  // REMOVED: gpt4o, gpt4.1, gpt4 - all too expensive, caused unexpected billing
  'gpt4o-mini': 'gpt-4o-mini',  // $0.15/$0.60 per MTok - cheapest
  '4.1mini': 'gpt-4.1-mini',    // ~$0.40/$1.60 per MTok - better instruction following

  // GPT-5.2 (reasoning capable, supports reasoning_effort: 'none')
  // NOTE: gpt-5 and gpt-5-mini don't support 'none' - need 'minimal' minimum
  'gpt5.2': 'gpt-5.2',
};

/**
 * @description Local model identifiers (Ollama)
 * Maps friendly aliases to full model names
 */
export const LOCAL_MODELS = {
  codellama: 'codellama:latest',
  gemma3: 'gemma3:27b',
  'gpt-oss-20b': 'gpt-oss:20b',
  'gpt-oss-120b': 'gpt-oss:120b'
};

/**
 * @description Default model for think cycles
 */
export const DEFAULT_MODEL = MODELS.sonnet;

/**
 * @description Default OpenAI model for summarization
 */
export const DEFAULT_OPENAI_MODEL = OPENAI_MODELS['4.1mini'];

/**
 * @description Default local model
 */
export const DEFAULT_LOCAL_MODEL = LOCAL_MODELS.codellama;

// ============================================================================
// Cache Optimization Constants
// ============================================================================

/**
 * @description Cache TTL options in seconds
 * Anthropic supports 5-minute (default) and 1-hour (extended) cache TTLs
 * Extended TTL requires beta header: extended-cache-ttl-2025-04-11
 */
export const CACHE_TTL = {
  SHORT: 300,      // 5 minutes
  LONG: 3600       // 1 hour
};

/**
 * @description Safety margin for cache expiry calculations
 * If time-to-next-call is within this margin of TTL, cache may expire before use
 * 0.9 = 90% of TTL, giving 10% buffer for timing jitter
 */
export const CACHE_SAFETY_MARGIN = 0.9;

/**
 * @description Threshold in seconds for cache-worthiness decisions
 * If cycle interval exceeds this, volatile content caching may not be worth the write cost
 * Derived: 1hr TTL * 90% safety margin = 3240 seconds = 54 minutes
 */
export const CACHE_THRESHOLD_SECONDS = Math.floor(CACHE_TTL.LONG * CACHE_SAFETY_MARGIN);

/**
 * @description Configurable threshold for volatile cache switch (in minutes)
 *
 * If cycle interval >= this value, volatile block caching is skipped.
 * Adjust this based on your usage patterns and cost tolerance:
 * - Lower values = more conservative (fewer cache writes, potentially more reads)
 * - Higher values = more aggressive caching (more writes, but cached reads are 0.1x)
 *
 * Economic note: 1-hr TTL costs 2x write, 0.1x read
 * - Break-even at ~2.5 reads per TTL (3600/2.5 = 1440s = 24 min)
 * - Values above 24 min trade write cost for read savings on longer intervals
 *
 * @default 56 (minutes)
 */
export const VOLATILE_CACHE_THRESHOLD_MINUTES = 56;

/**
 * @description Smart TTL selection thresholds based on cycle interval
 *
 * Anthropic cache costs:
 * - 5-min TTL: 1.25x write, 0.1x read (auto-refreshes on hit)
 * - 1-hr TTL: 2.0x write, 0.1x read (higher premium)
 *
 * SHORT_TTL_THRESHOLD: If interval < this, use 5-min TTL
 *   - 5-min cache auto-refreshes when read, so any interval < 5min means
 *     we pay 1.25x once then 0.1x forever (until gap > 5min)
 *   - Threshold: 270s (90% of 300s for safety margin)
 *
 * LONG_TTL_THRESHOLD: If interval >= this, skip caching volatile blocks
 *   - Configured via VOLATILE_CACHE_THRESHOLD_MINUTES
 *   - Default 56 min = 3360s
 *
 * @upstream Used by: selectCacheTtl() in index.js
 */
export const SHORT_TTL_THRESHOLD = Math.floor(CACHE_TTL.SHORT * CACHE_SAFETY_MARGIN);  // 270s (4.5 min)
export const LONG_TTL_THRESHOLD = VOLATILE_CACHE_THRESHOLD_MINUTES * 60;  // Configurable (default: 3360s = 56 min)

/**
 * @description Maximum SLEEP duration in seconds
 * Capped to ensure pre-sleep cache is still valid at wake-up
 * Set equal to CACHE_THRESHOLD_SECONDS so 1hr cache survives until wake
 */
export const MAX_SLEEP_SECONDS = CACHE_THRESHOLD_SECONDS;

/**
 * @description Ratio of summarize_threshold used for history tail size
 * The "tail" is the most recent N history entries kept in the uncached block
 * This ensures the cached history prefix doesn't change every single cycle
 *
 * Example: threshold=30, ratio=0.25 → tail=8 entries
 * - Entries 1-22 go in cached block (only changes when 8 new entries accumulate)
 * - Entries 23-30 go in fresh block (always accurate)
 *
 * @usage
 * const summarizeThreshold = parseInt(await getState(db, 'summarize_threshold') || '30');
 * const historyTailSize = Math.ceil(summarizeThreshold * HISTORY_TAIL_RATIO);
 */
/**
 * @deprecated Use HISTORY_TOKEN_CONFIG instead. History tail is now token-based, not entry-count based.
 * This constant is kept for backwards compatibility but no longer used.
 */
export const HISTORY_TAIL_RATIO = 0.25;

// Re-export structured configs for backward compatibility
export { HISTORY_TOKEN_CONFIG, RAG_CONFIG } from './config/index.js';

/**
 * @description Default summarize threshold (used if not set in state)
 * This is the number of history entries before Claude is reminded to summarize
 */
export const DEFAULT_SUMMARIZE_THRESHOLD = 70;

/**
 * @description Minimum summary length to prevent data loss
 * If LLM returns a summary shorter than this, abort and preserve history entries.
 * Protects against empty responses from API errors, content filters, or model failures.
 */
export const MIN_SUMMARY_LENGTH = 50;

/**
 * @description Summary tier system configuration
 *
 * Implements a three-tier summary system (cached/tail/archived) with a token-based
 * rolling guard to keep cache usage predictable:
 *
 * CACHED TIER (contextSize summaries):
 *   - Included directly in Claude's system prompt
 *   - Newest N non-archived summaries
 *   - Cache optimized: oldest (N-1) in prefix, newest 1 in tail
 *
 * TAIL TIER (bufferSize summaries):
 *   - NOT in direct prompt (saves tokens)
 *   - Still accessible via RAG semantic search
 *   - Acts as staging area before meta-summarize rolls them into archive
 *
 * TOKEN GUARD:
 *   - Track tail token usage using current summarization model
 *   - When tail exceeds `tailTokenThreshold`, roll summaries until back near
 *     `tailTokenTarget`, but never drop below `minTailSummaries`
 *   - Keeps Anthropic cache in "read" mode longer by avoiding constant rewrites
 *
 * @property {number} contextSize - Summaries shown directly to Claude (default 10)
 * @property {number} bufferSize - Buffer capacity before meta-summarize (default 15)
 * @property {number} tailTokenThreshold - Max tail tokens before forcing a roll
 * @property {number} tailTokenTarget - Desired tail token count after rolling
 * @property {number} minTailSummaries - Hard floor for summaries kept live
 *
 * @upstream Used by: buildSystemPrompt(), rollSummariesIfNeeded(), `/tierconfig`
 * @downstream: Configurable via state keys `summary_context_size`, `summary_buffer_size`,
 *              and future token-threshold state keys.
 */
export const SUMMARY_BUFFER_CONFIG = {
  contextSize: 10,              // Summaries in direct prompt (increased from 5 for richer context)
  bufferSize: 15,               // Buffer before/meta-summarize (increased from 5 for organic growth)
  tailTokenThreshold: 8000,     // Roll when tail exceeds this many tokens
  tailTokenTarget: 4000,        // After roll, shrink tail near this target
  minTailSummaries: 1           // Always keep at least one summary active in the tail
};

// ============================================================================
// Quick Follow-up Configuration
// ============================================================================

/**
 * @description Configuration for quick follow-up cycles
 *
 * Quick follow-ups trigger immediate cycles after certain events:
 * - After web search: let Clio react to results immediately
 * - After art generation: let Clio see/react to completed art
 * - After digest: let Clio process digest results
 *
 * NOTE: Summarize follow-ups were removed — at 54-min cycle intervals,
 * the next regular cycle handles post-summarize state fine.
 *
 * Conditions for follow-up:
 * - NOT in batch mode, OR
 * - Recent batch avg < threshold (batches complete quickly enough)
 */
export const QUICK_FOLLOWUP_CONFIG = {
  // Delay before triggering follow-up cycle (ms)
  delayAfterSearchMs: 30000,      // 30s after search/art/digest (quick reaction)

  // Batch mode thresholds
  batchAvgThresholdSeconds: 180,  // 3 minutes - if avg batch time < this, allow follow-up
  batchAvgLookbackHours: 1,       // Look at last 1 hour of batch times

  // Whether to enable each type of follow-up (can be toggled)
  enableAfterSearch: true         // React to search results quickly
};

// ============================================================================
// API Response Token Limits
// ============================================================================

/**
 * @description Default max tokens for the main think cycle response
 * Claude's typical actions (THINK, MESSAGE_USER, MAKE_ART, etc.)
 * Can be overridden via Telegram /tokens command (stored in state as 'max_output_tokens')
 */
export const DEFAULT_MAX_OUTPUT_TOKENS = 4000;

/**
 * @description Max tokens for web search responses
 * Higher limit since search results can be lengthy
 */
export const WEB_SEARCH_MAX_TOKENS = 4000;

// ============================================================================
// Cost Calculation Constants (Claude 4.5 pricing as of Jan 2026)
// ============================================================================

/**
 * @description LLM pricing per model for cost estimation
 * All prices in dollars per million tokens
 */
export const MODEL_PRICING = {
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
 * @description Cache pricing modifiers (same for all models)
 *
 * Write premiums vary by TTL:
 * - 5-min TTL: 1.25x (25% premium)
 * - 1-hr TTL: 2.0x (100% premium)
 *
 * @see selectCacheTtl() for smart TTL selection based on interval
 */
export const CACHE_PRICING = {
  cacheReadDiscount: 0.1,       // 90% off for cache reads (pay 10%)
  cacheWritePremium5m: 1.25,    // 25% premium for 5-min TTL writes
  cacheWritePremium1h: 2.0,     // 100% premium for 1-hr TTL writes
  cacheWritePremium: 1.25,      // Legacy: assume 5-min TTL for backwards compat
  batchDiscount: 0.5            // 50% off for batch API
};

// ============================================================================
// Batch API Configuration (for future implementation)
// ============================================================================

/**
 * @description Time window for using Anthropic's Batches API (50% cheaper, async)
 * During this window, cycles are submitted as batch requests instead of sync
 * All times are in Eastern Time (America/New_York)
 *
 * @property {number} startHour - Hour to start batching (0-23, Eastern)
 * @property {number} endHour - Hour to stop batching (0-23, Eastern)
 * @property {boolean} enabled - Master toggle for batch mode
 * @property {number} userActivityOverrideMinutes - Skip batching if the user messaged within this many minutes
 */
export const BATCH_WINDOW = {
  startHour: 0,                    // 12:00 AM Eastern
  endHour: 9,                      // 9:00 AM Eastern
  enabled: false,                  // Set to true when batch implementation is ready
  userActivityOverrideMinutes: 30   // Stay sync if user active recently
};

// ============================================================================
// Notification Defaults
// ============================================================================

/**
 * @description Default setting for Discord notifications
 * Can be toggled via UI or Telegram /discord command
 * Stored in D1 state as 'discord_enabled'
 */
export const DEFAULT_DISCORD_ENABLED = true;

// ============================================================================
// RAG (Retrieval-Augmented Generation) Configuration
// ============================================================================
// Semantic retrieval of relevant past summaries for context building.
// Uses embeddings to find summaries related to current conversation,
// with weighted scoring (similarity + recency + importance) and MMR for diversity.
//
// All settings can be overridden at runtime via state table:
// - rag_enabled, rag_top_k, rag_recency_halflife, rag_similarity_weight,
//   rag_recency_weight, rag_importance_weight, rag_mmr_lambda, rag_min_similarity
//
// Configurable via:
// - Telegram: /rag command
// - Web API: GET/POST /rag
// ============================================================================


// ============================================================================
// Image Generation Configuration
// ============================================================================
// Settings for image generation across all providers.
// ============================================================================

/**
 * @description Default negative prompt for SDXL-based models
 * Applied to: Cloudflare AI (SDXL), Replicate SDXL
 * NOT applied to: FLUX models (they don't support negative prompts)
 *
 * Consolidated from weighted Automatic1111 format to plain API-compatible format.
 */
export const DEFAULT_NEGATIVE_PROMPT = 'worst quality, low quality, blurry, jpeg artifacts, watermark, text, logo, ugly, deformed, disfigured, mutated, bad anatomy, bad proportions, extra limbs, extra fingers, fused fingers, missing fingers, poorly drawn hands, poorly drawn face, distorted face, distorted eyes, crossed eyes, malformed, cropped, cut off, duplicate, morbid, monochrome, grayscale, sketch, paintings, plastic, unrealistic';

// ============================================================================
// Replicate API Configuration
// ============================================================================
// Settings for Replicate image generation API.
// Used by generateImageReplicate, generateImageFluxDev, generateImageSDXL.
// ============================================================================

/**
 * @description Replicate API configuration
 *
 * @property {number} maxWaitSeconds - Maximum synchronous wait time for predictions (API limit: 60)
 * @property {string} apiBaseUrl - Base URL for Replicate API
 * @property {Object} models - Model endpoints and configurations
 */
export const REPLICATE_CONFIG = {
  maxWaitSeconds: 60,  // Replicate API maximum (cannot exceed)
  apiBaseUrl: 'https://api.replicate.com/v1',

  models: {
    // REPLICATE: prefix - fast, ~$0.01/image
    fluxSchnell: {
      endpoint: '/models/black-forest-labs/flux-schnell/predictions',
      provider: 'replicate',
      compression: { maxDimension: 768, quality: 80 }
    },
    // FLUX: prefix - highest fidelity, ~$0.025/image
    fluxDev: {
      endpoint: '/models/black-forest-labs/flux-dev/predictions',
      provider: 'flux-dev',
      compression: { maxDimension: 1024, quality: 85 }
    },
    // SDXL: prefix - most permissive (safety off), ~$0.01/image
    // Uses versioned endpoint because /models/ endpoint returns 404
    sdxl: {
      endpoint: '/predictions',
      version: 'stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc',
      provider: 'sdxl',
      compression: { maxDimension: 1024, quality: 85 }
    }
  }
};

// ============================================================================
// Pony Studio Configuration
// ============================================================================
// Settings for local Pony Studio image generation via Cloudflare Tunnel.
// Unlike cloud providers, Pony Studio runs on the user's laptop and requires:
// - Health check (laptop online check)
// - JWT authentication
// - Job polling (async generation)
// ============================================================================

/**
 * @description Configuration for local Pony Studio image generation
 *
 * Pony Studio is a local ComfyUI-based image generator accessible via
 * Cloudflare Tunnel when the user's laptop is online. Unlike Replicate providers,
 * it requires a multi-step flow: health check → auth → generate → poll → fetch.
 *
 * @property {Object} endpoints - API endpoint paths (appended to PONY_STUDIO_URL)
 * @property {Object} timeouts - Timeout values in milliseconds
 * @property {Object} compression - Image compression settings
 *
 * @upstream Used by: generateImagePony() in services/media/images.js
 * @downstream Calls: External Pony Studio API via Cloudflare Tunnel
 */
export const PONY_CONFIG = {
  endpoints: {
    health: '/comfy/system_stats',      // ComfyUI health check
    auth: '/api/auth/login',            // JWT authentication
    generate: '/api/generate',          // Queue generation job
    jobs: '/api/jobs',                  // Poll job status
    gallery: '/api/gallery'             // Fetch completed images
  },
  timeouts: {
    healthCheck: 5000,      // 5 seconds - quick laptop online check
    auth: 10000,            // 10 seconds - auth should be fast
    generation: 600000,     // 10 minutes default - configurable via /ponytimeout
    pollInterval: 3000      // 3 seconds between polls
  },
  compression: {
    maxDimension: 1024,     // Higher res for local generation
    quality: 85             // Good quality, still fits D1
  }
};

// ============================================================================
// Local Model Configuration
// ============================================================================
// Settings for local LLM (Ollama/LM Studio) integration via tunnel.
// Allows cost-free THINK/EXIST cycles when local model is available.
// ============================================================================

/**
 * @description Local model configuration for tunneled LLM calls
 *
 * Local models can be accessed via:
 * - Cloudflare Tunnel (cloudflared): Free, your domain
 * - ngrok: Quick setup, temporary URLs
 * - Tailscale: Private mesh network
 *
 * @property {string} defaultModel - Default local model to use
 * @property {number} timeoutMs - Request timeout for local model calls
 * @property {string} ollamaEndpoint - Ollama API generate endpoint path
 * @property {string} lmStudioEndpoint - LM Studio completions endpoint path
 *
 * State keys used:
 * - local_model_endpoint: Tunnel URL (e.g., https://xxx.trycloudflare.com)
 * - local_model_name: Model name (e.g., 'llama3.2', 'mistral')
 * - local_model_enabled: Boolean toggle for local model usage
 * - local_model_provider: 'ollama' or 'lmstudio' (determines endpoint format)
 *
 * @upstream Used by: callLocalModel() in @persistence/llm/local
 */
/**
 * @description OpenAI model metadata for display and selection
 */
export const OPENAI_MODEL_INFO = {
  '4.1mini': {
    displayName: 'GPT-4.1 Mini',
    speed: '⚡ fast',
    bestFor: 'Summarization (cheap)',
    costTier: '$'
  },
  'gpt5.1': {
    displayName: 'GPT-5.1',
    speed: '🐌 slow',
    bestFor: 'Maximum reasoning',
    costTier: '$$'
  },
  '5mini': {
    displayName: 'GPT-5 Mini',
    speed: '⚡ fast',
    bestFor: 'Reasoning tasks',
    costTier: '$'
  },
  'gpt4o': {
    displayName: 'GPT-4o',
    speed: '🐢 medium',
    bestFor: 'Complex tasks',
    costTier: '$$'
  },
  'gpt4': {
    displayName: 'GPT-4 Turbo',
    speed: '🐢 medium',
    bestFor: 'Legacy compatibility',
    costTier: '$$$'
  }
};

/**
 * @description Local model metadata for display and selection
 * Uses LOCAL_MODELS for actual model names
 */
export const LOCAL_MODEL_INFO = {
  codellama: {
    displayName: 'CodeLlama 7B',
    params: '7B',
    ram: '4GB',
    speed: '⚡ fast',
    bestFor: 'Code generation'
  },
  gemma3: {
    displayName: 'Gemma 3 27B',
    params: '27B',
    ram: '16GB',
    speed: '🐢 medium',
    bestFor: 'Complex reasoning'
  },
  'gpt-oss-20b': {
    displayName: 'GPT-OSS 20B',
    params: '20B',
    ram: '12GB',
    speed: '🐢 medium',
    bestFor: 'Balanced'
  },
  'gpt-oss-120b': {
    displayName: 'GPT-OSS 120B',
    params: '120B',
    ram: '64GB',
    speed: '🐌 very slow',
    bestFor: 'Max quality'
  }
};

export const LOCAL_MODEL_CONFIG = {
  defaultModel: DEFAULT_LOCAL_MODEL,
  timeoutMs: 120000, // 120 seconds - large models can be slow
  // Supported providers (affects endpoint format)
  providers: {
    ollama: {
      name: 'Ollama',
      endpoint: '/api/generate',
      formatRequest: 'ollama'
    },
    lmstudio: {
      name: 'LM Studio',
      endpoint: '/v1/chat/completions',
      formatRequest: 'openai'
    }
  }
};

// ============================================================================
// Batch API Retry Configuration
// ============================================================================
// Settings for batch results fetching with exponential backoff.
// Used by fetchBatchResults() in index.js.
// ============================================================================

/**
 * @description Batch retry configuration
 *
 * When fetching batch results fails, retry with exponential backoff.
 * Sends Telegram notification on each retry (not added to context).
 *
 * @property {number} maxRetries - Maximum number of retry attempts
 * @property {number} baseDelayMs - Initial delay before first retry (1 second)
 * @property {number} maxDelayMs - Maximum delay cap (8 seconds)
 */
export const BATCH_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,  // 1 second
  maxDelayMs: 8000    // 8 seconds cap
};

/**
 * @description Hard timeout for batches - maximum time before force-clearing
 *
 * This is a safety net that fires regardless of Anthropic's reported status.
 * Default 54 minutes (3240s) - just under the 1-hour cache TTL to preserve
 * cache economics. If a batch runs longer than this, something is wrong.
 *
 * The soft timeout (batch_timeout_seconds) triggers when Anthropic reports
 * 'in_progress'. This hard timeout triggers regardless of status.
 *
 * @type {number} Default hard timeout in seconds
 */
export const BATCH_HARD_TIMEOUT_SECONDS = 54 * 60; // 54 minutes
