/**
 * Provider Registry
 *
 * @module @persistence/core/providers
 * @description Strongly-typed LLM provider definitions
 *
 * @example
 * import { PROVIDERS, resolveProviderModel } from '@persistence/core/providers';
 *
 * // Direct access (compile-time checked)
 * const opus = PROVIDERS.anthropic.models.opus;
 *
 * // Runtime resolution (from DB strings)
 * const { provider, model } = resolveProviderModel('anthropic/opus');
 */

// Type definitions
export type {
  ModelDefinition,
  ModelPricing,
  ModelCapabilities,
  ProviderDefinition,
  Message,
  ContentBlock,
  SystemBlock,
  ReasoningEffort,
  FormatRequestOptions,
  ParsedResponse,
  ProviderError,
  TokenCount,
} from './types';

// Provider implementations - exported directly for convenience
export { anthropic } from './anthropic';
export { deepseek } from './deepseek';
export { kimi } from './kimi';
export { openai } from './openai';
export {
  getProviderAvailabilityMap,
  type ProviderAvailability,
} from './availability';

import { anthropic } from './anthropic';
import { deepseek } from './deepseek';
import { kimi } from './kimi';
import { openai } from './openai';

/**
 * PROVIDERS - The typed provider registry
 *
 * Usage:
 * - PROVIDERS.anthropic.models.opus (compile-time checked)
 * - PROVIDERS.openai.models['gpt-4o-mini'] (also valid)
 */
export const PROVIDERS = {
  anthropic,
  openai,
  deepseek,
  kimi,
} as const;

/** Union of provider names */
export type ProviderName = keyof typeof PROVIDERS;

/** Union of model names for a provider */
export type ModelName<P extends ProviderName> = keyof typeof PROVIDERS[P]['models'];

// Resolution functions (for DB strings -> typed objects)
export {
  resolveProvider,
  resolveModel,
  resolveModelById,
  resolveProviderModel,
  isValidProviderModel,
  getAllProviderModels,
} from './resolve';

// Registry functions (for listing/querying models)
export type { ModelInfo } from './registry';
export {
  getAvailableModels,
  getModelByAlias,
  validateModelAlias,
  getProviderModels,
  getModelDefinition,
} from './registry';
