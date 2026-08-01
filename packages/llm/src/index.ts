/**
 * @persistence/llm - LLM provider adapters
 *
 * @description
 * Multi-provider LLM abstraction supporting Anthropic, OpenAI,
 * and local models with unified response handling.
 *
 * @upstream @persistence/runtime (agent loop)
 * @downstream External LLM APIs (api.anthropic.com, api.openai.com)
 *
 * @example
 * import { RequestEngine, PROVIDERS, anthropic } from '@persistence/llm';
 * import type { LLMRequest, LLMResponse } from '@persistence/llm';
 *
 * // Count tokens using provider method
 * const tokens = await anthropic.countTokens(text, anthropic.models['sonnet'], apiKey);
 */

// =============================================================================
// RE-EXPORTS FROM @persistence/core/providers
// =============================================================================
// These types are the source of truth in core - re-exported here for convenience.
// =============================================================================
export type {
  // Message types
  Message,
  SystemBlock,
  // Provider types
  ProviderDefinition,
  ModelDefinition,
  ModelCapabilities,
  ModelPricing,
  FormatRequestOptions,
  ParsedResponse,
  // Token counting
  TokenCount,
  // Reasoning
  ReasoningEffort,
  // Provider/Model name unions
  ProviderName,
  ModelName,
} from '@persistence/core/providers';

export {
  // Provider registry
  PROVIDERS,
  anthropic,
  openai,
  // Resolution functions (string → typed object)
  resolveProvider,
  resolveModel,
  resolveModelById,
  resolveProviderModel,
} from '@persistence/core/providers';

// =============================================================================
// UNIFIED LLM CALL INTERFACE (Type-Safe Provider Abstraction)
// =============================================================================
// The CallableModel/CallableProvider interfaces enforce provider-specific params
// at compile time. Use createLLM(secrets) to get a typed LLM instance.
//
// @example
// const llm = createLLM(secrets);
// await llm.anthropic.opus.sync({ thinking: { budgetTokens: 4096 }, ... });
// await llm.openai['gpt-5.2'].sync({ reasoning: 'high', ... });
// =============================================================================
export type {
  // Call parameters (provider-specific)
  BaseCallParams,
  AnthropicCallParams,
  OpenAICallParams,
  // Call results
  CallResult,
  BatchHandle,
  CancelBatchResult as UnifiedCancelBatchResult,  // Avoid conflict with batches.ts
  // Callable interfaces
  CallableModel,
  CallableProvider,
  // Provider types
  AnthropicProvider,
  OpenAIProvider,
  // Top-level interface
  LLM,
  // Factory signature
  CreateLLMFn,
} from './types';

// =============================================================================
// LLM ENGINE (Strongly-Typed Provider System)
// =============================================================================
// The RequestEngine uses typed provider/model objects instead of strings.
// All provider/model resolution happens at the boundary (config loading).
// =============================================================================
export type {
  LLMRequest,
  LLMResponse,
  EngineEnvironment,
  // Batch types
  BatchJob,
  BatchStatus,
  BatchResult,
  // Config types
  BatchPollingConfig,
  BatchRetryConfig,
} from './engine';

export { RequestEngine } from './engine';

// =============================================================================
// CALLABLE FACTORY FUNCTIONS
// =============================================================================
// Factory functions for creating strongly-typed LLM interfaces.
// createCallableModel() creates individual model instances.
// createCallableProvider() creates provider-level batch utilities.
// createLLM() creates the full unified interface.
// =============================================================================
export { createCallableModel, createCallableProvider, createLLM } from './callable';

