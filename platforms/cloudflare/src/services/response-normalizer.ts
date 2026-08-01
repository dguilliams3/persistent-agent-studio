/**
 * Response Normalization System
 *
 * @module services/response-normalizer
 * @description Comprehensive normalization for responses from different AI models and providers.
 *
 * This system provides DRY, scalable normalization of:
 * - API response structures (JSON, content extraction)
 * - Action formatting and validation
 * - Error messages and codes
 * - Usage metadata (tokens, costs, etc.)
 * - Model-specific quirks and edge cases
 *
 * Architecture:
 * 1. Provider configs define normalization rules
 * 2. Pipeline applies transformations in configurable order
 * 3. Fallback strategies handle failures gracefully
 * 4. Integration points with existing services
 *
 * @upstream Called by:
 *   - response-normalizer-integration.js (LLM response normalization)
 *   - services/response-parser.js (action parsing)
 *   - services/images.js (image generation)
 *   - Any service dealing with external API responses
 *
 * @downstream Calls:
 *   - utils/normalize.js (parameter normalization)
 *   - services/feedback.js (action normalization)
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface ApiResponse {
  content?: Array<{ text?: string }>;
  completion?: string;
  choices?: Array<{ message?: { content?: string }; text?: string; finish_reason?: string }>;
  model?: string;
  usage?: Record<string, number>;
  done?: boolean;
  response?: string;
  text?: string;
  stop_reason?: string;
  status?: number;
  endpoint?: string;
  total_duration?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
  [key: string]: unknown;
}

interface ApiRequest {
  model?: string;
  [key: string]: unknown;
}

interface ApiError {
  type?: string;
  code?: string;
  message?: string;
  [key: string]: unknown;
}

export interface NormalizedError {
  code: string;
  message: string;
  provider: string;
  retryable: boolean;
  details: Record<string, unknown>;
  step?: string;
}

interface NormalizationCtx {
  provider: string;
  model?: string;
  request: ApiRequest;
  response: ApiResponse;
  parsed?: unknown;
  metadata?: Record<string, unknown>;
  warnings: string[];
  actions?: Array<Record<string, unknown>>;
  parseMetadata?: Record<string, unknown>;
}

interface NormalizationResult {
  success: boolean;
  content?: unknown;
  metadata?: Record<string, unknown>;
  error?: NormalizedError;
  warnings?: string[];
  raw?: unknown;
  actions?: Array<Record<string, unknown>>;
  parseMetadata?: Record<string, unknown>;
}

interface ProviderConfig {
  name: string;
  extractContent: (response: ApiResponse) => string | null;
  normalizeMetadata: (response: ApiResponse, request: ApiRequest) => Record<string, unknown>;
  normalizeError: (error: ApiError, response: ApiResponse | null) => NormalizedError;
  quirks: Record<string, (...args: unknown[]) => unknown>;
}

// =============================================================================
// PROVIDER CONFIGURATION SYSTEM
// =============================================================================
// Each provider defines how to normalize its responses
// =============================================================================

/**
 * @typedef {Object} ProviderConfig
 * @property {string} name - Provider identifier ('anthropic', 'openai', etc.)
 * @property {Function} extractContent - Extract text content from API response
 * @property {Function} normalizeMetadata - Normalize usage stats, tokens, etc.
 * @property {Function} normalizeError - Convert provider errors to standard format
 * @property {Object} quirks - Model-specific behavior quirks and fixes
 * @property {Function[]} [preProcessors] - Optional preprocessing steps
 * @property {Function[]} [postProcessors] - Optional postprocessing steps
 */

/**
 * Provider normalization configurations
 * @type {Object.<string, ProviderConfig>}
 */
