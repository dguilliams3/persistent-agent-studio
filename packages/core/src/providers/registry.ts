/**
 * LLM Provider Registry
 *
 * @module @persistence/core/providers/registry
 * @description Public registry functions for listing and querying available models
 *
 * This module provides data-driven access to model information for UI/command handlers
 * that need to list available models or display model metadata.
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/telegram/commands/config.js - /model command
 *   - UI components that need model listings
 * @downstream Calls:
 *   - ./index.ts - PROVIDERS registry
 */

import { anthropic } from './anthropic';
import { deepseek } from './deepseek';
import { kimi } from './kimi';
import { openai } from './openai';
import type { ModelDefinition } from './types';

/**
 * Local PROVIDERS constant — avoids circular dependency with ./index.ts
 * which re-exports from this module. Must stay in sync with the canonical
 * PROVIDERS export in ./index.ts.
 *
 * @antipattern Do NOT import from './index' here — it creates a cycle.
 */
const PROVIDERS = { anthropic, openai, deepseek, kimi } as const;

type StrictProviderName = keyof typeof PROVIDERS;

/**
 * Model information for display/selection
 *
 * Contains everything needed to show a model in a list or command output.
 */
export interface ModelInfo {
  /** Short alias for user input (e.g., 'opus', 'haiku', 'gpt4o') */
  alias: string;
  /** Full API model ID (e.g., 'claude-opus-4-6') */
  id: string;
  /** Provider name ('anthropic' | 'openai') */
  provider: string;
  /** Human-readable display name (e.g., 'Claude 4.5 Opus') */
  displayName: string;
  /** Pricing information ($/MTok) */
  pricing?: {
    input: number;
    output: number;
    cacheRead?: number;
    cacheWrite?: number;
  };
  /** Model capabilities */
  capabilities?: {
    vision: boolean;
    reasoning: boolean;
    streaming: boolean;
  };
}

/**
 * @description Get all available models across all providers
 *
 * Returns models in a flat list with aliases as the unique identifier.
 * Aliases are short names that users can type (e.g., 'opus', 'gpt4o').
 *
 * @upstream Called by: handleModel() to list available models
 * @downstream Calls: PROVIDERS registry
 *
 * @returns {ModelInfo[]} Array of model information objects
 *
 * @example
 * const models = getAvailableModels();
 * // [{ alias: 'haiku', id: 'claude-haiku-4-5-...', provider: 'anthropic', ... }, ...]
 */
export function getAvailableModels(): ModelInfo[] {
  const models: ModelInfo[] = [];

  for (const [providerName, provider] of Object.entries(PROVIDERS)) {
    for (const [modelAlias, modelDef] of Object.entries(provider.models)) {
      models.push({
        alias: modelAlias,
        id: modelDef.id,
        provider: providerName,
        displayName: modelDef.displayName,
        pricing: modelDef.pricing,
        capabilities: modelDef.capabilities,
      });
    }
  }

  return models;
}

/**
 * @description Get model info by alias
 *
 * Looks up a model by its short alias (e.g., 'opus', 'gpt4o').
 * Returns undefined if the alias is not found.
 *
 * @upstream Called by: handleModel() to validate user input
 * @downstream Calls: PROVIDERS registry
 *
 * @param {string} alias - Model alias (e.g., 'opus', 'haiku', 'gpt4o')
 * @returns {ModelInfo | undefined} Model info or undefined if not found
 *
 * @example
 * const model = getModelByAlias('opus');
 * // { alias: 'opus', id: 'claude-opus-4-6', provider: 'anthropic', ... }
 */
export function getModelByAlias(alias: string): ModelInfo | undefined {
  for (const [providerName, provider] of Object.entries(PROVIDERS)) {
    const modelDef = provider.models[alias];
    if (modelDef) {
      return {
        alias,
        id: modelDef.id,
        provider: providerName,
        displayName: modelDef.displayName,
        pricing: modelDef.pricing,
        capabilities: modelDef.capabilities,
      };
    }
  }
  return undefined;
}

/**
 * @description Check if a model alias is valid
 *
 * Quick validation without retrieving full model info.
 *
 * @upstream Called by: handleModel() for input validation
 * @downstream Calls: getModelByAlias()
 *
 * @param {string} alias - Model alias to validate
 * @returns {boolean} True if alias is valid
 *
 * @example
 * if (validateModelAlias('opus')) {
 *   // Safe to use
 * }
 */
export function validateModelAlias(alias: string): boolean {
  return getModelByAlias(alias) !== undefined;
}

/**
 * @description Get all models for a specific provider
 *
 * Returns only models from the specified provider (e.g., 'anthropic', 'openai').
 *
 * @upstream Called by: UI components filtering by provider
 * @downstream Calls: PROVIDERS registry
 *
 * @param {ProviderName} provider - Provider name ('anthropic' | 'openai')
 * @returns {ModelInfo[]} Array of models for that provider
 *
 * @example
 * const claudeModels = getProviderModels('anthropic');
 * // [{ alias: 'haiku', ... }, { alias: 'sonnet', ... }, { alias: 'opus', ... }]
 */
export function getProviderModels(provider: StrictProviderName): ModelInfo[] {
  const providerDef = PROVIDERS[provider];
  if (!providerDef) return [];

  return Object.entries(providerDef.models).map(([alias, modelDef]) => ({
    alias,
    id: (modelDef as ModelDefinition).id,
    provider,
    displayName: (modelDef as ModelDefinition).displayName,
    pricing: (modelDef as ModelDefinition).pricing,
    capabilities: (modelDef as ModelDefinition).capabilities,
  }));
}

/**
 * @description Get the ModelDefinition for an alias
 *
 * Returns the full typed ModelDefinition object, not just display info.
 * Use this when you need the complete definition for API calls.
 *
 * @upstream Called by: LLM service when resolving model strings
 * @downstream Calls: PROVIDERS registry
 *
 * @param {string} alias - Model alias
 * @returns {ModelDefinition | undefined} Full model definition or undefined
 *
 * @example
 * const modelDef = getModelDefinition('opus');
 * // Full ModelDefinition with id, pricing, capabilities, quirks, etc.
 */
export function getModelDefinition(alias: string): ModelDefinition | undefined {
  for (const provider of Object.values(PROVIDERS)) {
    const modelDef = provider.models[alias];
    if (modelDef) return modelDef;
  }
  return undefined;
}
