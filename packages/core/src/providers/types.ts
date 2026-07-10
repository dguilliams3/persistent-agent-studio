/**
 * Provider Type System
 *
 * @module @persistence/core/providers/types
 * @description Strongly-typed definitions for LLM providers and models.
 */

// =============================================================================
// MODEL DEFINITION
// =============================================================================

/**
 * Pricing in USD per million tokens
 */
export interface ModelPricing {
  /** Input token cost ($/MTok) */
  readonly input: number;
  /** Output token cost ($/MTok) */
  readonly output: number;
  /** Prompt cache read cost - Anthropic only ($/MTok) */
  readonly cacheRead?: number;
  /** Prompt cache write cost - Anthropic only ($/MTok) */
  readonly cacheWrite?: number;
}

/**
 * Model capabilities
 */
export interface ModelCapabilities {
  /** Can process image inputs */
  readonly vision: boolean;
  /** Has reasoning mode (GPT-5.x, o-series) */
  readonly reasoning: boolean;
  /** Supports extended thinking (Anthropic Opus) */
  readonly thinking: boolean;
  /** Supports streaming responses */
  readonly streaming: boolean;
}

/**
 * Complete definition of an LLM model
 *
 * Contains everything needed to:
 * - Make API calls (id)
 * - Calculate costs (pricing)
 * - Handle quirks (quirks)
 * - Display to users (displayName)
 */
export interface ModelDefinition {
  /** Actual API model ID sent to the provider */
  readonly id: string;

  /** Human-readable display name */
  readonly displayName: string;

  /** Maximum context window in tokens */
  readonly contextWindow: number;

  /** Pricing in USD per million tokens */
  readonly pricing: Readonly<ModelPricing>;

  /** Model capabilities */
  readonly capabilities: Readonly<ModelCapabilities>;

  /** Model-specific quirks and workarounds */
  readonly quirks?: Readonly<{
    /**
     * GPT-5.x reasoning bug: Even with reasoning_effort='none',
     * the model consumes reasoning tokens. Add this many extra
     * tokens to max_completion_tokens to compensate.
     */
    reasoningOverhead?: number;

    /** Override max output if model has lower limit than context window */
    maxOutputTokens?: number;

    /** Model uses different token parameter name */
    tokenParamName?: 'max_tokens' | 'max_completion_tokens';
  }>;
}

// =============================================================================
// PROVIDER DEFINITION
// =============================================================================

/**
 * Message format for LLM calls
 */
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
}

/**
 * Content block for multimodal messages
 */
export interface ContentBlock {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

/**
 * System prompt block with optional cache control
 */
export interface SystemBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

/**
 * Reasoning effort levels for GPT-5.x and o-series
 */
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';

/**
 * Options passed to provider's formatRequest method
 */
export interface FormatRequestOptions {
  /** The model definition (not string!) */
  model: ModelDefinition;
  /** System prompt - string or cache-aware blocks */
  system: string | SystemBlock[];
  /** Conversation messages */
  messages: Message[];
  /** Maximum tokens to generate */
  maxTokens: number;
  /** Reasoning effort for capable models */
  reasoning?: ReasoningEffort;
}

/**
 * Normalized response from any provider
 */
export interface ParsedResponse {
  /** Generated text content */
  content: string;
  /** Token usage for cost calculation */
  usage: {
    input: number;
    output: number;
    cacheRead?: number;
    cacheWrite?: number;
    reasoning?: number;
  };
  /** Why generation stopped */
  finishReason?: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'length';
}

/**
 * Normalized provider error
 */
export interface ProviderError {
  code: string;
  message: string;
  retryable: boolean;
  statusCode?: number;
}

/**
 * Token count result
 *
 * Includes whether the count is precise (from API) or estimated.
 * Callers may want to add safety buffers for estimated counts.
 */
export interface TokenCount {
  /** Number of tokens */
  tokens: number;
  /** True if from provider API, false if character-based estimation */
  precise: boolean;
}

/**
 * Complete definition of an LLM provider
 *
 * Contains everything needed to:
 * - Make API calls (api, getHeaders, formatRequest)
 * - Parse responses (parseResponse)
 * - Handle errors (parseError)
 * - List available models (models)
 */
export interface ProviderDefinition {
  /** Provider display name */
  readonly name: string;

  /** API endpoint configuration */
  readonly api: Readonly<{
    /**
     * Optional base URL used when `url` is a relative path.
     *
     * OpenAI-compatible providers share the same request/response format but
     * differ by host. This lets the engine resolve `/chat/completions`
     * against a provider-specific host without cloning the whole provider
     * implementation per vendor.
     */
    baseUrl?: string;
    /** Request path or absolute URL for API calls */
    url: string;
    /** API version header value (Anthropic) */
    version?: string;
  }>;

  /** Environment variable name containing API key */
  readonly envKeyName: string;

  /** Available models keyed by short name */
  readonly models: Readonly<Record<string, ModelDefinition>>;

  /**
   * Generate HTTP headers for API request
   * @param apiKey - The API key from environment
   */
  getHeaders(apiKey: string): Record<string, string>;

  /**
   * Format request body for this provider's API
   * @param opts - Request options with typed model
   */
  formatRequest(opts: FormatRequestOptions): Record<string, unknown>;

  /**
   * Parse successful response from API
   * @param data - Raw JSON response
   */
  parseResponse(data: unknown): ParsedResponse;

  /**
   * Parse error response for better error messages
   * @param error - Raw error response or Error object
   */
  parseError?(error: unknown): ProviderError;

  /**
   * Count tokens for text using provider's tokenizer
   *
   * Anthropic has a free API endpoint (precise).
   * OpenAI requires tiktoken locally (falls back to estimation).
   *
   * @param text - Text to count tokens for
   * @param model - Model definition (different models may tokenize differently)
   * @param apiKey - API key for authenticated endpoints
   * @returns Token count with precision indicator
   */
  countTokens(
    text: string,
    model: ModelDefinition,
    apiKey: string
  ): Promise<TokenCount>;
}

// =============================================================================
// TYPE HELPERS
// =============================================================================

/**
 * Extract provider names as union type
 * Usage: ProviderName = 'anthropic' | 'openai'
 */
export type ProviderName = string;

/**
 * Extract model names for a specific provider
 * Usage: AnthropicModel = 'haiku' | 'sonnet' | 'opus'
 */
export type ModelName = string;
