/**
 * Unified LLM Call Interface Types
 *
 * @module @persistence/llm/types
 * @description Type definitions for the unified LLM call interface.
 *
 * This module provides strongly-typed interfaces for making LLM calls across
 * providers (Anthropic, OpenAI) with compile-time safety for provider-specific
 * parameters like `thinking` (Anthropic) and `reasoning` (OpenAI).
 *
 * Layer hierarchy:
 * - @persistence/core/providers: Foundation types (ModelDefinition, ProviderDefinition)
 * - @persistence/llm/types: Call interfaces (this file)
 * - @persistence/llm/callable: Factory implementations (Step 2.1+)
 *
 * @upstream Called by:
 *   - @persistence/llm/callable.ts (factory implementations)
 *   - Platform layer (batch-processor.js, bootstrap.ts)
 * @downstream Calls:
 *   - @persistence/core/providers (type re-exports)
 *
 * @example
 * import type { LLM, AnthropicCallParams, OpenAICallParams } from '@persistence/llm';
 *
 * // Type-safe: thinking only on Anthropic
 * llm.anthropic.opus.sync({ thinking: { budgetTokens: 4096 }, ... });
 *
 * // Type-safe: reasoning only on OpenAI
 * llm.openai['gpt-5.2'].sync({ reasoning: 'high', ... });
 *
 * // Compile error: reasoning doesn't exist on Anthropic
 * llm.anthropic.opus.sync({ reasoning: 'high', ... }); // Error!
 */

import type {
  Message,
  SystemBlock,
  ReasoningEffort,
  ModelDefinition,
  ProviderDefinition,
  ParsedResponse,
} from '@persistence/core/providers';
import type { SecretsProvider } from '@persistence/core';

// =============================================================================
// CALL PARAMETERS
// =============================================================================

/**
 * Base parameters for all LLM calls
 *
 * @description Common fields shared by all providers. Extended by provider-specific
 * interfaces to add fields like `thinking` (Anthropic) or `reasoning` (OpenAI).
 */
export interface BaseCallParams {
  /** System prompt - string or cache-aware blocks */
  system: string | SystemBlock[];
  /** Conversation messages */
  messages: Message[];
  /** Maximum tokens to generate */
  maxTokens: number;
}

/**
 * Anthropic-specific call parameters
 *
 * @description Extends BaseCallParams with Anthropic-only features.
 * The `thinking` field enables extended thinking mode (Claude 3.5+).
 *
 * @example
 * const params: AnthropicCallParams = {
 *   system: 'You are Clio...',
 *   messages: [{ role: 'user', content: 'Think deeply' }],
 *   maxTokens: 8192,
 *   thinking: { budgetTokens: 4096 }  // Anthropic only
 * };
 */
export interface AnthropicCallParams extends BaseCallParams {
  /**
   * Extended thinking budget (Anthropic only)
   *
   * When provided, enables Claude's extended thinking mode where it can
   * "think out loud" before responding. The budgetTokens specifies how
   * many tokens Claude can use for internal reasoning.
   */
  thinking?: { budgetTokens: number };
}

/**
 * OpenAI-specific call parameters
 *
 * @description Extends BaseCallParams with OpenAI-only features.
 * The `reasoning` field controls reasoning effort for GPT-5.x and o-series.
 *
 * @example
 * const params: OpenAICallParams = {
 *   system: 'Summarize concisely',
 *   messages: [{ role: 'user', content: historyText }],
 *   maxTokens: 1500,
 *   reasoning: 'none'  // OpenAI only
 * };
 */
export interface OpenAICallParams extends BaseCallParams {
  /**
   * Reasoning effort level (OpenAI only)
   *
   * Controls how much reasoning GPT-5.x and o-series models perform.
   * 'none' = minimal reasoning, 'high' = extensive reasoning.
   * Models without reasoning capability ignore this field.
   */
  reasoning?: ReasoningEffort;
}

// =============================================================================
// CALL RESULTS
// =============================================================================

/**
 * Result from a synchronous LLM call
 *
 * @description Contains the generated content, token usage, cost, and model info.
 * Returned by CallableModel.sync() method.
 */
export interface CallResult {
  /** Generated text content */
  content: string;
  /** Token usage for cost calculation */
  usage: ParsedResponse['usage'];
  /** Cost in USD */
  cost: number;
  /** Model that generated this response */
  model: string;
}

