/**
 * Cloudflare Whisper STT Provider Tests
 *
 * @module @persistence/services/stt/__tests__/whisper
 * @description Tests for Cloudflare AI Whisper speech-to-text provider.
 *
 * @covers CloudflareWhisperProvider - transcribe
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CloudflareWhisperProvider } from '../whisper.js';
import type { CloudflareAIBinding } from '../types.js';

describe('CloudflareWhisperProvider', () => {
  let mockAI: CloudflareAIBinding;
  let runSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    runSpy = vi.fn();
    mockAI = { run: runSpy };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // CONSTRUCTOR
  // ===========================================================================

  describe('constructor', () => {
    it('accepts AI binding', () => {
      const provider = new CloudflareWhisperProvider(mockAI);
      expect(provider).toBeDefined();
    });
  });

  // ===========================================================================
  // TRANSCRIBE
  // ===========================================================================

  describe('transcribe', () => {
    it('calls correct Whisper model', async () => {
      const provider = new CloudflareWhisperProvider(mockAI);

      runSpy.mockResolvedValueOnce({ text: 'Hello world' });

      await provider.transcribe(new ArrayBuffer(1000));

      expect(runSpy).toHaveBeenCalledWith(
        '@cf/openai/whisper-large-v3-turbo',
        expect.any(Object)
      );
    });

    it('converts ArrayBuffer to number array', async () => {
      const provider = new CloudflareWhisperProvider(mockAI);
      const audioBuffer = new Uint8Array([1, 2, 3, 4, 5]).buffer;

      runSpy.mockResolvedValueOnce({ text: 'Test' });

      await provider.transcribe(audioBuffer);

      expect(runSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          audio: [1, 2, 3, 4, 5],
        })
      );
    });

    it('passes transcribe task by default', async () => {
      const provider = new CloudflareWhisperProvider(mockAI);

      runSpy.mockResolvedValueOnce({ text: 'Test' });

      await provider.transcribe(new ArrayBuffer(100));

      expect(runSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          task: 'transcribe',
        })
      );
    });

    it('passes translate task when specified', async () => {
      const provider = new CloudflareWhisperProvider(mockAI);

      runSpy.mockResolvedValueOnce({ text: 'Test' });

      await provider.transcribe(new ArrayBuffer(100), { task: 'translate' });

      expect(runSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          task: 'translate',
        })
      );
    });

    it('returns transcribed text on success', async () => {
      const provider = new CloudflareWhisperProvider(mockAI);

      runSpy.mockResolvedValueOnce({ text: '  Hello world  ' });

      const result = await provider.transcribe(new ArrayBuffer(100));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text).toBe('Hello world'); // Trimmed
      }
    });

    it('handles empty result', async () => {
      const provider = new CloudflareWhisperProvider(mockAI);

      runSpy.mockResolvedValueOnce({ text: '' });

      const result = await provider.transcribe(new ArrayBuffer(100));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text).toBe('');
      }
    });

    it('handles undefined text in result', async () => {
      const provider = new CloudflareWhisperProvider(mockAI);

      runSpy.mockResolvedValueOnce({});

      const result = await provider.transcribe(new ArrayBuffer(100));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SERVICE_ERROR');
        expect(result.error.message).toContain('empty result');
      }
    });

    it('handles null result', async () => {
      const provider = new CloudflareWhisperProvider(mockAI);

      runSpy.mockResolvedValueOnce(null);

      const result = await provider.transcribe(new ArrayBuffer(100));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SERVICE_ERROR');
      }
    });

    it('handles AI binding errors', async () => {
      const provider = new CloudflareWhisperProvider(mockAI);

      runSpy.mockRejectedValueOnce(new Error('AI model unavailable'));

      const result = await provider.transcribe(new ArrayBuffer(100));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NETWORK_ERROR');
        expect(result.error.message).toContain('AI model unavailable');
      }
    });

    it('handles non-Error exceptions', async () => {
      const provider = new CloudflareWhisperProvider(mockAI);

      runSpy.mockRejectedValueOnce('String error');

      const result = await provider.transcribe(new ArrayBuffer(100));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NETWORK_ERROR');
        expect(result.error.message).toBe('Unknown transcription error');
      }
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('edge cases', () => {
    it('handles large audio buffers', async () => {
      const provider = new CloudflareWhisperProvider(mockAI);
      const largeBuffer = new ArrayBuffer(1024 * 1024); // 1MB

      runSpy.mockResolvedValueOnce({ text: 'Long transcription' });

      const result = await provider.transcribe(largeBuffer);

      expect(result.success).toBe(true);
    });

    it('handles empty audio buffer', async () => {
      const provider = new CloudflareWhisperProvider(mockAI);

      runSpy.mockResolvedValueOnce({ text: '' });

      const result = await provider.transcribe(new ArrayBuffer(0));

      expect(runSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          audio: [],
        })
      );
    });

    it('preserves result text exactly as returned', async () => {
      const provider = new CloudflareWhisperProvider(mockAI);
      const textWithPunctuation = 'Hello, world! How are you?';

      runSpy.mockResolvedValueOnce({ text: textWithPunctuation });

      const result = await provider.transcribe(new ArrayBuffer(100));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text).toBe(textWithPunctuation);
      }
    });
  });
});
