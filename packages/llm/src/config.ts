/**
 * LLM Configuration Management
 *
 * @module @persistence/llm/config
 * @description Model configuration storage and retrieval for task-based LLM routing.
 *
 * Stores and retrieves user preferences for LLM provider/model per task type.
 * Uses the Cloudflare D1 state table (via Drizzle) for persistence.
 * All db parameters are typed as DrizzleD1 (the Drizzle-wrapped client from
 * @persistence/db/client), not as the raw Cloudflare D1Database binding.
 *
 * Migrated from platforms/cloudflare/src/services/llm.js (2026-01-30)
 *
 * @upstream Called by:
 *   - Telegram commands (/summodel, /metamodel)
 *   - API endpoints (/sum-model, /meta-model)
 *   - summarizeHistory(), metaSummarize()
 * @downstream Calls:
 *   - @persistence/db (getState, setState) — DrizzleD1-based state helpers
 *   - @persistence/core/providers (PROVIDERS, resolveProvider)
 */

import { getState, setState } from "@persistence/db";
import type { DrizzleD1 } from "@persistence/db";
import { PROVIDERS, resolveProvider } from "@persistence/core/providers";
import type { ModelDefinition } from "@persistence/core/providers";

// =============================================================================
// CONFIG TYPE DEFINITIONS
// =============================================================================

/**
 * @description State keys for different model configuration types
 *
 * Each type stores provider and model in separate state table entries.
 * Types with fallbackType will inherit from parent if not explicitly set.
 *
 * @upstream Called by: getModelConfig(), setModelConfig(), clearModelConfig()
 * @downstream Calls: None (configuration object)
 */
export const MODEL_CONFIG_TYPES = {
  summarize: {
    provider: "summarize_provider",
    model: "summarize_model",
    displayName: "Summarization",
  },
  metasummarize: {
    provider: "metasummarize_provider",
    model: "metasummarize_model",
    displayName: "Meta-Summarization",
    fallbackType: "summarize" as const, // Falls back to summarize settings if not set
  },
} as const;

export type ConfigType = keyof typeof MODEL_CONFIG_TYPES;

export interface ModelConfig {
  provider: string;
  model: string;
  availableModels: Record<string, Record<string, string>>;
  isInherited: boolean;
}

export interface SetModelConfigResult {
  success: boolean;
  provider?: string;
  model?: string;
  error?: string;
}

export interface ClearModelConfigResult {
  success: boolean;
  cleared?: boolean;
  error?: string;
}

// =============================================================================
// MODEL UTILITIES (Internal Helpers)
// =============================================================================

/**
 * @description Extract version/tier number from a model name for sorting
 *
 * Extracts the numeric version from model names like:
 * - 'gpt-5.2' -> 5.2
 * - 'gpt-4.1-mini' -> 4.1
 * - 'gpt-4o-mini' -> 4.05 (treat 'o' variant as slightly newer than 4.0)
 * - 'gpt-4-turbo' -> 4.0
 * - 'claude-opus-4-6' -> 4.63 (opus tier bonus)
 * - 'claude-sonnet-4-5' -> 4.52 (sonnet tier bonus)
 * - 'claude-haiku-4-5' -> 4.51 (haiku tier bonus)
 *
 * @param modelName - Full model name
 * @returns Version number for sorting (higher = newer/better)
 */
function extractModelVersion(modelName: string): number {
  // GPT-5.x: extract 5.x
  const gpt5Match = modelName.match(/gpt-?5\.?(\d)?/i);
  if (gpt5Match) {
    return 5 + (gpt5Match[1] ? parseFloat(`0.${gpt5Match[1]}`) : 0);
  }

  // GPT-4.1: extract 4.1
  const gpt41Match = modelName.match(/gpt-?4\.1/i);
  if (gpt41Match) return 4.1;

  // GPT-4o: treat as 4.05 (slightly newer than 4.0, older than 4.1)
  const gpt4oMatch = modelName.match(/gpt-?4o/i);
  if (gpt4oMatch) return 4.05;

  // GPT-4: base version
  const gpt4Match = modelName.match(/gpt-?4/i);
  if (gpt4Match) return 4.0;

  // Claude: extract version + tier bonus for sorting (opus > sonnet > haiku)
  const claudeMatch = modelName.match(
    /claude-?(opus|sonnet|haiku)?.*?(\d+)[-.]?(\d)?/i,
  );
  if (claudeMatch) {
    const tier = claudeMatch[1]?.toLowerCase();
    const tierBonus = tier === "opus" ? 0.03 : tier === "sonnet" ? 0.02 : 0.01;
    const version = parseFloat(
      claudeMatch[2] + (claudeMatch[3] ? `.${claudeMatch[3]}` : ".0"),
    );
    return version + tierBonus;
  }

  // Unknown - return 0 to sort last
  return 0;
}

