/// <reference types="node" />
/**
 * Node.js Environment Secrets Provider
 *
 * @module @persistence/core/secrets/node-env
 * @description Reads secrets from process.env for Node.js runtimes.
 *
 * Useful for local development, testing, and Node.js deployments.
 * Secrets can be set via .env files (using dotenv), environment variables,
 * or shell exports.
 *
 * @upstream Called by: Test harnesses, Node.js platforms
 * @downstream Calls: None (reads from process.env)
 *
 * @example
 * // Load .env file (optional, requires dotenv)
 * import 'dotenv/config';
 *
 * // Create provider
 * const secrets = new NodeEnvSecretsProvider();
 * const apiKey = await secrets.require('MY_API_KEY');
 */

import { SecretsProvider, SecretNotFoundError } from './types.js';

/**
 * @description SecretsProvider implementation for Node.js process.env.
 *
 * Reads secrets from Node.js environment variables (process.env).
 * Commonly used with .env files in development or environment variables
 * in production Node.js deployments.
 *
 * @upstream Called by: Test suites, Node.js platform bootstrap
 * @downstream Calls: None (reads from process.env)
 *
 * @example
 * const secrets = new NodeEnvSecretsProvider();
 * const apiKey = await secrets.require('MY_API_KEY');
 *
 * @example
 * // In tests with .env file
 * import 'dotenv/config';
 * const secrets = new NodeEnvSecretsProvider();
 * const testKey = await secrets.get('TEST_API_KEY');
 *
 * @note This provider is synchronous (process.env access is sync) but
 * implements async methods to match the SecretsProvider interface.
 * This allows all providers to be used interchangeably.
 */
export class NodeEnvSecretsProvider implements SecretsProvider {
  async get(key: string): Promise<string | undefined> {
    return process.env[key];
  }

  async require(key: string): Promise<string> {
    const value = await this.get(key);
    if (value === undefined) {
      throw new SecretNotFoundError(key);
    }
    return value;
  }

  async has(key: string): Promise<boolean> {
    return process.env[key] !== undefined;
  }
}
