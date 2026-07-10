/**
 * Secrets Provider Types
 *
 * @module @persistence/core/secrets/types
 * @description Interface for portable credential access.
 *
 * Allows services to request credentials without knowing where they come from
 * (environment variables, Cloudflare Workers secrets, vault systems, etc.).
 * This abstraction enables services to run on any platform with proper DI.
 *
 * @upstream Called by: Service providers (ElevenLabs, Telegram, Replicate, etc.)
 * @downstream Calls: Platform-specific implementations
 */

/**
 * @description Error thrown when a required secret is not found.
 *
 * Use this when a secret is mandatory for operation and its absence
 * should halt execution rather than silently failing.
 *
 * @example
 * throw new SecretNotFoundError('ELEVENLABS_API_KEY');
 * // Error: Secret not found: ELEVENLABS_API_KEY
 */
export class SecretNotFoundError extends Error {
  constructor(key: string) {
    super(`Secret not found: ${key}`);
    this.name = 'SecretNotFoundError';
  }
}

/**
 * @description Abstraction for accessing secrets/credentials.
 *
 * Allows services to request credentials without knowing where they come from
 * (env vars, vault, Cloudflare secrets, etc.). Implementations handle the
 * platform-specific retrieval logic.
 *
 * @upstream Called by: Service initialization (tts, messaging, image generation)
 * @downstream Calls: Platform-specific secret stores
 *
 * @example
 * // Service initialization
 * const secrets = new CloudflareSecretsProvider(env);
 * const apiKey = await secrets.require('ELEVENLABS_API_KEY');
 * const optional = await secrets.get('OPTIONAL_KEY');
 */
export interface SecretsProvider {
  /**
   * Get a secret value. Returns undefined if not found.
   *
   * Use this for optional secrets where the service can function
   * without them or has a fallback mechanism.
   *
   * @param key - The secret key (e.g., 'ELEVENLABS_API_KEY')
   * @returns The secret value or undefined
   *
   * @example
   * const token = await secrets.get('OPTIONAL_TOKEN');
   * if (token) {
   *   // Use enhanced features
   * }
   */
  get(key: string): Promise<string | undefined>;

  /**
   * Get a secret value, throwing if not found.
   *
   * Use this for mandatory secrets where the service cannot function
   * without them. Throws SecretNotFoundError if the key doesn't exist.
   *
   * @param key - The secret key
   * @throws SecretNotFoundError if the key doesn't exist
   * @returns The secret value
   *
   * @example
   * const apiKey = await secrets.require('ELEVENLABS_API_KEY');
   * // Throws if ELEVENLABS_API_KEY is not set
   */
  require(key: string): Promise<string>;

  /**
   * Check if a secret exists.
   *
   * Use this to conditionally enable features based on secret availability
   * without retrieving the actual value.
   *
   * @param key - The secret key
   * @returns True if the secret exists
   *
   * @example
   * if (await secrets.has('REPLICATE_API_TOKEN')) {
   *   // Enable Replicate image generation
   * }
   */
  has(key: string): Promise<boolean>;
}