/**
 * @description Get the PROVIDERS-compatible model map for a provider
 *
 * Returns an alias-to-modelId map from the provider definition.
 * This maintains backward compatibility with the old PROVIDERS config structure.
 *
 * @param providerName - Provider name ('openai' | 'anthropic')
 * @returns Model alias map or empty object if provider not found
 */
function getProviderModels(providerName: string): Record<string, string> {
  const provider = resolveProvider(providerName);
  if (!provider) return {};

  // Build alias -> modelId map from provider models
  const result: Record<string, string> = {};
  const models = provider.models as Record<string, ModelDefinition>;
  for (const [_key, model] of Object.entries(models)) {
    // Use model.id as both key and value for full model name access
    result[model.id] = model.id;

    // Add common aliases based on display name patterns
    const displayLower = model.displayName.toLowerCase();
    if (displayLower.includes("opus")) result["opus"] = model.id;
    if (displayLower.includes("sonnet")) result["sonnet"] = model.id;
    if (displayLower.includes("haiku")) result["haiku"] = model.id;
    if (displayLower.includes("mini")) {
      if (model.id.includes("4.1")) result["4.1mini"] = model.id;
      else if (model.id.includes("4o")) result["4omini"] = model.id;
    }
    if (model.id.includes("gpt-5")) result["gpt5.2"] = model.id;
    if (model.id === "gpt-4o") result["4o"] = model.id;
  }

  return result;
}

/**
 * @description Get the default model for a provider
 *
 * @param providerName - Provider name
 * @returns Default model ID or empty string
 */
function getDefaultModel(providerName: string): string {
  const provider = resolveProvider(providerName);
  if (!provider) return "";

  // Find the model marked as default or use the first one
  const models = provider.models as Record<string, ModelDefinition>;
  for (const model of Object.values(models)) {
    // Return first model as default (providers list default first)
    return model.id;
  }
  return "";
}

// =============================================================================
// DEFAULT PROVIDER ROUTING
// =============================================================================

/**
 * @description Get the configured provider for a specific task type
 *
 * Allows per-task provider configuration via state table.
 * Falls back to defaults if not configured.
 *
 * @upstream Called by: summarizeHistory(), metaSummarize()
 * @downstream Calls: getState()
 *
 * @param db - Database instance
 * @param taskType - Task type ('summarize' | 'metasummarize' | 'thinking')
 * @returns Provider and model to use
 *
 * @example
 * const { provider, model } = await getDefaultProvider(db, 'summarize');
 * // Returns: { provider: 'openai', model: 'gpt-4o-mini' } if configured
 * // Or: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' } as fallback
 */
export async function getDefaultProvider(
  db: DrizzleD1,
  taskType: string,
): Promise<{ provider: string; model: string }> {
  const providerKey = `${taskType}_provider`;
  const modelKey = `${taskType}_model`;

  const configuredProvider = await getState(db, providerKey);
  const configuredModel = await getState(db, modelKey);

  if (configuredProvider && resolveProvider(configuredProvider)) {
    return {
      provider: configuredProvider,
      model: configuredModel || getDefaultModel(configuredProvider),
    };
  }

  // Defaults per task type
  const defaults: Record<string, { provider: string; model: string }> = {
    summarize: { provider: "openai", model: "gpt-4.1-mini" },
    metasummarize: { provider: "openai", model: "gpt-4.1-mini" },
    thinking: { provider: "anthropic", model: "claude-opus-4-6" },
  };

  return (
    defaults[taskType] || {
      provider: "anthropic",
      model: getDefaultModel("anthropic"),
    }
  );
}

// =============================================================================
// CONFIG CRUD
// =============================================================================