/**
 * Handle returned from batch submission
 *
 * @description Reference to a submitted batch request. Use with provider's
 * checkBatch() and fetchResults() methods to retrieve results later.
 *
 * @example
 * const handle = await llm.anthropic.opus.batch({ customId: 'cycle-42', ... });
 * // Later...
 * const status = await llm.anthropic.checkBatch(handle.batchId);
 */
export interface BatchHandle {
  /** Batch ID from provider (for status checking) */
  batchId: string;
  /** Current processing status */
  status: 'pending' | 'processing';
}

/**
 * Result from batch cancellation
 *
 * @description Indicates whether cancellation was successful and the new status.
 */
export interface CancelBatchResult {
  /** Whether the cancellation request succeeded */
  success: boolean;
  /** New status after cancellation (usually 'canceling') */
  status?: string;
  /** When cancellation was initiated (ISO timestamp) */
  cancelInitiatedAt?: string;
  /** Error message if cancellation failed */
  error?: string;
}

// =============================================================================
// CALLABLE INTERFACES
// =============================================================================

/**
 * A model with callable sync and batch methods
 *
 * @description Represents a specific model (e.g., opus, sonnet) that can execute
 * LLM calls. Parameterized by TParams to enforce provider-specific params at
 * compile time.
 *
 * @typeParam TParams - Call parameters type (AnthropicCallParams or OpenAICallParams)
 *
 * @example
 * // llm.anthropic.opus is CallableModel<AnthropicCallParams>
 * const result = await llm.anthropic.opus.sync({
 *   system: 'You are Clio',
 *   messages: [...],
 *   maxTokens: 8192,
 *   thinking: { budgetTokens: 4096 }  // Only valid for Anthropic
 * });
 */
export interface CallableModel<TParams extends BaseCallParams> {
  /** Access model metadata (pricing, quirks, capabilities) */
  readonly definition: ModelDefinition;

  /**
   * Execute a synchronous LLM call
   *
   * @param params - Call parameters (provider-specific type enforced)
   * @returns Promise resolving to CallResult with content, usage, and cost
   */
  sync(params: TParams): Promise<CallResult>;

  /**
   * Submit a batch request (async - results come later)
   *
   * @param params - Call parameters plus customId for tracking
   * @returns Promise resolving to BatchHandle for status checking
   */
  batch(params: TParams & { customId: string }): Promise<BatchHandle>;
}

/**
 * A provider with batch utilities and model access
 *
 * @description Represents a provider (e.g., Anthropic, OpenAI) with methods for
 * batch management. Individual models are accessed as properties.
 *
 * @typeParam TParams - Call parameters type for this provider's models
 *
 * @example
 * // llm.anthropic is CallableProvider<AnthropicCallParams>
 * const status = await llm.anthropic.checkBatch('batch_abc123');
 * if (status.status === 'ended') {
 *   const results = await llm.anthropic.fetchResults(status.resultsUrl!);
 * }
 */
export interface CallableProvider<TParams extends BaseCallParams> {
  /** Access provider metadata (API config, available models) */
  readonly definition: ProviderDefinition;

  /**
   * Check status of a submitted batch
   *
   * @param batchId - Batch ID from BatchHandle
   * @returns Current batch status including resultsUrl when complete
   */
  checkBatch(batchId: string): Promise<BatchStatus>;

  /**
   * Fetch results from a completed batch
   *
   * @param resultsUrl - URL from BatchStatus (when status === 'ended')
   * @returns Array of results for each request in the batch
   */
  fetchResults(resultsUrl: string): Promise<BatchResult[]>;

  /**
   * Cancel a pending or in-progress batch
   *
   * @param batchId - Batch ID to cancel
   * @returns Result indicating success/failure
   */
  cancelBatch(batchId: string): Promise<CancelBatchResult>;
}

// =============================================================================
// TOP-LEVEL INTERFACE
// =============================================================================

/**
 * Anthropic provider with all available models
 *
 * @description Type for llm.anthropic combining CallableProvider methods
 * with access to individual models (opus, sonnet, haiku).
 */
export type AnthropicProvider = CallableProvider<AnthropicCallParams> & {
  opus: CallableModel<AnthropicCallParams>;
  sonnet: CallableModel<AnthropicCallParams>;
  haiku: CallableModel<AnthropicCallParams>;
};

/**
 * OpenAI provider with all available models
 *
 * @description Type for llm.openai combining CallableProvider methods
 * with access to individual models. Note: model keys use actual API names
 * with hyphens (gpt-4o, gpt-4o-mini, gpt-5.2).
 */
