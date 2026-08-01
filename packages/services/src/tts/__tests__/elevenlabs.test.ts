/**
 * ElevenLabs TTS Provider Tests
 *
 * @module @persistence/services/tts/__tests__/elevenlabs
 * @description Tests for ElevenLabs text-to-speech provider.
 *
 * @covers ElevenLabsProvider - synthesize, listVoices, getModels
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ElevenLabsProvider } from '../elevenlabs.js';
import type { ElevenLabsConfig } from '../types.js';

describe('ElevenLabsProvider', () => {
  const mockApiKey = 'test-api-key-12345';
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // CONSTRUCTOR
  // ===========================================================================

  describe('constructor', () => {
    it('accepts simple API key string', () => {
      const provider = ElevenLabsProvider.fromCredentials(mockApiKey);
      expect(provider).toBeDefined();
    });

    it('accepts full config object', () => {
      const config: ElevenLabsConfig = {
        apiKey: mockApiKey,
        defaultVoiceId: 'custom-voice-id',
        defaultModel: 'v3',
        defaultVoiceSettings: {
          stability: 0.5,
          similarityBoost: 0.8,
          style: 0.3,
          speed: 1.1,
        },
      };
      const provider = ElevenLabsProvider.fromCredentials(config);
      expect(provider).toBeDefined();
    });

    it('resolves model shorthand to full ID', async () => {
      const provider = ElevenLabsProvider.fromCredentials({
        apiKey: mockApiKey,
        defaultModel: 'flash',
      });

      fetchSpy.mockResolvedValueOnce(
        new Response(new ArrayBuffer(100), {
          status: 200,
          headers: { 'Content-Type': 'audio/mpeg' },
        })
      );

      await provider.synthesize('test');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('eleven_flash_v2_5'),
        })
      );
    });
  });

  // ===========================================================================
  // SYNTHESIZE
  // ===========================================================================

  describe('synthesize', () => {
    it('calls correct endpoint URL', async () => {
      const provider = ElevenLabsProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(new ArrayBuffer(100), {
          status: 200,
          headers: { 'Content-Type': 'audio/mpeg' },
        })
      );

      await provider.synthesize('Hello world');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://api.elevenlabs.io/v1/text-to-speech/'),
        expect.any(Object)
      );
    });

    it('sends correct auth headers', async () => {
      const provider = ElevenLabsProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(new ArrayBuffer(100), { status: 200 })
      );

      await provider.synthesize('Hello');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'xi-api-key': mockApiKey,
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('sends correct request body structure', async () => {
      const provider = ElevenLabsProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(new ArrayBuffer(100), { status: 200 })
      );

      await provider.synthesize('Hello', {
        voiceId: 'custom-voice',
        model: 'v2',
        stability: 0.5,
        similarityBoost: 0.8,
      });

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);

      expect(body).toMatchObject({
        text: 'Hello',
        model_id: 'eleven_multilingual_v2',
        voice_settings: expect.objectContaining({
          stability: 0.5,
          similarity_boost: 0.8,
        }),
      });
    });

    it('returns audio data on success', async () => {
      const provider = ElevenLabsProvider.fromCredentials(mockApiKey);
      const mockAudio = new ArrayBuffer(1000);

      fetchSpy.mockResolvedValueOnce(
        new Response(mockAudio, { status: 200 })
      );

      const result = await provider.synthesize('Hello');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.audio).toBeDefined();
        expect(result.data.format).toBe('audio/mpeg');
        expect(result.data.charCount).toBe(5);
      }
    });

    it('handles empty text input', async () => {
      const provider = ElevenLabsProvider.fromCredentials(mockApiKey);

      const result = await provider.synthesize('');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
        expect(result.error.message).toContain('Empty text');
      }
    });

    it('handles whitespace-only input', async () => {
      const provider = ElevenLabsProvider.fromCredentials(mockApiKey);

      const result = await provider.synthesize('   ');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });

    it('handles 401 auth errors', async () => {
      const provider = ElevenLabsProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), {
          status: 401,
        })
      );

      const result = await provider.synthesize('Hello');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AUTH_ERROR');
        expect(result.error.statusCode).toBe(401);
      }
    });

    it('handles 402 insufficient credit errors', async () => {
      const provider = ElevenLabsProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Insufficient credits' }), {
          status: 402,
        })
      );

      const result = await provider.synthesize('Hello');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INSUFFICIENT_CREDIT');
      }
    });

    it('handles 429 rate limit errors', async () => {
      const provider = ElevenLabsProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Rate limited' }), {
          status: 429,
        })
      );

      const result = await provider.synthesize('Hello');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('RATE_LIMIT');
      }
    });

    it('handles 500 server errors', async () => {
      const provider = ElevenLabsProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response('Internal Server Error', { status: 500 })
      );

      const result = await provider.synthesize('Hello');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SERVICE_ERROR');
      }
    });

    it('handles network errors', async () => {
      const provider = ElevenLabsProvider.fromCredentials(mockApiKey);

      fetchSpy.mockRejectedValueOnce(new Error('Network failure'));

      const result = await provider.synthesize('Hello');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NETWORK_ERROR');
        expect(result.error.message).toContain('Network failure');
      }
    });

    it('handles timeout via AbortError', async () => {
      const provider = ElevenLabsProvider.fromCredentials(mockApiKey);

      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      fetchSpy.mockRejectedValueOnce(abortError);

      const result = await provider.synthesize('Hello', { timeout: 1 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('TIMEOUT');
      }
    });

    it('handles voice_not_fine_tuned_for_model error', async () => {
      const provider = ElevenLabsProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            detail: { status: 'voice_not_fine_tuned_for_model' },
          }),
          { status: 400 }
        )
      );

      const result = await provider.synthesize('Hello', { model: 'v3' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('not compatible');
      }
    });

    it('uses v3-specific settings for eleven_v3 model', async () => {
      const provider = ElevenLabsProvider.fromCredentials({
        apiKey: mockApiKey,
        defaultModel: 'v3',
      });

      fetchSpy.mockResolvedValueOnce(
        new Response(new ArrayBuffer(100), { status: 200 })
      );

      await provider.synthesize('Hello', { stability: 0.7 }); // Not a valid v3 stability

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);

      // v3 should normalize stability to 0.5 (Natural)
      expect(body.voice_settings.stability).toBe(0.5);
      // v3 should NOT have use_speaker_boost
      expect(body.voice_settings.use_speaker_boost).toBeUndefined();
    });

    it('adds use_speaker_boost for non-v3 models', async () => {
      const provider = ElevenLabsProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(new ArrayBuffer(100), { status: 200 })
      );

      await provider.synthesize('Hello');

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);

      expect(body.voice_settings.use_speaker_boost).toBe(true);
    });
  });

  // ===========================================================================
  // LIST VOICES
  // ===========================================================================

  describe('listVoices', () => {
    it('calls correct endpoint', async () => {
      const provider = ElevenLabsProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ voices: [] }), { status: 200 })
      );

      await provider.listVoices();

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/voices',
        expect.objectContaining({
          headers: { 'xi-api-key': mockApiKey },
        })
      );
    });

    it('parses voice list correctly', async () => {
      const provider = ElevenLabsProvider.fromCredentials(mockApiKey);

      const mockVoices = {
        voices: [
          {
            voice_id: 'voice-1',
            name: 'Test Voice',
            description: 'A test voice',
            labels: { language: 'en', gender: 'female' },
            preview_url: 'https://example.com/preview.mp3',
          },
          {
            voice_id: 'voice-2',
            name: 'Another Voice',
          },
        ],
      };

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(mockVoices), { status: 200 })
      );

      const result = await provider.listVoices();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0]).toMatchObject({
          id: 'voice-1',
          name: 'Test Voice',
          description: 'A test voice',
          languages: ['en'],
          gender: 'female',
          previewUrl: 'https://example.com/preview.mp3',
        });
      }
    });

    it('handles API errors', async () => {
      const provider = ElevenLabsProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 })
      );

      const result = await provider.listVoices();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AUTH_ERROR');
      }
    });

    it('handles network errors', async () => {
      const provider = ElevenLabsProvider.fromCredentials(mockApiKey);

      fetchSpy.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await provider.listVoices();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NETWORK_ERROR');
      }
    });
  });

  // ===========================================================================
  // GET MODELS
  // ===========================================================================

  describe('getModels', () => {
    it('returns all supported models', () => {
      const provider = ElevenLabsProvider.fromCredentials(mockApiKey);

      const models = provider.getModels();

      expect(models).toHaveLength(4);
      expect(models.map((m) => m.id)).toEqual([
        'eleven_v3',
        'eleven_multilingual_v2',
        'eleven_flash_v2_5',
        'eleven_turbo_v2_5',
      ]);
    });

    it('includes model metadata', () => {
      const provider = ElevenLabsProvider.fromCredentials(mockApiKey);

      const models = provider.getModels();
      const v2 = models.find((m) => m.id === 'eleven_multilingual_v2');

      expect(v2?.name).toBe('v2');
      expect(v2?.description).toContain('language');
      expect(v2?.latency).toBe('medium');
    });
  });
});
