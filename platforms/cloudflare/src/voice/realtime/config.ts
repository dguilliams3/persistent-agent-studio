/**
 * Realtime voice configuration and model registry
 *
 * @module voice/realtime/config
 * @description Canonical registry for realtime providers, models, and defaults.
 *
 * WHY THIS EXISTS:
 * - We need a single, predictable place to find provider IDs, model IDs,
 *   and their pricing metadata so routing logic stays provider-agnostic.
 * - LLM agents should not have to scan multiple files to understand
 *   which realtime models are supported or how to add a new one.
 *
 * HOW IT FITS THE LARGER VISION:
 * - Enables multi-provider realtime voice (OpenAI now, others later).
 * - Keeps routing logic stable even as provider APIs evolve.
 * - Lets the UI/Telegram commands present available realtime models
 *   without duplicating configuration.
 *
 * ANTIPATTERNS:
 * - Do NOT hardcode model names inside routes or Telegram commands.
 *   That couples UI to provider internals and makes future provider swaps painful.
 * - Do NOT compute costs by reading pricing constants from multiple sources;
 *   pricing should stay close to model definitions to keep estimates coherent.
 *
 * @upstream Called by:
 *   - voice/realtime/service.js - resolve provider + model info
 *   - voice/realtime/providers/openai.js - default model lookup
 * @downstream Calls:
 *   - None (pure configuration)
 *
 * @tests tests/voice/realtime-service.test.js
 */

export const REALTIME_PROVIDERS = {
  openai: {
    id: 'openai',
    displayName: 'OpenAI Realtime',
    apiKeyEnv: 'OPENAI_API_KEY',
    // Used by providers/openai.js to create realtime sessions.
    sessionEndpoint: 'https://api.openai.com/v1/realtime/sessions'
  }
};

export type RealtimeProviderId = keyof typeof REALTIME_PROVIDERS;

export const REALTIME_MODELS = {
  openai: {
    // Known realtime-capable models (Jan 2026). Allow overrides via request.
    'gpt-4o-realtime-preview': {
      id: 'gpt-4o-realtime-preview',
      displayName: 'GPT-4o Realtime Preview',
      modalities: ['audio', 'text'],
      // Pricing is best-effort and should be verified against current provider docs.
      pricing: {
        inputPerMTokUsd: 2.5,
        outputPerMTokUsd: 10.0,
        audioPerMinuteUsd: 0.0
      }
    },
    'gpt-4o-realtime': {
      id: 'gpt-4o-realtime',
      displayName: 'GPT-4o Realtime',
      modalities: ['audio', 'text'],
      pricing: {
        inputPerMTokUsd: 2.5,
        outputPerMTokUsd: 10.0,
        audioPerMinuteUsd: 0.0
      }
    }
  }
};

export type RealtimeModelId<TProvider extends RealtimeProviderId = RealtimeProviderId> = keyof (typeof REALTIME_MODELS)[TProvider];

type RealtimeProviderConfig = (typeof REALTIME_PROVIDERS)[RealtimeProviderId];
type RealtimeKnownModelConfig = (typeof REALTIME_MODELS)[RealtimeProviderId][keyof (typeof REALTIME_MODELS)[RealtimeProviderId]];
export type RealtimeModelConfig = RealtimeKnownModelConfig | {
  id: string;
  displayName: string;
  modalities: string[];
  pricing: null;
};

export const DEFAULT_REALTIME_PROVIDER = 'openai';
export const DEFAULT_REALTIME_MODEL = 'gpt-4o-realtime-preview';

/**
 * @description Resolve a realtime provider configuration by id
 *
 * WHY: We intentionally return null for unknown providers so callers can
 * fail fast with an explicit error instead of assuming "openai".
 *
 * @upstream Called by: voice/realtime/service.js
 * @downstream Calls: None
 *
 * @param {string} providerId - Provider identifier (e.g., "openai")
 * @returns {Object|null} Provider config or null if unknown
 */
export function resolveRealtimeProvider(providerId: string): RealtimeProviderConfig | null {
  if (!(providerId in REALTIME_PROVIDERS)) {
    return null;
  }
  return REALTIME_PROVIDERS[providerId as RealtimeProviderId] || null;
}

/**
 * @description Resolve a realtime model configuration
 *
 * Returns the model config if known; otherwise returns a synthetic config
 * with the provided model id so custom models can still be used.
 *
 * WHY: This enables experimentation without constantly updating the registry.
 * The config remains the canonical place for known models + pricing,
 * while unknown models get a safe, metadata-light placeholder.
 *
 * ANTIPATTERN: Throwing errors for unknown models will block bring-your-own
 * model experimentation and force frequent code changes.
 *
 * @upstream Called by: voice/realtime/service.js
 * @downstream Calls: None
 *
 * @param {string} providerId - Provider identifier
 * @param {string} modelId - Requested model alias or full id
 * @returns {Object} Model configuration
 */
export function resolveRealtimeModel(providerId: string, modelId: string): RealtimeModelConfig {
  if (!(providerId in REALTIME_MODELS)) {
    return {
      id: modelId,
      displayName: modelId,
      modalities: ['audio', 'text'],
      pricing: null
    };
  }

  const providerModels = REALTIME_MODELS[providerId as RealtimeProviderId];
  const modelConfig = providerModels[modelId as keyof typeof providerModels];

  if (modelConfig) {
    return modelConfig;
  }

  return {
    id: modelId,
    displayName: modelId,
    modalities: ['audio', 'text'],
    pricing: null
  };
}
