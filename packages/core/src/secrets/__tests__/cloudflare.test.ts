/**
 * Tests for CloudflareSecretsProvider
 *
 * @module @persistence/core/secrets/__tests__/cloudflare.test
 * @description Validates Cloudflare Workers secrets retrieval
 *
 * @covers CloudflareSecretsProvider - Reads secrets from Cloudflare Workers env object
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CloudflareSecretsProvider,
  SecretNotFoundError,
} from '../index.js';

describe('CloudflareSecretsProvider', () => {
  let provider: CloudflareSecretsProvider;
  let env: Record<string, unknown>;

  beforeEach(() => {
    env = {
      API_KEY: 'secret-api-key-value',
      DB_PASSWORD: 'db-pass-123',
      EMPTY_STRING: '',
      NON_STRING_NUMBER: 42,
      NON_STRING_BOOLEAN: true,
      NON_STRING_OBJECT: { nested: 'value' },
    };
    provider = new CloudflareSecretsProvider(env);
  });

  describe('get()', () => {
    it('returns secret value when key exists as string', async () => {
      const value = await provider.get('API_KEY');
      expect(value).toBe('secret-api-key-value');
    });

    it('returns undefined when key does not exist', async () => {
      const value = await provider.get('NONEXISTENT_KEY');
      expect(value).toBeUndefined();
    });

    it('returns undefined when value is not a string (number)', async () => {
      const value = await provider.get('NON_STRING_NUMBER');
      expect(value).toBeUndefined();
    });

    it('returns undefined when value is not a string (boolean)', async () => {
      const value = await provider.get('NON_STRING_BOOLEAN');
      expect(value).toBeUndefined();
    });

    it('returns undefined when value is not a string (object)', async () => {
      const value = await provider.get('NON_STRING_OBJECT');
      expect(value).toBeUndefined();
    });

    it('returns empty string when value is empty string', async () => {
      const value = await provider.get('EMPTY_STRING');
      expect(value).toBe('');
    });

    it('handles multiple sequential get calls', async () => {
      const value1 = await provider.get('API_KEY');
      const value2 = await provider.get('DB_PASSWORD');
      const value3 = await provider.get('API_KEY');

      expect(value1).toBe('secret-api-key-value');
      expect(value2).toBe('db-pass-123');
      expect(value3).toBe('secret-api-key-value');
    });

    it('distinguishes between missing keys and non-string values', async () => {
      const missing = await provider.get('MISSING');
      const nonString = await provider.get('NON_STRING_NUMBER');

      expect(missing).toBeUndefined();
      expect(nonString).toBeUndefined();
      // Both are undefined, but for different reasons
    });
  });

  describe('require()', () => {
    it('returns secret value when key exists', async () => {
      const value = await provider.require('API_KEY');
      expect(value).toBe('secret-api-key-value');
    });

    it('throws SecretNotFoundError when key does not exist', async () => {
      await expect(provider.require('MISSING_KEY')).rejects.toThrow(
        SecretNotFoundError
      );
    });

    it('throws SecretNotFoundError with correct key in message', async () => {
      const key = 'MISSING_API_TOKEN';
      try {
        await provider.require(key);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SecretNotFoundError);
        expect((error as Error).message).toContain(key);
      }
    });

    it('throws when value is not a string', async () => {
      await expect(provider.require('NON_STRING_NUMBER')).rejects.toThrow(
        SecretNotFoundError
      );
    });

    it('returns empty string without throwing', async () => {
      const value = await provider.require('EMPTY_STRING');
      expect(value).toBe('');
    });

    it('handles multiple sequential require calls', async () => {
      const value1 = await provider.require('API_KEY');
      const value2 = await provider.require('DB_PASSWORD');

      expect(value1).toBe('secret-api-key-value');
      expect(value2).toBe('db-pass-123');
    });
  });

  describe('has()', () => {
    it('returns true when secret exists', async () => {
      const exists = await provider.has('API_KEY');
      expect(exists).toBe(true);
    });

    it('returns false when secret does not exist', async () => {
      const exists = await provider.has('MISSING_KEY');
      expect(exists).toBe(false);
    });

    it('returns false when value is not a string', async () => {
      const exists = await provider.has('NON_STRING_NUMBER');
      expect(exists).toBe(false);
    });

    it('returns true for empty string value', async () => {
      const exists = await provider.has('EMPTY_STRING');
      expect(exists).toBe(true);
    });

    it('checks multiple keys independently', async () => {
      const has1 = await provider.has('API_KEY');
      const has2 = await provider.has('MISSING');
      const has3 = await provider.has('DB_PASSWORD');

      expect(has1).toBe(true);
      expect(has2).toBe(false);
      expect(has3).toBe(true);
    });

    it('returns false for non-string values', async () => {
      expect(await provider.has('NON_STRING_BOOLEAN')).toBe(false);
      expect(await provider.has('NON_STRING_OBJECT')).toBe(false);
    });
  });

  describe('interface contract', () => {
    it('implements SecretsProvider interface', async () => {
      expect(typeof provider.get).toBe('function');
      expect(typeof provider.require).toBe('function');
      expect(typeof provider.has).toBe('function');
    });

    it('all methods return promises', () => {
      const getResult = provider.get('API_KEY');
      const requireResult = provider.require('API_KEY');
      const hasResult = provider.has('API_KEY');

      expect(getResult).toBeInstanceOf(Promise);
      expect(requireResult).toBeInstanceOf(Promise);
      expect(hasResult).toBeInstanceOf(Promise);
    });

    it('works with empty env object', async () => {
      const emptyProvider = new CloudflareSecretsProvider({});

      expect(await emptyProvider.get('ANY_KEY')).toBeUndefined();
      expect(await emptyProvider.has('ANY_KEY')).toBe(false);
      await expect(emptyProvider.require('ANY_KEY')).rejects.toThrow(
        SecretNotFoundError
      );
    });

    it('handles case-sensitive key names', async () => {
      const value1 = await provider.get('api_key');
      const value2 = await provider.get('API_KEY');

      expect(value1).toBeUndefined(); // lowercase doesn't exist
      expect(value2).toBe('secret-api-key-value'); // uppercase does
    });
  });

  describe('real-world scenarios', () => {
    it('works with typical Cloudflare Workers secrets', async () => {
      const cloudflareEnv = {
        ELEVENLABS_API_KEY: 'eleven-labs-key',
        TELEGRAM_BOT_TOKEN: 'telegram-token-123',
        REPLICATE_API_TOKEN: 'replicate-token-abc',
        ANTHROPIC_API_KEY: 'anthropic-key-xyz',
      };

      const cfProvider = new CloudflareSecretsProvider(cloudflareEnv);

      expect(await cfProvider.require('ELEVENLABS_API_KEY')).toBe(
        'eleven-labs-key'
      );
      expect(await cfProvider.has('TELEGRAM_BOT_TOKEN')).toBe(true);
      expect(await cfProvider.get('MISSING_SERVICE_KEY')).toBeUndefined();
    });

    it('safely ignores non-secret bindings in env', async () => {
      const mixedEnv = {
        DB_PASSWORD: 'secret-password',
        D1: { namespace: 'database' }, // D1 binding
        R2: { bucket: 'storage' }, // R2 binding
        KV: { namespace: 'cache' }, // KV binding
      };

      const cfProvider = new CloudflareSecretsProvider(mixedEnv);

      expect(await cfProvider.get('DB_PASSWORD')).toBe('secret-password');
      expect(await cfProvider.get('D1')).toBeUndefined(); // Not a string
      expect(await cfProvider.get('R2')).toBeUndefined(); // Not a string
      expect(await cfProvider.get('KV')).toBeUndefined(); // Not a string
    });
  });
});
