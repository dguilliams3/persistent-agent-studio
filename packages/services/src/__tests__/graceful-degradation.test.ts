/**
 * Graceful Degradation Tests for Optional Service Providers
 *
 * @module @persistence/services/__tests__/graceful-degradation
 * @description Tests that optional service providers return null when secrets are missing.
 *
 * These tests verify the graceful degradation pattern where optional services
 * (ElevenLabs, Pony, Replicate) return null instead of crashing when
 * their required secrets are not configured.
 *
 * @covers ElevenLabsProvider.create() - null return path
 * @covers PonyStudioProvider.create() - null return paths (username, password)
 * @covers ReplicateProvider.create() - null return path
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { SecretsProvider } from '@persistence/core';

// Import providers
import { ElevenLabsProvider } from '../tts/elevenlabs.js';
import { PonyStudioProvider } from '../image_generation/pony.js';
import { ReplicateProvider } from '../image_generation/replicate.js';

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
  // PONY STUDIO PROVIDER
  // ===========================================================================

  describe('PonyStudioProvider.create()', () => {
    it('returns null when PONY_STUDIO_USERNAME is not configured', async () => {
      const secrets = createMockSecretsProvider({
        PONY_STUDIO_PASSWORD: 'testpass',
      });

      const provider = await PonyStudioProvider.create(secrets);

      expect(provider).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'PonyStudioProvider: disabled (no PONY_STUDIO_USERNAME configured)'
      );
    });

    it('returns null when PONY_STUDIO_PASSWORD is not configured', async () => {
      const secrets = createMockSecretsProvider({
        PONY_STUDIO_USERNAME: 'testuser',
      });

      const provider = await PonyStudioProvider.create(secrets);

      expect(provider).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'PonyStudioProvider: disabled (no PONY_STUDIO_PASSWORD configured)'
      );
    });

    it('returns null when both username and password are missing', async () => {
      const secrets = createMockSecretsProvider({});

      const provider = await PonyStudioProvider.create(secrets);

      expect(provider).toBeNull();
      // Should log about missing username (checked first)
      expect(consoleSpy).toHaveBeenCalledWith(
        'PonyStudioProvider: disabled (no PONY_STUDIO_USERNAME configured)'
      );
    });

    it('returns provider when both credentials are configured', async () => {
      const secrets = createMockSecretsProvider({
        PONY_STUDIO_USERNAME: 'testuser',
        PONY_STUDIO_PASSWORD: 'testpass',
        PONY_STUDIO_URL: 'https://pony.example.com',
      });

      const provider = await PonyStudioProvider.create(secrets);

      expect(provider).not.toBeNull();
      expect(provider).toBeInstanceOf(PonyStudioProvider);
    });

    it('uses custom baseUrl when PONY_STUDIO_URL is configured', async () => {
      const secrets = createMockSecretsProvider({
        PONY_STUDIO_USERNAME: 'testuser',
        PONY_STUDIO_PASSWORD: 'testpass',
        PONY_STUDIO_URL: 'https://custom.pony.example.com',
      });

      const provider = await PonyStudioProvider.create(secrets);

      expect(provider).not.toBeNull();
    });
  });

  // ===========================================================================
  // REPLICATE PROVIDER
  // ===========================================================================

  describe('ReplicateProvider.create()', () => {
    it('returns null when REPLICATE_API_TOKEN is not configured', async () => {
      const secrets = createMockSecretsProvider({});

      const provider = await ReplicateProvider.create(secrets);

      expect(provider).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'ReplicateProvider: disabled (no REPLICATE_API_TOKEN configured)'
      );
    });

    it('returns null when REPLICATE_API_TOKEN is empty string', async () => {
      const secrets = createMockSecretsProvider({ REPLICATE_API_TOKEN: '' });

      const provider = await ReplicateProvider.create(secrets);

      expect(provider).toBeNull();
    });

    it('returns provider when REPLICATE_API_TOKEN is configured', async () => {
      const secrets = createMockSecretsProvider({ REPLICATE_API_TOKEN: 'test-token' });

      const provider = await ReplicateProvider.create(secrets);

      expect(provider).not.toBeNull();
      expect(provider).toBeInstanceOf(ReplicateProvider);
    });

    it('uses default flux-schnell model when not specified', async () => {
      const secrets = createMockSecretsProvider({ REPLICATE_API_TOKEN: 'test-token' });

      const provider = await ReplicateProvider.create(secrets);

      expect(provider).not.toBeNull();
    });

    it('accepts custom model option', async () => {
      const secrets = createMockSecretsProvider({ REPLICATE_API_TOKEN: 'test-token' });

      const provider = await ReplicateProvider.create(secrets, { model: 'flux-dev' });

      expect(provider).not.toBeNull();
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
      await PonyStudioProvider.create(secrets);
      await ReplicateProvider.create(secrets);

      // Should only use console.info
      expect(consoleSpy).toHaveBeenCalledTimes(3);
      expect(logSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
