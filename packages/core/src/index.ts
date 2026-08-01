/**
 * @persistence/core - Shared constants, types, and provider definitions
 *
 * @module @persistence/core
 * @description Platform-agnostic foundation used by all other packages.
 *
 * ## Exports
 *
 * **Constants:** ACTION_TYPES, HISTORY_TYPES, CACHE_TTL, API limits
 * **Types:** Persona, Tool, Action interfaces
 * **Config:** Configuration builders (createTokenConfig, etc.)
 * **Providers:** anthropic, openai, PROVIDERS registry, resolveProviderModel()
 * **Secrets:** SecretsProvider interface and implementations
 *
 * @example
 * import { ACTION_TYPES, anthropic, resolveProviderModel } from '@persistence/core';
 *
 * const { provider, model } = resolveProviderModel('anthropic/sonnet');
 * const cost = anthropic.models.sonnet.pricing.input;
 */

// Re-export all constants
export * from './constants';

// Re-export all types
export * from './types';

// Re-export runtime environment contract
export * from './runtime-env';

// Re-export configuration system
export * from './config';

// Re-export provider system
export * from './providers';

// Re-export secrets provider
export * from './secrets';

// Re-export utilities
export * from './utils';
