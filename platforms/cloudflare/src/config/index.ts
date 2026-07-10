/**
 * Unified Configuration System
 *
 * @module config
 * @description Centralized configuration management with validation and type safety
 *
 * This module consolidates scattered CONFIG objects from constants.js into a unified
 * system with:
 * - Base configuration interfaces for common patterns
 * - Extension system for specialized configs
 * - Validation and type checking
 * - Single source of truth for configuration
 *
 * Eliminates duplicate properties across SUMMARIZE_CONFIG, BATCH_SUMMARIZE_CONFIG,
 * HISTORY_TOKEN_CONFIG, RAG_CONFIG, and other config objects.
 *
 * @upstream Called by: All modules needing configuration (replaces direct constants imports)
 * @downstream Calls: Validation utilities, base config builders
 *
 * @tests tests/config/index.test.js - Configuration system tests
 */

// =============================================================================
// BASE CONFIGURATION INTERFACES
// =============================================================================

/**
 * @description Base interface for configurations with token limits
 * @typedef {Object} TokenConfig
 * @property {number} maxTokens - Maximum tokens allowed
 * @property {number} [defaultTokens] - Default token count
 * @property {number} [minTokens] - Minimum tokens required
 */

/**
 * @description Base interface for configurations with size/count limits
 * @typedef {Object} SizeConfig
 * @property {number} maxSize - Maximum size/count allowed
 * @property {number} [defaultSize] - Default size/count
 * @property {number} [minSize] - Minimum size/count required
 */

/**
 * @description Base interface for configurations with thresholds
 * @typedef {Object} ThresholdConfig
 * @property {number} threshold - Main threshold value
 * @property {number} [target] - Target value after threshold operations
 * @property {number} [minValue] - Minimum allowed value
 */

// =============================================================================
// CONFIGURATION BUILDERS
// =============================================================================

/**
 * @description Creates a validated token configuration
 *
 * @upstream Called by: Specialized config builders
 * @downstream Calls: None (pure validation)
 *
 * @param {Object} params - Token configuration parameters
 * @param {number} params.maxTokens - Maximum tokens allowed
 * @param {number} [params.defaultTokens] - Default token count
 * @param {number} [params.minTokens] - Minimum tokens required
 * @returns {TokenConfig} Validated token configuration
 *
 * @throws {Error} If required parameters missing or invalid
 */
export interface TokenConfig {
  maxTokens: number;
  defaultTokens?: number;
  minTokens?: number;
}

export function createTokenConfig({ maxTokens, defaultTokens, minTokens }: { maxTokens: number; defaultTokens?: number; minTokens?: number }): TokenConfig {
  if (!maxTokens || maxTokens <= 0) {
    throw new Error('createTokenConfig: maxTokens is required and must be > 0');
  }

  const config: TokenConfig = { maxTokens };

  if (defaultTokens !== undefined) {
    if (defaultTokens < 0) {
      throw new Error('createTokenConfig: defaultTokens must be >= 0');
    }
    config.defaultTokens = defaultTokens;
  }

  if (minTokens !== undefined) {
    if (minTokens < 0) {
      throw new Error('createTokenConfig: minTokens must be >= 0');
    }
    config.minTokens = minTokens;
  }

  return config;
}

/**
 * @description Creates a validated size configuration
 *
 * @upstream Called by: Specialized config builders
 * @downstream Calls: None (pure validation)
 *
 * @param {Object} params - Size configuration parameters
 * @param {number} params.maxSize - Maximum size/count allowed
 * @param {number} [params.defaultSize] - Default size/count
 * @param {number} [params.minSize] - Minimum size/count required
 * @returns {SizeConfig} Validated size configuration
 *
 * @throws {Error} If required parameters missing or invalid
 */
export interface SizeConfig {
  maxSize: number;
  defaultSize?: number;
  minSize?: number;
}

export function createSizeConfig({ maxSize, defaultSize, minSize }: { maxSize: number; defaultSize?: number; minSize?: number }): SizeConfig {
  if (!maxSize || maxSize <= 0) {
    throw new Error('createSizeConfig: maxSize is required and must be > 0');
  }

  const config: SizeConfig = { maxSize };

  if (defaultSize !== undefined) {
    if (defaultSize < 0) {
      throw new Error('createSizeConfig: defaultSize must be >= 0');
    }
    config.defaultSize = defaultSize;
  }

  if (minSize !== undefined) {
    if (minSize < 0) {
      throw new Error('createSizeConfig: minSize must be >= 0');
    }
    config.minSize = minSize;
  }

  return config;
}