export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  anthropic: {
    name: 'anthropic',
    extractContent: (response: ApiResponse) => {
      // Handle both streaming and non-streaming responses
      if (response.content?.[0]?.text) {
        return response.content[0].text;
      }
      if (response.completion) {
        return response.completion;
      }
      return null;
    },

    normalizeMetadata: (response: ApiResponse, request: ApiRequest) => ({
      provider: 'anthropic',
      model: response.model || request.model,
      tokens: {
        input: response.usage?.input_tokens || 0,
        output: response.usage?.output_tokens || 0,
        total: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      },
      cost: calculateAnthropicCost(response.usage, response.model),
      finishReason: response.stop_reason
    }),

    normalizeError: (error: ApiError, response: ApiResponse | null) => ({
      code: error.type || 'anthropic_error',
      message: error.message || 'Anthropic API error',
      provider: 'anthropic',
      retryable: isRetryableAnthropicError(error),
      details: {
        raw: error,
        statusCode: response?.status,
        model: response?.model
      }
    }),

    quirks: {
      // Claude sometimes includes thinking tokens that aren't billed
      thinkingTokens: (response: unknown) => {
        const r = response as ApiResponse;
        const thinking = r.usage?.thinking_tokens || 0;
        return thinking > 0 ? { thinkingTokens: thinking } : {};
      },

      // Claude Opus may format actions differently than Sonnet
      actionFormatting: (content: unknown, model: unknown) => {
        const c = String(content);
        const m = String(model);
        if (m.includes('opus') && c.includes('```json')) {
          // Opus tends to wrap actions in code blocks
          return c.replace(/```\w*\n?/g, '').trim();
        }
        return c;
      }
    }
  },

  openai: {
    name: 'openai',
    extractContent: (response: ApiResponse) => {
      // Handle both chat completions and legacy completions
      if (response.choices?.[0]?.message?.content) {
        return response.choices[0].message.content;
      }
      if (response.choices?.[0]?.text) {
        return response.choices[0].text;
      }
      return null;
    },

    normalizeMetadata: (response: ApiResponse, request: ApiRequest) => ({
      provider: 'openai',
      model: response.model || request.model,
      tokens: {
        input: response.usage?.prompt_tokens || 0,
        output: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0
      },
      cost: calculateOpenAICost(response.usage, response.model),
      finishReason: response.choices?.[0]?.finish_reason
    }),

    normalizeError: (error: ApiError, response: ApiResponse | null) => ({
      code: error.type || error.code || 'openai_error',
      message: error.message || 'OpenAI API error',
      provider: 'openai',
      retryable: isRetryableOpenAIError(error),
      details: {
        raw: error,
        statusCode: response?.status,
        model: response?.model
      }
    }),

    quirks: {
      // GPT-4o sometimes adds extra whitespace around JSON
      jsonCleanup: (content: unknown) => {
        return String(content).replace(/\n\s*\n/g, '\n').trim();
      },

      // Reasoning models (o1, o3) don't return usage in same format
      reasoningTokens: (response: unknown, model: unknown) => {
        const m = String(model);
        const r = response as ApiResponse;
        if (m.startsWith('o')) {
          return {
            reasoningTokens: r.usage?.completion_tokens || 0,
            note: 'Reasoning models include thinking time in completion tokens'
          };
        }
        return {};
      }
    }
  },

  local: {
    name: 'local',
    extractContent: (response: ApiResponse) => {
      // Ollama vs LM Studio format differences
      return (response.content as unknown as string) || response.response || response.text || null;
    },

    normalizeMetadata: (response: ApiResponse, request: ApiRequest) => ({
      provider: 'local',
      model: response.model || request.model,
      tokens: {
        input: 0, // Local models don't provide token counts
        output: 0,
        total: 0
      },
      cost: 0, // Local models are free
      finishReason: response.done ? 'stop' : 'unknown'
    }),

    normalizeError: (error: ApiError, response: ApiResponse | null) => ({
      code: 'local_model_error',
      message: error.message || 'Local model error',
      provider: 'local',
      retryable: true, // Local errors are often transient
      details: {
        raw: error,
        endpoint: response?.endpoint
      }
    }),

    quirks: {
      // Ollama sometimes includes timing metadata
      timingInfo: (response: unknown) => {
        const r = response as ApiResponse;
        if (r.total_duration) {
          return {
            timing: {
              totalMs: Number(r.total_duration) / 1000000, // Convert from nanoseconds
              promptMs: Number(r.prompt_eval_duration) / 1000000,
              evalMs: Number(r.eval_duration) / 1000000
            }
          };
        }
        return {};
      }
    }
  }
};

// =============================================================================
// NORMALIZATION PIPELINE SYSTEM
// =============================================================================
// Chainable transformations that can be applied in sequence
// =============================================================================

/**
 * @typedef {Object} NormalizationResult
 * @property {boolean} success - Whether normalization succeeded
 * @property {*} content - The normalized content
 * @property {Object} metadata - Normalized metadata
 * @property {Object} error - Normalized error (if any)
 * @property {string[]} warnings - Non-fatal issues encountered
 * @property {Object} raw - Original response for debugging
 */

/**
 * @typedef {Object} NormalizationContext
 * @property {string} provider - Provider name
 * @property {string} model - Model name
 * @property {Object} request - Original request parameters
 * @property {Object} response - Raw API response
 * @property {*} parsed - Partially normalized content
 */

/**
 * Normalization pipeline step interface
 * @typedef {Function} NormalizationStep
 * @param {NormalizationContext} context - Current normalization state
 * @returns {NormalizationContext} Updated context
 */

/**
 * Apply a series of normalization steps in sequence
 * @param {NormalizationContext} initialContext - Starting context
 * @param {NormalizationStep[]} steps - Steps to apply
 * @returns {Promise<NormalizationResult>} Final normalized result
 */
export async function applyNormalizationPipeline(initialContext: NormalizationCtx, steps: Array<(ctx: NormalizationCtx) => NormalizationCtx | Promise<NormalizationCtx>>) {
  let context = { ...initialContext };

  for (const step of steps) {
    try {
      context = await step(context);
    } catch (error: unknown) {
      return {
        success: false,
        error: {
          code: 'normalization_pipeline_error',
          message: `Pipeline step failed: ${error instanceof Error ? error.message : String(error)}`,
          provider: context.provider,
          retryable: false,
          step: step.name,
          details: { raw: error }
        },
        raw: initialContext.response
      };
    }
  }

  return {
    success: true,
    content: context.parsed,
    metadata: context.metadata,
    warnings: context.warnings || [],
    raw: initialContext.response,
    // Include additional context properties if they exist
    ...(context.actions && { actions: context.actions }),
    ...(context.parseMetadata && { parseMetadata: context.parseMetadata })
  };
}

// =============================================================================
// CORE NORMALIZATION FUNCTIONS
// =============================================================================
// Main entry points for different types of normalization
// =============================================================================

/**
 * Normalize a complete LLM API response
 * @param {Object} response - Raw API response
 * @param {string} provider - Provider name
 * @param {Object} request - Original request parameters
 * @returns {Promise<NormalizationResult>}
 */
export async function normalizeLLMResponse(response: ApiResponse, provider: string, request: ApiRequest) {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) {
    return {
      success: false,
      error: {
        code: 'unknown_provider',
        message: `Unknown provider: ${provider}`,
        provider
      },
      raw: response
    };
  }

  const context = {
    provider,
    model: request.model,
    request,
    response,
    warnings: []
  };

  // Pipeline: extract content -> normalize metadata -> apply quirks -> validate
  const steps = [
    extractContentStep,
    normalizeMetadataStep,
    applyQuirksStep,
    validateContentStep
  ];

  return applyNormalizationPipeline(context, steps);
}

/**
 * Normalize action parsing results from different models
 * @param {string} rawContent - Raw text content from model
 * @param {string} provider - Provider name
 * @param {string} model - Model name
 * @returns {NormalizationResult}
 */
export async function normalizeActionContent(rawContent: string, provider: string, model: string) {
  const config = PROVIDER_CONFIGS[provider];

  const context: NormalizationCtx = {
    provider,
    model,
    request: {},
    response: { content: rawContent } as unknown as ApiResponse,
    parsed: rawContent,
    warnings: []
  };

  // Pipeline: apply content quirks -> parse actions -> validate actions
  const steps = [
    applyContentQuirksStep,
    parseActionsStep,
    validateActionsStep
  ];

  return applyNormalizationPipeline(context, steps);
}

/**
 * Normalize error responses from different providers
 * @param {Error|Object} error - Raw error
 * @param {Object} response - Raw response (if available)
 * @param {string} provider - Provider name
 * @returns {Object} Normalized error
 */
export function normalizeError(error: ApiError | Error | unknown, response: ApiResponse | null, provider: string) {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) {
    return {
      code: 'unknown_provider',
      message: `Unknown provider for error: ${provider}`,
      provider,
      retryable: false,
      details: { raw: error, response }
    };
  }

  const apiError: ApiError = error instanceof Error
    ? { message: error.message, type: error.name }
    : (typeof error === 'object' && error !== null ? error as ApiError : { message: String(error) });
  return config.normalizeError(apiError, response);
}

// =============================================================================
// PIPELINE STEP IMPLEMENTATIONS
// =============================================================================
// Individual transformation steps used in pipelines
// =============================================================================

/**
 * Extract content from API response
 */
function extractContentStep(context: NormalizationCtx) {
  const config = PROVIDER_CONFIGS[context.provider];
  const content = config.extractContent(context.response);

  if (content === null) {
    throw new Error(`Failed to extract content from ${context.provider} response`);
  }

  return {
    ...context,
    parsed: content
  };
}

/**
 * Normalize metadata (tokens, costs, etc.)
 */
function normalizeMetadataStep(context: NormalizationCtx) {
  const config = PROVIDER_CONFIGS[context.provider];
  const metadata = config.normalizeMetadata(context.response, context.request);

  return {
    ...context,
    metadata
  };
}

/**
 * Apply provider-specific quirks and fixes
 */
function applyQuirksStep(context: NormalizationCtx) {
  const config = PROVIDER_CONFIGS[context.provider];
  let content = context.parsed;

  // Apply each quirk transformation
  for (const [quirkName, quirkFn] of Object.entries(config.quirks)) {
    try {
      const result = quirkFn(content, context.model, context.response);
      if (typeof result === 'string') {
        content = result;
      } else if (result && typeof result === 'object') {
        // Quirks can add metadata
        context.metadata = { ...context.metadata, ...result };
      }
    } catch (error: unknown) {
      context.warnings.push(`Quirk '${quirkName}' failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    ...context,
    parsed: content
  };
}

/**
 * Apply content-specific quirks before action parsing
 */
function applyContentQuirksStep(context: NormalizationCtx) {
  const config = PROVIDER_CONFIGS[context.provider];
  let content = context.parsed;

  // Apply content formatting quirks
  if (config.quirks.actionFormatting) {
    content = config.quirks.actionFormatting(content, context.model);
  }
  if (config.quirks.jsonCleanup) {
    content = config.quirks.jsonCleanup(content);
  }

  return {
    ...context,
    parsed: content
  };
}

/**
 * Parse actions from content using existing response parser
 */
async function parseActionsStep(context: NormalizationCtx) {
  // Import the existing response parser
  const { parseClaudeResponse } = await import('@persistence/llm');

  const parseResult = parseClaudeResponse(String(context.parsed));

  return {
    ...context,
    actions: parseResult.actions,
    parseMetadata: {
      success: parseResult.success,
      fullyParsed: parseResult.fullyParsed,
      malformed: parseResult.malformed,
      error: parseResult.error
    }
  };
}

/**
 * Validate content and actions
 */
function validateContentStep(context: NormalizationCtx) {
  if (!context.parsed || typeof context.parsed !== 'string') {
    throw new Error('Content must be a non-empty string');
  }

  if (context.parsed.trim().length === 0) {
    context.warnings.push('Content is empty or whitespace-only');
  }

  return context;
}

/**
 * Validate parsed actions
 */
function validateActionsStep(context: NormalizationCtx) {
  if (!context.actions) {
    throw new Error('No actions found in content');
  }

  if (!Array.isArray(context.actions)) {
    throw new Error('Actions must be an array');
  }

  // Validate each action has required fields
  for (const action of context.actions) {
    if (!action.action || typeof action.action !== 'string') {
      throw new Error('Each action must have a valid "action" field');
    }
  }

  return context;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================
// Helper functions for cost calculation, error classification, etc.
// =============================================================================

/**
 * Calculate cost for Anthropic API usage
 */
function calculateAnthropicCost(usage: Record<string, number> | undefined, model: string | undefined) {
  if (!usage) return 0;

  const rates = {
    'claude-opus-4-6': { input: 5, output: 25 },
    'claude-opus-4-5-20251101': { input: 5, output: 25 },
    'claude-opus-4-20250514': { input: 15, output: 75 },
    'claude-sonnet-4-6-20250514': { input: 3, output: 15 },
    'claude-sonnet-4-20250514': { input: 3, output: 15 },
    'claude-haiku-4-20250514': { input: 0.25, output: 1.25 }
  };

  const ratesMap: Record<string, { input: number; output: number }> = rates;
  const modelRates = (model ? ratesMap[model] : null) || rates['claude-sonnet-4-6-20250514'];
  const inputCost = ((usage.input_tokens || 0) / 1000000) * modelRates.input;
  const outputCost = ((usage.output_tokens || 0) / 1000000) * modelRates.output;

  return inputCost + outputCost;
}

/**
 * Calculate cost for OpenAI API usage
 */
function calculateOpenAICost(usage: Record<string, number> | undefined, model: string | undefined) {
  if (!usage) return 0;

  // Simplified rates - only for models we actually use
  const rates: Record<string, { input: number; output: number }> = {
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4.1-mini': { input: 0.40, output: 1.6 },
    'gpt-5.2': { input: 2.5, output: 10 },
  };

  const modelRates = (model ? rates[model] : null) || rates['gpt-4o-mini'];
  const inputCost = ((usage.prompt_tokens || 0) / 1000000) * modelRates.input;
  const outputCost = ((usage.completion_tokens || 0) / 1000000) * modelRates.output;

  return inputCost + outputCost;
}

/**
 * Check if an Anthropic error is retryable
 */
function isRetryableAnthropicError(error: ApiError) {
  const retryableCodes = ['overloaded_error', 'rate_limit_error', 'internal_server_error'];
  return retryableCodes.includes(error.type ?? '');
}

/**
 * Check if an OpenAI error is retryable
 */
function isRetryableOpenAIError(error: ApiError) {
  const retryableCodes = ['rate_limit_exceeded', 'internal_error', 'service_unavailable'];
  return retryableCodes.includes(error.type ?? '') || retryableCodes.includes(error.code ?? '');
}
