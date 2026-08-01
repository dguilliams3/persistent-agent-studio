/**
 * Secrets Provider - Portable credential access
 *
 * @module @persistence/core/secrets
 * @description Re-exports all secrets provider types and implementations.
 *
 * Provides platform-agnostic credential access. Services request secrets
 * through the SecretsProvider interface without knowing where they come from
 * (Cloudflare Workers, Node.js env vars, vault systems, etc.).
 *
 * This enables services to run on any platform with proper dependency injection.
 *
 * @upstream Called by: Service initialization, platform bootstrap
 * @downstream Calls: Platform-specific implementations
 *
 * @example
 * // Cloudflare Workers
 * import { CloudflareSecretsProvider } from '@persistence/core/secrets';
 * const secrets = new CloudflareSecretsProvider(env);
 *
 * @example
 * // Node.js / Tests
 * import { NodeEnvSecretsProvider } from '@persistence/core/secrets';
 * const secrets = new NodeEnvSecretsProvider();
 *
 * @example
 * // Service initialization (platform-agnostic)
 * import type { SecretsProvider } from '@persistence/core/secrets';
 *
 * async function createTTSService(secrets: SecretsProvider) {
 *   const apiKey = await secrets.require('ELEVENLABS_API_KEY');
 *   return new ElevenLabsProvider(apiKey);
 * }
 */

export type { SecretsProvider } from './types.js';
export { SecretNotFoundError } from './types.js';
export { CloudflareSecretsProvider } from './cloudflare.js';
export { NodeEnvSecretsProvider } from './node-env.js';