export type OpenAIProvider = CallableProvider<OpenAICallParams> & {
  'gpt-4o': CallableModel<OpenAICallParams>;
  'gpt-4o-mini': CallableModel<OpenAICallParams>;
  'gpt-5.2': CallableModel<OpenAICallParams>;
};

/**
 * Unified LLM interface
 *
 * @description Top-level interface for all LLM operations. Access providers
 * via llm.anthropic or llm.openai, then models via provider.modelName.
 *
 * Provider-specific parameters are enforced at compile time:
 * - llm.anthropic.*.sync() accepts `thinking`
 * - llm.openai.*.sync() accepts `reasoning`
 *
 * @example
 * const llm = createLLM(secrets);
 *
 * // Anthropic with thinking
 * const result = await llm.anthropic.opus.sync({
 *   system: 'You are Clio',
 *   messages: [{ role: 'user', content: 'Think' }],
 *   maxTokens: 8192,
 *   thinking: { budgetTokens: 4096 }
 * });
 *
 * // OpenAI with reasoning
 * const summary = await llm.openai['gpt-5.2'].sync({
 *   system: 'Summarize',
 *   messages: [{ role: 'user', content: text }],
 *   maxTokens: 1500,
 *   reasoning: 'none'
 * });
 *
 * // Batch operations
 * const handle = await llm.anthropic.opus.batch({ customId: 'cycle-42', ... });
 * const status = await llm.anthropic.checkBatch(handle.batchId);
 */
export interface LLM {
  /** Anthropic provider with Claude models */
  anthropic: AnthropicProvider;
  /** OpenAI provider with GPT models */
  openai: OpenAIProvider;
}

// =============================================================================
// FACTORY FUNCTION SIGNATURE
// =============================================================================

/**
 * Create unified LLM interface from secrets
 *
 * @description Factory function that creates a fully-typed LLM interface.
 * Implemented in callable.ts (Step 2.3).
 *
 * @param secrets - SecretsProvider with API keys
 * @returns Typed LLM interface
 *
 * @example
 * import { createLLM } from '@persistence/llm';
 *
 * const llm = createLLM(secrets);
 * const result = await llm.anthropic.sonnet.sync({ ... });
 */
export type CreateLLMFn = (secrets: SecretsProvider) => LLM;

// =============================================================================
// PARSER TYPES (collapsed from parser/types.ts)
// =============================================================================

export interface ParsedAction {
  action: string;
  [key: string]: unknown;
}

export interface MalformedAction {
  raw: string;
  error: string;
}

export interface ParseResult {
  success: boolean;
  fullyParsed: boolean;
  actions: ParsedAction[];
  meters?: Record<string, number>;
  note?: string;
  malformed?: MalformedAction[];
  repairApplied?: string[];
  error?: string;
  rawResponse?: string;
}

export interface RepairResult {
  repaired: string;
  fixes: string[];
}

export interface ParseResultGeneric<T> {
  success: boolean;
  data?: T;
  error?: string;
  rawResponse?: string;
}

// =============================================================================
// ENGINE TYPES (collapsed from engine/types.ts)
// =============================================================================

export interface LLMRequest {
  provider: ProviderDefinition;
  model: ModelDefinition;
  system: string | SystemBlock[];
  messages: Message[];
  maxTokens: number;
  mode: 'sync' | 'batch';
  thinking?: { budgetTokens: number };
  reasoning?: ReasoningEffort;
  timeout?: number;
}

export interface LLMResponse {
  content: string;
  usage: ParsedResponse['usage'];
  cost: number;
  metadata: {
    provider: string;
    model: string;
    latencyMs: number;
    finishReason?: string;
  };
}

export interface EngineEnvironment {
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  [key: string]: string | undefined;
}

export interface BatchJob {
  batchId: string;
  customId: string;
  status: 'validating' | 'in_progress' | 'ended' | 'canceling' | 'canceled' | 'expired';
  expiresAt?: string;
  provider: string;
  model: string;
}

export interface BatchStatus {
  status: BatchJob['status'];
  resultsUrl?: string;
  requestCounts?: {
    processing: number;
    succeeded: number;
    errored: number;
    canceled: number;
    expired: number;
  };
  endedAt?: string;
}

export interface BatchResult {
  customId: string;
  response?: LLMResponse;
  error?: string;
}