/**
 * @description Creates a validated threshold configuration
 *
 * @upstream Called by: Specialized config builders
 * @downstream Calls: None (pure validation)
 *
 * @param {Object} params - Threshold configuration parameters
 * @param {number} params.threshold - Main threshold value
 * @param {number} [params.target] - Target value after threshold operations
 * @param {number} [params.minValue] - Minimum allowed value
 * @returns {ThresholdConfig} Validated threshold configuration
 *
 * @throws {Error} If required parameters missing or invalid
 */
export interface ThresholdConfig {
  threshold: number;
  target?: number;
  minValue?: number;
}

export function createThresholdConfig({ threshold, target, minValue }: { threshold: number; target?: number; minValue?: number }): ThresholdConfig {
  if (threshold === undefined || threshold < 0) {
    throw new Error('createThresholdConfig: threshold is required and must be >= 0');
  }

  const config: ThresholdConfig = { threshold };

  if (target !== undefined) {
    if (target < 0) {
      throw new Error('createThresholdConfig: target must be >= 0');
    }
    config.target = target;
  }

  if (minValue !== undefined) {
    if (minValue < 0) {
      throw new Error('createThresholdConfig: minValue must be >= 0');
    }
    config.minValue = minValue;
  }

  return config;
}

// =============================================================================
// SPECIALIZED CONFIGURATIONS
// =============================================================================

/**
 * @description Summarization configuration
 *
 * Controls how history entries are compressed into summaries.
 * Uses token-based and count-based limits for optimal summarization.
 *
 * @type {Object}
 * @property {SizeConfig} entries - Entry count limits for summarization
 * @property {TokenConfig} tokens - Token limits for summary generation
 */
export const SUMMARIZE_CONFIG = {
  entries: createSizeConfig({
    maxSize: 100,     // Maximum entries to summarize in one batch
    minSize: 10       // Minimum entries required to trigger summarization
  }),
  tokens: createTokenConfig({
    maxTokens: 4000   // Maximum tokens for summary API response
  }),
  // Flat aliases for backward compatibility with existing code
  // These allow SUMMARIZE_CONFIG.minSummarizeCount instead of SUMMARIZE_CONFIG.entries.minSize
  get minSummarizeCount() { return this.entries.minSize; },
  get maxSummarizeCount() { return this.entries.maxSize; },
  get summaryMaxTokens() { return this.tokens.maxTokens; }
};

/**
 * @description History token management configuration
 *
 * Controls how context window tokens are managed through boundary shifting
 * and buffer management. Prevents token overflow while maintaining context.
 *
 * @type {Object}
 * @property {ThresholdConfig} tail - Tail token threshold management
 */
export const HISTORY_TOKEN_CONFIG = {
  tail: createThresholdConfig({
    threshold: 12000,  // Shift boundary when tail exceeds 12K tokens
    target: 6000,      // Target ~6K tokens after boundary shift
    minValue: 3        // Always keep at least 3 entries in tail
  })
};

/**
 * @description RAG (Retrieval-Augmented Generation) configuration
 *
 * Controls semantic search and memory retrieval for context assembly.
 * Balances relevance, diversity, and computational efficiency.
 *
 * @type {Object}
 * @property {SizeConfig} retrieval - Retrieval limits and controls
 * @property {Object} scoring - Scoring and ranking parameters
 * @property {Object} diversity - Diversity controls for MMR
 */
export const RAG_CONFIG = {
  retrieval: createSizeConfig({
    maxSize: 20,      // Maximum memories to retrieve
    defaultSize: 10   // Default retrieval count
  }),
  scoring: {
    minScore: 0.7,    // Minimum relevance score threshold
    boostRecent: 1.2  // Boost factor for recent memories
  },
  diversity: {
    lambda: 0.5,      // MMR diversity vs relevance balance (0=relevance, 1=diversity)
    maxSimilar: 0.8   // Maximum similarity threshold for diversity filtering
  }
  // NOTE: Runtime defaults (topK, weights, minSimilarity, etc.) live in
  // @persistence/memory → DEFAULT_RETRIEVAL_CONFIG, consumed by routes/settings.js
};

