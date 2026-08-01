/**
 * Provider Resolution
 *
 * @module @persistence/core/providers/resolve
 * @description Convert string references to typed objects at system boundaries
 *
 * This is where "stringly-typed" DB values become strongly-typed objects.
 * Call these functions ONCE when loading config, then pass typed objects everywhere.
 */

import { anthropic } from './anthropic';
import { deepseek } from './deepseek';
import { kimi } from './kimi';
import { openai } from './openai';
import type { ProviderDefinition, ModelDefinition } from './types';

/**
 * Local PROVIDERS constant — avoids circular dependency with ./index.ts
 * which re-exports from this module. Must stay in sync with the canonical
 * PROVIDERS export in ./index.ts.
 *
 * @antipattern Do NOT import from './index' here — it creates a cycle.
 */
const PROVIDERS = { anthropic, openai, deepseek, kimi } as const;

/**
 * Resolve provider name to ProviderDefinition
 *
 * @param name - Provider name (e.g., 'anthropic', 'openai')
 * @returns The provider definition object
 * @throws Error if provider not found
 *
 * @example
 * const provider = resolveProvider('anthropic');
 * // provider is ProviderDefinition, not string
 */
export function resolveProvider(name: string): ProviderDefinition {
  const provider = PROVIDERS[name as keyof typeof PROVIDERS];
  if (!provider) {
    const valid = Object.keys(PROVIDERS).join(', ');
    throw new Error(`Unknown provider: '${name}'. Valid providers: ${valid}`);
  }
  return provider;
}

/**
 * Resolve model name to ModelDefinition for a given provider
 *
 * @param provider - The provider definition (already resolved)
 * @param name - Model name (e.g., 'opus', 'gpt-4o-mini')
 * @returns The model definition object
 * @throws Error if model not found
 *
 * @example
 * const provider = resolveProvider('anthropic');
 * const model = resolveModel(provider, 'opus');
 * // model is ModelDefinition, not string
 */
export function resolveModel(provider: ProviderDefinition, name: string): ModelDefinition {
  const model = provider.models[name];
  if (!model) {
    const valid = Object.keys(provider.models).join(', ');
    throw new Error(
      `Unknown model: '${name}' for provider '${provider.name}'. Valid models: ${valid}`
    );
  }
  return model;
}

/**
 * Resolve a "provider/model" reference string to typed objects
 *
 * @param ref - Reference string (e.g., 'anthropic/opus', 'openai/gpt-4o-mini')
 * @returns Object with provider and model definitions
 * @throws Error if format invalid or provider/model not found
 *
 * @example
 * const { provider, model } = resolveProviderModel('anthropic/opus');
 * // Both are typed objects, ready to use
 */
export function resolveProviderModel(ref: string): {
  provider: ProviderDefinition;
  model: ModelDefinition;
} {
  const parts = ref.split('/');
  if (parts.length !== 2) {
    throw new Error(
      `Invalid provider/model reference: '${ref}'. Expected format: 'provider/model'`
    );
  }

  const [providerName, modelName] = parts;
  const provider = resolveProvider(providerName);
  const model = resolveModel(provider, modelName);

  return { provider, model };
}

/**
 * Resolve model by its full ID string (e.g., 'claude-sonnet-4-20250514')
 *
 * Unlike resolveModel which uses short keys, this finds models by their API ID.
 * Useful when the ID comes from config/state storage.
 *
 * @param provider - The provider definition (already resolved)
 * @param modelId - Full model ID (e.g., 'claude-sonnet-4-20250514', 'gpt-4.1-mini')
 * @returns The model definition object, or undefined if not found
 *
 * @example
 * const provider = resolveProvider('anthropic');
 * const model = resolveModelById(provider, 'claude-sonnet-4-20250514');
 * // Returns the sonnet ModelDefinition
 */
export function resolveModelById(
  provider: ProviderDefinition,
  modelId: string
): ModelDefinition | undefined {
  for (const model of Object.values(provider.models)) {
    if (model.id === modelId) {
      return model;
    }
  }
  return undefined;
}

/**
 * Check if a provider/model reference is valid without throwing
 *
 * @param ref - Reference string to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * if (isValidProviderModel('anthropic/opus')) {
 *   // Safe to resolve
 * }
 */
export function isValidProviderModel(ref: string): boolean {
  try {
    resolveProviderModel(ref);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all available provider/model combinations
 *
 * @returns Array of "provider/model" strings
 *
 * @example
 * const all = getAllProviderModels();
 * // ['anthropic/haiku', 'anthropic/sonnet', 'anthropic/opus', 'openai/gpt-4o', ...]
 */
export function getAllProviderModels(): string[] {
  const result: string[] = [];
  for (const [providerName, provider] of Object.entries(PROVIDERS)) {
    for (const modelName of Object.keys(provider.models)) {
      result.push(`${providerName}/${modelName}`);
    }
  }
  return result;
}
