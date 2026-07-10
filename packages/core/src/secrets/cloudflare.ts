/**
 * Cloudflare Workers Secrets Provider
 *
 * @module @persistence/core/secrets/cloudflare
 * @description Reads secrets from Cloudflare Workers env object.
 *
 * In Cloudflare Workers, secrets are set via wrangler CLI and appear
 * as properties on the env object passed to the fetch handler.
 * Secrets are injected at deployment time and are not visible in code.
 *
 * Setting secrets: `npx wrangler secret put SECRET_NAME`
 *
 * @upstream Called by: Platform bootstrap (platforms/cloudflare/src/bootstrap.ts)
 * @downstream Calls: None (reads from env object)
 *
 * @example
 * // In worker fetch handler
 * export default {
 *   async fetch(request, env, ctx) {
 *     const secrets = new CloudflareSecretsProvider(env);
 *     const apiKey = await secrets.require('ELEVENLABS_API_KEY');
 *     // ...
 *   }
 * }
 */

import { SecretsProvider, SecretNotFoundError } from './types.js';

/**
 * @description SecretsProvider implementation for Cloudflare Workers.
 *
 * Reads secrets from the Cloudflare Workers env object. Secrets must be
 * set via wrangler CLI before deployment: `npx wrangler secret put KEY_NAME`
 *
 * @upstream Called by: Cloudflare platform bootstrap
 * @downstream Calls: None (direct property access on env object)
 *
 * @example
 * const secrets = new CloudflareSecretsProvider(env);
 * const apiKey = await secrets.require('ELEVENLABS_API_KEY');
 * const optional = await secrets.get('OPTIONAL_KEY');
 *
 * @note The env object is provided by Cloudflare Workers runtime and contains
 * both secrets and bindings (D1, R2, KV, etc.). This provider only handles
 * secrets (string values).
 */
export class CloudflareSecretsProvider implements SecretsProvider {
  private readonly env: Record<string, unknown>;

  /**
   * @param env - The Cloudflare Workers env object
   */
  constructor(env: Record<string, unknown>) {
    this.env = env;
  }

  async get(key: string): Promise<string | undefined> {
    const value = this.env[key];
    if (typeof value === 'string') {
      return value;
    }
    return undefined;
  }

  async require(key: string): Promise<string> {
    const value = await this.get(key);
    if (value === undefined) {
      throw new SecretNotFoundError(key);
    }
    return value;
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== undefined;
  }
}