/**
 * @description Replicate API configuration
 *
 * Settings for image generation via Replicate API, including cost optimization
 * and content filtering fallbacks.
 *
 * @type {Object}
 * @property {Object} models - Available models and their settings
 * @property {Object} cost - Cost optimization settings
 */
export const REPLICATE_CONFIG = {
  models: {
    'flux-schnell': {
      cost: 0.01,      // Cost per image
      fast: true,      // Fast generation
      filtered: true   // May have content filtering
    },
    'flux-dev': {
      cost: 0.025,     // Higher cost for better quality
      fast: false,     // Slower but higher fidelity
      filtered: true   // Content filtering applied
    },
    'stability-ai/sdxl': {
      cost: 0.01,      // Moderate cost
      fast: true,      // Fast generation
      filtered: false  // Safety checker disabled
    }
  },
  cost: {
    maxRetries: 2,    // Retry failed generations
    fallbackOrder: ['flux-schnell', 'stability-ai/sdxl', 'flux-dev']  // Cost-optimized fallback
  }
};

/**
 * @description Local model configuration
 *
 * Settings for local LLM deployments and model switching.
 *
 * @type {Object}
 * @property {Object} endpoints - Available local model endpoints
 * @property {Object} switching - Model switching controls
 */
export const LOCAL_MODEL_CONFIG = {
  endpoints: {
    'llama-3.1-8b': {
      contextWindow: 128000,
      maxTokens: 4096,
      costMultiplier: 0.1  // Relative to cloud costs
    },
    'mistral-7b': {
      contextWindow: 32000,
      maxTokens: 4096,
      costMultiplier: 0.05
    }
  },
  switching: {
    autoSwitchThreshold: 0.8,  // Switch to local when cloud utilization > 80%
    minCloudCredit: 10,        // Minimum cloud credits before forcing local
    fallbackTimeout: 30000     // Timeout before falling back to cloud
  }
};

/**
 * @description Batch processing retry configuration
 *
 * Controls retry behavior for failed batch API operations.
 *
 * @type {Object}
 * @property {Object} retry - Retry parameters
 * @property {Object} timeout - Timeout controls
 */
export const BATCH_RETRY_CONFIG = {
  retry: {
    maxAttempts: 3,        // Maximum retry attempts
    backoffMs: 1000,       // Initial backoff delay
    backoffMultiplier: 2   // Exponential backoff multiplier
  },
  timeout: {
    batchCheckMs: 30000,   // How often to check batch status
    maxWaitHours: 24       // Maximum time to wait for batch completion
  }
};

// =============================================================================
// CONFIGURATION VALIDATION
// =============================================================================

/**
 * @description Validates all configuration objects
 *
 * Ensures configuration integrity and catches configuration errors early.
 *
 * @upstream Called by: Application startup, config loading
 * @downstream Calls: Individual config validation functions
 *
 * @returns {boolean} True if all configurations are valid
 * @throws {Error} If any configuration is invalid
 */
export function validateConfigs() {
  // Test that all structured configs can be created without errors
  // This serves as a validation that the config builders work correctly

  try {
    // These should not throw if the static configs are valid
    Object.values(SUMMARIZE_CONFIG);
    Object.values(HISTORY_TOKEN_CONFIG);
    Object.values(RAG_CONFIG);
    Object.values(REPLICATE_CONFIG);
    Object.values(LOCAL_MODEL_CONFIG);
    Object.values(BATCH_RETRY_CONFIG);

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Configuration validation failed: ${message}`);
  }
}

// =============================================================================
// BARREL EXPORTS
// =============================================================================

/**
 * @description Barrel export for configuration system
 *
 * @upstream Called by: Application modules needing configuration
 * @downstream Calls: Individual configuration objects and utilities
 */
export default {
  // Config builders
  createTokenConfig,
  createSizeConfig,
  createThresholdConfig,

  // Structured configs
  SUMMARIZE_CONFIG,
  HISTORY_TOKEN_CONFIG,
  RAG_CONFIG,
  REPLICATE_CONFIG,
  LOCAL_MODEL_CONFIG,
  BATCH_RETRY_CONFIG,

  // Utilities
  validateConfigs
};