/**
 * @description Get model configuration for a specific type
 *
 * Retrieves provider and model from state, with fallback chain:
 * 1. Type-specific state keys (e.g., metasummarize_provider)
 * 2. Fallback type's state keys (e.g., summarize_provider)
 * 3. Provider defaults (e.g., openai -> gpt-4.1-mini)
 *
 * @upstream Called by: /meta-model endpoint, handleMetaModel(), metaSummarize()
 * @downstream Calls: getState(), getAvailableModels()
 *
 * @param db - Database instance
 * @param type - Config type ('summarize' | 'metasummarize')
 * @returns Model configuration with available models
 *
 * @example
 * await getModelConfig(db, 'metasummarize')
 * // Returns: { provider: 'anthropic', model: 'claude-sonnet-4-20250514', availableModels: {...}, isInherited: false }
 * // Or if not set: { provider: 'openai', model: 'gpt-4.1-mini', availableModels: {...}, isInherited: true }
 */
export async function getModelConfig(
  db: DrizzleD1,
  type: ConfigType = "summarize",
): Promise<ModelConfig> {
  const config = MODEL_CONFIG_TYPES[type];
  if (!config) throw new Error(`Unknown model config type: ${type}`);

  let provider = await getState(db, config.provider);
  let model = await getState(db, config.model);
  const hasExplicitConfig = !!provider;

  // Fallback to parent type if not set
  if (!provider && "fallbackType" in config && config.fallbackType) {
    const fallback = MODEL_CONFIG_TYPES[config.fallbackType];
    provider = await getState(db, fallback.provider);
    model = await getState(db, fallback.model);
  }

  // Final defaults
  provider = provider || "openai";
  model = model || getDefaultModel(provider) || "gpt-4.1-mini";

  return {
    provider,
    model,
    availableModels: Object.fromEntries(
      Object.keys(PROVIDERS).map((providerName) => [
        providerName,
        getAvailableModels(providerName),
      ]),
    ),
    isInherited:
      !hasExplicitConfig && "fallbackType" in config && !!config.fallbackType,
  };
}

/**
 * @description Set model configuration for a specific type
 *
 * Validates provider/model and persists to state table.
 * Single source of truth for model toggle logic.
 *
 * @upstream Called by: /meta-model POST endpoint, handleMetaModel()
 * @downstream Calls: setState(), resolveModelAlias()
 *
 * @param db - Database instance
 * @param type - Config type ('summarize' | 'metasummarize')
 * @param provider - Provider name ('openai' | 'anthropic')
 * @param modelAlias - Model alias or full name (defaults to provider default)
 * @returns Result with success status and resolved model
 *
 * @example
 * await setModelConfig(db, 'metasummarize', 'anthropic', 'sonnet')
 * // Returns: { success: true, provider: 'anthropic', model: 'claude-sonnet-4-20250514' }
 */
export async function setModelConfig(
  db: DrizzleD1,
  type: ConfigType,
  provider: string,
  modelAlias?: string,
): Promise<SetModelConfigResult> {
  const config = MODEL_CONFIG_TYPES[type];
  if (!config) return { success: false, error: `Unknown config type: ${type}` };

  const normalizedProvider =
    typeof provider === "string" ? provider.trim().toLowerCase() : provider;
  const providerDef = normalizedProvider
    ? resolveProvider(normalizedProvider)
    : null;

  // Validate provider
  if (!providerDef) {
    const validProviders = Object.keys(PROVIDERS).join(", ");
    return {
      success: false,
      error: `Unknown provider: ${provider}. Valid: ${validProviders}`,
    };
  }

  let resolvedModel: string | null = null;
  if (modelAlias) {
    const normalizedAlias =
      typeof modelAlias === "string"
        ? modelAlias.trim().toLowerCase()
        : modelAlias;
    resolvedModel = resolveModelAlias(normalizedProvider, normalizedAlias);
    if (!resolvedModel) {
      const validAliases = Object.keys(
        getProviderModels(normalizedProvider),
      ).join(", ");
      return {
        success: false,
        error: `Unknown model: ${modelAlias}. Valid for ${normalizedProvider}: ${validAliases}. Omit the model to use default.`,
      };
    }
  } else {
    resolvedModel = getDefaultModel(normalizedProvider);
  }

  // Persist to state
  await setState(db, config.provider, normalizedProvider);
  await setState(db, config.model, resolvedModel);

  return { success: true, provider: normalizedProvider, model: resolvedModel };
}

/**
 * @description Clear model config to use inherited/default values
 *
 * Sets the provider and model state keys to null, causing the type
 * to fall back to its fallbackType (if defined) or provider defaults.
 *
 * @upstream Called by: /meta-model POST endpoint (provider='inherit'), handleMetaModel()
 * @downstream Calls: setState()
 *
 * @param db - Database instance
 * @param type - Config type ('summarize' | 'metasummarize')
 * @returns Result with success status
 *
 * @example
 * await clearModelConfig(db, 'metasummarize')
 * // Returns: { success: true, cleared: true }
 */
