/**
 * Graceful Degradation Tests for Optional Service Providers
 *
 * @module @persistence/services/__tests__/graceful-degradation
 * @description Tests that optional service providers return null when secrets are missing.
 *
 * These tests verify the graceful degradation pattern where optional services
 * (ElevenLabs) return null instead of crashing when
 * their required secrets are not configured.
 *
 * @covers ElevenLabsProvider.create() - null return path
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { SecretsProvider } from '@persistence/core';

// Import providers
import { ElevenLabsProvider } from '../tts/elevenlabs.js';

/**
 * Mock SecretsProvider that returns undefined for all secrets
 */
function createMockSecretsProvider(secretMap: Record<string, string | undefined> = {}): SecretsProvider {
  return {
    get: vi.fn(async (key: string) => secretMap[key]),
    require: vi.fn(async (key: string) => {
      const value = secretMap[key];
      if (!value) throw new Error(`Secret ${key} not found`);
      return value;
    }),
    has: vi.fn(async (key: string) => key in secretMap && secretMap[key] !== undefined),
  };
}

describe('Graceful Degradation - Optional Service Providers', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  // ===========================================================================
  // ELEVENLABS PROVIDER
  // ===========================================================================

  describe('ElevenLabsProvider.create()', () => {
    it('returns null when ELEVENLABS_API_KEY is not configured', async () => {
      const secrets = createMockSecretsProvider({});

      const provider = await ElevenLabsProvider.create(secrets);

      expect(provider).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'ElevenLabsProvider: disabled (no ELEVENLABS_API_KEY configured)'
      );
    });

    it('returns null when ELEVENLABS_API_KEY is empty string', async () => {
      const secrets = createMockSecretsProvider({ ELEVENLABS_API_KEY: '' });

      const provider = await ElevenLabsProvider.create(secrets);

      expect(provider).toBeNull();
    });

    it('returns provider when ELEVENLABS_API_KEY is configured', async () => {
      const secrets = createMockSecretsProvider({ ELEVENLABS_API_KEY: 'test-api-key' });

      const provider = await ElevenLabsProvider.create(secrets);

      expect(provider).not.toBeNull();
      expect(provider).toBeInstanceOf(ElevenLabsProvider);
    });
  });

  // ===========================================================================
  // CONSOLE.INFO LOGGING VERIFICATION
  // ===========================================================================

  describe('Console logging behavior', () => {
    it('all providers use console.info (not warn or log)', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const secrets = createMockSecretsProvider({});

      await ElevenLabsProvider.create(secrets);

      // Should only use console.info
      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
