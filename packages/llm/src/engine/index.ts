/**
 * LLM Engine Exports
 *
 * @module @persistence/llm/engine
 * @description Strongly-typed LLM request execution
 *
 * @example
 * import { RequestEngine } from '@persistence/llm/engine';
 * import { PROVIDERS } from '@persistence/core/providers';
 *
 * const engine = new RequestEngine(env);
 * const response = await engine.execute({
 *   provider: PROVIDERS.anthropic,
 *   model: PROVIDERS.anthropic.models.opus,
 *   system: 'You are helpful.',
 *   messages: [{ role: 'user', content: 'Hello' }],
 *   maxTokens: 1000,
 *   mode: 'sync',
 * });
 */

// Type exports
export type {
  LLMRequest,
  LLMResponse,
  EngineEnvironment,
  // Batch types
  BatchJob,
  BatchStatus,
  BatchResult,
} from '../types';

// Class and config exports
export { RequestEngine } from './engine';
export type { BatchPollingConfig, BatchRetryConfig } from './engine';