// =============================================================================
// CONFIG MANAGEMENT (Migrated from platform 2026-01-30)
// =============================================================================
// Model configuration storage and retrieval for task-based LLM routing.
// Stores user preferences for provider/model per task type in D1 state table.
//
// @upstream: Telegram commands, API endpoints, summarization services
// @downstream: @persistence/db state functions
// =============================================================================
export {
  // Config type definitions
  MODEL_CONFIG_TYPES,
  type ConfigType,
  type ModelConfig,
  type SetModelConfigResult,
  type ClearModelConfigResult,
  // Default provider routing
  getDefaultProvider,
  // Config CRUD
  getModelConfig,
  setModelConfig,
  clearModelConfig,
  // Model utilities
  getAvailableModels,
  resolveModelAlias,
  // Convenience wrappers (backwards compatibility)
  getSummarizationModel,
  setSummarizationModel,
} from './config';

// =============================================================================
// LOCAL MODEL SUPPORT (Migrated from platform 2026-01-30)
// =============================================================================
// Local LLM integration via tunnel for self-hosted models (Ollama, LM Studio).
// Supports fallback orchestration: try local first, fall back to cloud.
//
// @upstream: Telegram /localmodel command, think cycle
// @downstream: fetch() to local endpoints, @persistence/db state
// =============================================================================
export {
  // Types
  type LocalModelConfig,
  type LocalCallOptions,
  type LocalCallResult,
  type CallWithFallbackOptions,
  type CallWithFallbackResult,
  type LLMCaller,
  // Local model call
  callLocalModel,
  // Config management
  getLocalModelConfig,
  setLocalModelConfig,
  // Fallback orchestration
  callWithLocalFallback,
} from './local';

// =============================================================================
// BATCH STATE MANAGEMENT (D1 Database Operations)
// =============================================================================
// Manages pending_batches table for tracking batch submissions and their status.
// Distinct from engine/ which handles the actual Anthropic API interaction.
//
// @upstream: Platform batch-processor.js, Telegram commands, API endpoints
// @downstream: @persistence/db state and persona functions
// =============================================================================
export {
  // Constants
  BATCH_WINDOW,
  BATCH_HARD_TIMEOUT_SECONDS,
  // Types
  type BatchApiStatus,
  type CancelledBy,
  type PendingBatch,
  type BatchOptions,
  type CancelBatchResult,
  // Timeout configuration
  getBatchTimeout,
  setBatchTimeout,
  getBatchHardTimeout,
  setBatchHardTimeout,
  // CRUD operations
  listPendingBatches,
  storePendingBatch,
  getPendingBatches,
  updatePendingBatch,
  // Timing checks
  isInBatchWindow,
  isUserRecentlyActive,
  // Cancellation
  cancelBatch,
} from './batches';

// =============================================================================
// RESPONSE PARSING (Migrated from platform 2026-01-30)
// =============================================================================
// Robust JSON parsing for Claude's action responses with multiple fallback
// strategies, JSON repair, and graceful degradation for malformed responses.
//
// @upstream: Platform sync mode (runThinkingCycle), batch mode (processPendingBatches)
// @downstream: None (pure parsing logic)
// =============================================================================
export type {
  ParsedAction,
  MalformedAction,
  ParseResult,
  RepairResult,
  ParseResultGeneric,
} from './parser';

export {
  parseClaudeResponse,
  repairCommonJsonErrors,
  extractBalancedBraces,
} from './parser';

// =============================================================================
// MIGRATION STATUS
// =============================================================================

export const LLM_MIGRATION_STATUS = {
  migrated: ['providers', 'engine', 'tokenizer', 'batch', 'batches-state', 'config', 'local', 'parser'],
  pending: [
    'normalizer',  // Response normalization pipeline
    'streaming',   // Streaming response handling
  ],
  // Batch API: submitBatch(), checkBatchStatus(), fetchBatchResults() - COMPLETE
  // Batch State: storePendingBatch, getPendingBatches, etc. - COMPLETE (2026-01-28)
  // Config: MODEL_CONFIG_TYPES, get/setModelConfig, etc. - COMPLETE (2026-01-30)
  // Local: callLocalModel, get/setLocalModelConfig, etc. - COMPLETE (2026-01-30)
  // Parser: parseClaudeResponse, repairCommonJsonErrors, etc. - COMPLETE (2026-01-30)
  // Platform still uses services/batch-processor.js - needs wiring
} as const;