export async function clearModelConfig(
  db: DrizzleD1,
  type: ConfigType,
): Promise<ClearModelConfigResult> {
  const config = MODEL_CONFIG_TYPES[type];
  if (!config) return { success: false, error: `Unknown config type: ${type}` };

  await setState(db, config.provider, null);
  await setState(db, config.model, null);

  return { success: true, cleared: true };
}

// =============================================================================
// MODEL UTILITIES (Public)
// =============================================================================

/**
 * @description Get available model aliases for a provider, sorted by version (newest first)
 *
 * Returns models sorted so newest versions appear first in dropdowns:
 * - gpt-5.2 before gpt-4.1 before gpt-4o before gpt-4
 * - opus before sonnet before haiku (for Anthropic)
 *
 * @upstream Called by: /sum-model endpoint, handleSumModel(), getSummarizationModel()
 * @downstream Calls: extractModelVersion()
 *
 * @param provider - Provider name ('openai' | 'anthropic')
 * @returns Model aliases and their full names, sorted by version descending
 *
 * @example
 * getAvailableModels('openai')
 * // Returns: { 'gpt5.2': 'gpt-5.2', '4.1mini': 'gpt-4.1-mini', ... } (sorted)
 */
export function getAvailableModels(provider: string): Record<string, string> {
  const models = getProviderModels(provider);

  // Sort by extracting version from full model name (descending - newest first)
  const sortedEntries = Object.entries(models).sort(([, a], [, b]) => {
    return extractModelVersion(b) - extractModelVersion(a);
  });

  // Rebuild object with sorted order
  return Object.fromEntries(sortedEntries);
}

/**
 * @description Resolve a model alias to full model name
 *
 * @upstream Called by: setSummarizationModel(), /sum-model endpoint
 * @downstream Calls: None (reads PROVIDERS config)
 *
 * @param provider - Provider name
 * @param alias - Model alias (e.g., '4.1mini') or full name
 * @returns Full model name, or null if not found
 *
 * @example
 * resolveModelAlias('openai', '4.1mini')  // Returns: 'gpt-4.1-mini'
 * resolveModelAlias('openai', 'gpt-4.1-mini')  // Returns: 'gpt-4.1-mini' (passthrough)
 * resolveModelAlias('openai', 'invalid')  // Returns: null
 */
export function resolveModelAlias(
  provider: string,
  alias: string,
): string | null {
  const models = getProviderModels(provider);
  if (!models) return null;

  // Check if alias exists
  if (models[alias]) return models[alias];

  // Check if it's already a full model name
  if (Object.values(models).includes(alias)) return alias;

  return null;
}

// =============================================================================
// CONVENIENCE WRAPPERS (backwards compatibility)
// =============================================================================

/**
 * @description Set the summarization provider and model
 *
 * Convenience wrapper around setModelConfig for 'summarize' type.
 *
 * @upstream Called by: /sum-model POST endpoint, handleSumModel()
 * @downstream Calls: setModelConfig()
 *
 * @param db - Database instance
 * @param provider - Provider name ('openai' | 'anthropic')
 * @param modelAlias - Model alias or full name (defaults to provider default)
 * @returns Result with success status and resolved model
 *
 * @example
 * await setSummarizationModel(db, 'openai', '4.1mini')
 * // Returns: { success: true, provider: 'openai', model: 'gpt-4.1-mini' }
 */
export async function setSummarizationModel(
  db: DrizzleD1,
  provider: string,
  modelAlias?: string,
): Promise<SetModelConfigResult> {
  return setModelConfig(db, "summarize", provider, modelAlias);
}

/**
 * @description Get current summarization provider and model config
 *
 * Convenience wrapper around getModelConfig for 'summarize' type.
 *
 * @upstream Called by: /sum-model GET endpoint, handleSumModel()
 * @downstream Calls: getModelConfig()
 *
 * @param db - Database instance
 * @returns Current summarization configuration
 *
 * @example
 * await getSummarizationModel(db)
 * // Returns: { provider: 'openai', model: 'gpt-4.1-mini', availableModels: {...} }
 */
export async function getSummarizationModel(db: DrizzleD1): Promise<{
  provider: string;
  model: string;
  availableModels: Record<string, Record<string, string>>;
}> {
  const config = await getModelConfig(db, "summarize");
  return {
    provider: config.provider,
    model: config.model,
    availableModels: config.availableModels,
  };
}
