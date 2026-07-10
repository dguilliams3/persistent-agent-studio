/**
 * @persistence/core - Configuration builders and utilities
 *
 * @description
 * Unified configuration system with validation and type safety.
 * Provides builders for token, size, and threshold configurations
 * used across summarization, RAG, and other subsystems.
 *
 * @upstream Called by: All modules needing configuration
 */

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/**
 * Base interface for configurations with token limits
 */
export interface TokenConfig {
  maxTokens: number;
  defaultTokens?: number;
  minTokens?: number;
}

/**
 * Base interface for configurations with size/count limits
 */
export interface SizeConfig {
  maxSize: number;
  defaultSize?: number;
  minSize?: number;
}

/**
 * Base interface for configurations with thresholds
 */
export interface ThresholdConfig {
  threshold: number;
  target?: number;
  minValue?: number;
}

// =============================================================================
// CONFIGURATION BUILDERS
// =============================================================================

/**
 * Creates a validated token configuration
 *
 * @param params - Token configuration parameters
 * @returns Validated token configuration
 * @throws If required parameters missing or invalid
 */
export function createTokenConfig(params: {
  maxTokens: number;
  defaultTokens?: number;
  minTokens?: number;
}): TokenConfig {
  const { maxTokens, defaultTokens, minTokens } = params;

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
 * Creates a validated size configuration
 *
 * @param params - Size configuration parameters
 * @returns Validated size configuration
 * @throws If required parameters missing or invalid
 */
export function createSizeConfig(params: {
  maxSize: number;
  defaultSize?: number;
  minSize?: number;
}): SizeConfig {
  const { maxSize, defaultSize, minSize } = params;

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
 * Creates a validated threshold configuration
 *
 * @param params - Threshold configuration parameters
 * @returns Validated threshold configuration
 * @throws If required parameters missing or invalid
 */
export function createThresholdConfig(params: {
  threshold: number;
  target?: number;
  minValue?: number;
}): ThresholdConfig {
  const { threshold, target, minValue } = params;

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
 * Summarization configuration
 * Controls how history entries are compressed into summaries
 */
export const SUMMARIZE_CONFIG = {
  entries: createSizeConfig({
    maxSize: 100,     // Maximum entries to summarize in one batch
    minSize: 10,      // Minimum entries required to trigger summarization
  }),
  tokens: createTokenConfig({
    maxTokens: 4000,  // Maximum tokens for summary API response
  }),
};

/**
 * Batch summarization configuration
 * Advanced summarization for larger datasets
 */
export const BATCH_SUMMARIZE_CONFIG = {
  batch: createSizeConfig({
    defaultSize: 50,  // Default entries to analyze
    maxSize: 60,      // Maximum entries (timeout protection)
    minSize: 15,      // Minimum entries required
  }),
  summaries: createSizeConfig({
    maxSize: 2,       // Maximum summaries per batch
    minSize: 8,       // Minimum entries per summary
  }),
  tokens: createTokenConfig({
    maxTokens: 8000,  // Higher token limit for multiple summaries
  }),
  quality: {
    minSummaryLength: 500,  // Minimum chars per summary
  },
};

/**
 * History token management configuration
 * Controls context window token management
 */
export const HISTORY_TOKEN_CONFIG = {
  tail: createThresholdConfig({
    threshold: 12000,  // Shift boundary when tail exceeds 12K tokens
    target: 6000,      // Target ~6K tokens after boundary shift
    minValue: 3,       // Always keep at least 3 entries in tail
  }),
};

/**
 * RAG configuration
 * Controls semantic search and memory retrieval
 */
export const RAG_CONFIG = {
  retrieval: createSizeConfig({
    maxSize: 20,      // Maximum memories to retrieve
    defaultSize: 10,  // Default retrieval count
  }),
  scoring: {
    minScore: 0.7,    // Minimum relevance score threshold
    boostRecent: 1.2, // Boost factor for recent memories
  },
  diversity: {
    lambda: 0.5,      // MMR diversity vs relevance balance
    maxSimilar: 0.8,  // Maximum similarity threshold
  },
};

/**
 * Summary tier system configuration
 * Implements three-tier summary system (cached/tail/archived)
 */
export const SUMMARY_BUFFER_CONFIG = {
  contextSize: 10,              // Summaries in direct prompt
  bufferSize: 15,               // Buffer before meta-summarize
  tailTokenThreshold: 8000,     // Roll when tail exceeds this
  tailTokenTarget: 4000,        // Target after roll
  minTailSummaries: 1,          // Always keep at least one
};

/**
 * Quick follow-up configuration
 * Controls quick follow-up cycles after search, art, and digest events.
 * NOTE: Summarize follow-ups removed — at 54-min intervals, next regular cycle suffices.
 */
export const QUICK_FOLLOWUP_CONFIG = {
  delayAfterSearchMs: 30000,      // 30s after search/art/digest
  batchAvgThresholdSeconds: 180,  // 3 minutes
  batchAvgLookbackHours: 1,       // Look at last 1 hour
  enableAfterSearch: true,
};

/**
 * Batch retry configuration
 * Controls retry behavior for failed batch operations
 */
export const BATCH_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
};

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validates all configuration objects
 * @returns True if all configurations are valid
 * @throws If any configuration is invalid
 */
export function validateConfigs(): boolean {
  try {
    Object.values(SUMMARIZE_CONFIG);
    Object.values(BATCH_SUMMARIZE_CONFIG);
    Object.values(HISTORY_TOKEN_CONFIG);
    Object.values(RAG_CONFIG);
    Object.values(SUMMARY_BUFFER_CONFIG);
    Object.values(QUICK_FOLLOWUP_CONFIG);
    Object.values(BATCH_RETRY_CONFIG);
    return true;
  } catch (error) {
    throw new Error(`Configuration validation failed: ${(error as Error).message}`);
  }
}
