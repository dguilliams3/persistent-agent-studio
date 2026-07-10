/**
 * Tests for NodeEnvSecretsProvider
 *
 * @module @persistence/core/secrets/__tests__/node-env.test
 * @description Validates Node.js process.env secrets retrieval
 *
 * @covers NodeEnvSecretsProvider - Reads secrets from process.env
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  NodeEnvSecretsProvider,
  SecretNotFoundError,
} from '../index.js';

// Windows has case-insensitive environment variables
const isWindows = process.platform === 'win32';

describe('NodeEnvSecretsProvider', () => {
  let provider: NodeEnvSecretsProvider;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear custom env vars from previous tests
    delete process.env.TEST_API_KEY;
    delete process.env.TEST_PASSWORD;
    delete process.env.TEST_EMPTY;
    delete process.env.TEST_MISSING;
    delete process.env.TEST_MULTILINE;

    provider = new NodeEnvSecretsProvider();
  });

  afterEach(() => {
    // Restore environment to original state
    // First, delete any new vars we added
    Object.keys(process.env).forEach((key) => {
      if (!originalEnv.hasOwnProperty(key)) {
        delete process.env[key];
      }
    });
    // Then restore original values
    Object.assign(process.env, originalEnv);
  });

  describe('get()', () => {
    it('returns env var value when it exists', async () => {
      process.env.TEST_API_KEY = 'my-secret-api-key';
      const value = await provider.get('TEST_API_KEY');
      expect(value).toBe('my-secret-api-key');
    });

    it('returns undefined when env var does not exist', async () => {
      const value = await provider.get('DEFINITELY_NONEXISTENT_VAR_12345');
      expect(value).toBeUndefined();
    });

    it('returns empty string when env var is empty', async () => {
      process.env.TEST_EMPTY = '';
      const value = await provider.get('TEST_EMPTY');
      expect(value).toBe('');
    });

    it('returns value even if it contains special characters', async () => {
      process.env.TEST_SPECIAL = 'key=value&other=123!@#$%^&*()';
      const value = await provider.get('TEST_SPECIAL');
      expect(value).toBe('key=value&other=123!@#$%^&*()');
    });

    it('returns value with whitespace preserved', async () => {
      process.env.TEST_WHITESPACE = '  spaced  value  ';
      const value = await provider.get('TEST_WHITESPACE');
      expect(value).toBe('  spaced  value  ');
    });

    it('returns multiline string value', async () => {
      const multiline = 'line1\nline2\nline3';
      process.env.TEST_MULTILINE = multiline;
      const value = await provider.get('TEST_MULTILINE');
      expect(value).toBe(multiline);
    });

    // Note: Windows has case-insensitive env vars, so this test only runs on Unix
    it.skipIf(isWindows)('handles case-sensitive variable names', async () => {
      process.env.MyVar = 'uppercase-case';
      const lowercase = await provider.get('myvar');
      const uppercase = await provider.get('MyVar');

      expect(lowercase).toBeUndefined();
      expect(uppercase).toBe('uppercase-case');
    });

    it('handles multiple sequential get calls', async () => {
      process.env.VAR1 = 'value1';
      process.env.VAR2 = 'value2';

      const val1 = await provider.get('VAR1');
      const val2 = await provider.get('VAR2');
      const val1Again = await provider.get('VAR1');

      expect(val1).toBe('value1');
      expect(val2).toBe('value2');
      expect(val1Again).toBe('value1');
    });
  });

  describe('require()', () => {
    it('returns env var value when it exists', async () => {
      process.env.TEST_PASSWORD = 'secure-password-123';
      const value = await provider.require('TEST_PASSWORD');
      expect(value).toBe('secure-password-123');
    });

    it('throws SecretNotFoundError when env var does not exist', async () => {
      await expect(
        provider.require('NONEXISTENT_REQUIRED_VAR')
      ).rejects.toThrow(SecretNotFoundError);
    });

    it('throws SecretNotFoundError with key in message', async () => {
      const key = 'MISSING_CRITICAL_KEY';
      try {
        await provider.require(key);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SecretNotFoundError);
        expect((error as Error).message).toContain(key);
      }
    });

    it('returns empty string without throwing', async () => {
      process.env.TEST_EMPTY = '';
      const value = await provider.require('TEST_EMPTY');
      expect(value).toBe('');
    });

    it('handles multiple sequential require calls', async () => {
      process.env.REQ1 = 'required1';
      process.env.REQ2 = 'required2';

      const val1 = await provider.require('REQ1');
      const val2 = await provider.require('REQ2');

      expect(val1).toBe('required1');
      expect(val2).toBe('required2');
    });

    it('throws when require called multiple times for missing var', async () => {
      await expect(
        provider.require('MISSING_VAR_A')
      ).rejects.toThrow(SecretNotFoundError);

      // Second call should also throw
      await expect(
        provider.require('MISSING_VAR_A')
      ).rejects.toThrow(SecretNotFoundError);
    });
  });

  describe('has()', () => {
    it('returns true when env var exists', async () => {
      process.env.TEST_HAS_VAR = 'exists';
      const exists = await provider.has('TEST_HAS_VAR');
      expect(exists).toBe(true);
    });

    it('returns false when env var does not exist', async () => {
      const exists = await provider.has('DEFINITELY_MISSING_HAS_VAR');
      expect(exists).toBe(false);
    });

    it('returns true for empty string value', async () => {
      process.env.TEST_EMPTY_HAS = '';
      const exists = await provider.has('TEST_EMPTY_HAS');
      expect(exists).toBe(true);
    });

    it('checks multiple variables independently', async () => {
      process.env.HAS_1 = 'value1';
      process.env.HAS_3 = 'value3';

      expect(await provider.has('HAS_1')).toBe(true);
      expect(await provider.has('HAS_2')).toBe(false);
      expect(await provider.has('HAS_3')).toBe(true);
    });

    // Note: Windows has case-insensitive env vars, so this test only runs on Unix
    it.skipIf(isWindows)('respects case sensitivity', async () => {
      process.env.CaseSensitive = 'value';

      expect(await provider.has('CaseSensitive')).toBe(true);
      expect(await provider.has('casesensitive')).toBe(false);
      expect(await provider.has('CASESENSITIVE')).toBe(false);
    });
  });

  describe('interface contract', () => {
    it('implements SecretsProvider interface', () => {
      expect(typeof provider.get).toBe('function');
      expect(typeof provider.require).toBe('function');
      expect(typeof provider.has).toBe('function');
    });

    it('all methods return promises', () => {
      const getResult = provider.get('ANY_VAR');
      const requireResult = provider.require('ANY_VAR').catch(() => {});
      const hasResult = provider.has('ANY_VAR');

      expect(getResult).toBeInstanceOf(Promise);
      expect(requireResult).toBeInstanceOf(Promise);
      expect(hasResult).toBeInstanceOf(Promise);
    });

    // Note: Windows has case-insensitive env vars, so this test only runs on Unix
    it.skipIf(isWindows)('handles case-sensitive operations consistently', async () => {
      process.env.ConsistentCase = 'test-value';

      const get1 = await provider.get('ConsistentCase');
      const get2 = await provider.get('consistentcase');
      const has1 = await provider.has('ConsistentCase');
      const has2 = await provider.has('consistentcase');

      expect(get1).toBe('test-value');
      expect(get2).toBeUndefined();
      expect(has1).toBe(true);
      expect(has2).toBe(false);
    });
  });

  describe('real-world scenarios', () => {
    it('works with typical service API keys', async () => {
      process.env.ELEVENLABS_API_KEY = 'eleven-key-123abc';
      process.env.TELEGRAM_BOT_TOKEN = 'telegram-token-xyz789';
      process.env.ANTHROPIC_API_KEY = 'anthropic-key-def456';

      expect(await provider.require('ELEVENLABS_API_KEY')).toBe(
        'eleven-key-123abc'
      );
      expect(await provider.has('TELEGRAM_BOT_TOKEN')).toBe(true);
      expect(await provider.get('ANTHROPIC_API_KEY')).toBe(
        'anthropic-key-def456'
      );
    });

    it('works with database connection strings', async () => {
      const connString =
        'postgresql://user:password@localhost:5432/dbname';
      process.env.DATABASE_URL = connString;

      const value = await provider.require('DATABASE_URL');
      expect(value).toBe(connString);
    });

    it('handles optional feature toggles', async () => {
      process.env.FEATURE_REPLICATE = 'true';
      // FEATURE_DALLE not set

      const replicateEnabled = await provider.has('FEATURE_REPLICATE');
      const dalleEnabled = await provider.has('FEATURE_DALLE');

      expect(replicateEnabled).toBe(true);
      expect(dalleEnabled).toBe(false);
    });

    it('works in typical .env file pattern', async () => {
      // Simulate loading from .env file
      process.env.PORT = '3000';
      process.env.NODE_ENV = 'development';
      process.env.API_SECRET = 'dev-secret-key';
      process.env.OPTIONAL_FEATURE = '';

      const port = await provider.get('PORT');
      const env = await provider.require('NODE_ENV');
      const secret = await provider.require('API_SECRET');
      const optional = await provider.get('OPTIONAL_FEATURE');

      expect(port).toBe('3000');
      expect(env).toBe('development');
      expect(secret).toBe('dev-secret-key');
      expect(optional).toBe(''); // Empty but present
    });
  });

  describe('edge cases', () => {
    it('handles variables with numeric values', async () => {
      process.env.NUMERIC_VAR = '12345';
      const value = await provider.get('NUMERIC_VAR');
      expect(value).toBe('12345');
      expect(typeof value).toBe('string');
    });

    it('handles variables with boolean-like values', async () => {
      process.env.BOOL_TRUE = 'true';
      process.env.BOOL_FALSE = 'false';

      const trueVal = await provider.get('BOOL_TRUE');
      const falseVal = await provider.get('BOOL_FALSE');

      expect(trueVal).toBe('true');
      expect(falseVal).toBe('false');
      expect(typeof trueVal).toBe('string');
    });

    it('handles variables deleted during execution', async () => {
      process.env.TEMP_VAR = 'temporary';
      const before = await provider.get('TEMP_VAR');

      delete process.env.TEMP_VAR;
      const after = await provider.get('TEMP_VAR');

      expect(before).toBe('temporary');
      expect(after).toBeUndefined();
    });

    it('handles very long variable values', async () => {
      const longValue = 'x'.repeat(10000);
      process.env.LONG_VAR = longValue;

      const value = await provider.get('LONG_VAR');
      expect(value).toBe(longValue);
      expect(value?.length).toBe(10000);
    });
  });
});
