/**
 * Modal Prosody STT Provider Tests
 *
 * @module @persistence/services/stt/__tests__/modal
 * @description Tests for Modal prosodic annotation speech-to-text provider.
 *
 * @covers ModalProsodyProvider - transcribe, transcribeWithProsody, checkHealth
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ModalProsodyProvider } from '../modal.js';
import { MODAL_PROSODY_URL, MODAL_HEALTH_URL } from '../types.js';

describe('ModalProsodyProvider', () => {
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
    it('uses default URLs when no config provided', () => {
      const provider = new ModalProsodyProvider();
      expect(provider).toBeDefined();
    });

    it('accepts custom URLs', () => {
      const provider = new ModalProsodyProvider({
        processUrl: 'https://custom.example.com/process',
        healthUrl: 'https://custom.example.com/health',
        timeout: 60000,
      });
      expect(provider).toBeDefined();
    });
  });

  // ===========================================================================
  // TRANSCRIBE WITH PROSODY
  // ===========================================================================

  describe('transcribeWithProsody', () => {
    it('calls correct Modal endpoint', async () => {
      const provider = new ModalProsodyProvider();

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            annotated_text: '[softly] hello',
            raw_text: 'hello',
          }),
          { status: 200 }
        )
      );

      await provider.transcribeWithProsody(new ArrayBuffer(100));

      expect(fetchSpy).toHaveBeenCalledWith(
        MODAL_PROSODY_URL,
        expect.any(Object)
      );
    });

    it('sends audio data in body', async () => {
      const provider = new ModalProsodyProvider();
      const audioBuffer = new ArrayBuffer(100);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ annotated_text: 'test' }),
          { status: 200 }
        )
      );

      await provider.transcribeWithProsody(audioBuffer);

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: audioBuffer,
        })
      );
    });

    it('sets correct content-type header', async () => {
      const provider = new ModalProsodyProvider();

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ annotated_text: 'test' }),
          { status: 200 }
        )
      );

      await provider.transcribeWithProsody(new ArrayBuffer(100));

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { 'Content-Type': 'audio/ogg' },
        })
      );
    });

    it('uses custom mime type when specified', async () => {
      const provider = new ModalProsodyProvider();

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ annotated_text: 'test' }),
          { status: 200 }
        )
      );

      await provider.transcribeWithProsody(new ArrayBuffer(100), {
        mimeType: 'audio/mpeg',
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { 'Content-Type': 'audio/mpeg' },
        })
      );
    });

    it('returns annotated text on success', async () => {
      const provider = new ModalProsodyProvider();

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            annotated_text: '[softly] hello [pause, 2s] world',
            raw_text: 'hello world',
            word_count: 2,
            duration_seconds: 3.5,
          }),
          { status: 200 }
        )
      );

      const result = await provider.transcribeWithProsody(new ArrayBuffer(100));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.annotatedText).toBe('[softly] hello [pause, 2s] world');
        expect(result.data.rawText).toBe('hello world');
        expect(result.data.wordCount).toBe(2);
        expect(result.data.durationSeconds).toBe(3.5);
      }
    });

    it('handles processing errors in response', async () => {
      const provider = new ModalProsodyProvider();

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: 'Audio too short' }),
          { status: 200 }
        )
      );

      const result = await provider.transcribeWithProsody(new ArrayBuffer(100));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SERVICE_ERROR');
        expect(result.error.message).toBe('Audio too short');
      }
    });

    it('handles missing annotated_text in response', async () => {
      const provider = new ModalProsodyProvider();

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ raw_text: 'hello' }),
          { status: 200 }
        )
      );

      const result = await provider.transcribeWithProsody(new ArrayBuffer(100));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SERVICE_ERROR');
        expect(result.error.message).toContain('No annotated text');
      }
    });

    it('handles HTTP 500 errors', async () => {
      const provider = new ModalProsodyProvider();

      fetchSpy.mockResolvedValueOnce(
        new Response('Internal Server Error', { status: 500 })
      );

      const result = await provider.transcribeWithProsody(new ArrayBuffer(100));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SERVICE_ERROR');
        expect(result.error.statusCode).toBe(500);
      }
    });

    it('handles network errors', async () => {
      const provider = new ModalProsodyProvider();

      fetchSpy.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await provider.transcribeWithProsody(new ArrayBuffer(100));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NETWORK_ERROR');
        expect(result.error.message).toContain('Connection refused');
      }
    });

    it('handles timeout via AbortError', async () => {
      const provider = new ModalProsodyProvider({ timeout: 1 });

      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      fetchSpy.mockRejectedValueOnce(abortError);

      const result = await provider.transcribeWithProsody(new ArrayBuffer(100));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('TIMEOUT');
      }
    });
  });

  // ===========================================================================
  // TRANSCRIBE (BASIC)
  // ===========================================================================

  describe('transcribe', () => {
    it('delegates to transcribeWithProsody with includeRaw', async () => {
      const provider = new ModalProsodyProvider();

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            annotated_text: '[softly] hello',
            raw_text: 'hello',
          }),
          { status: 200 }
        )
      );

      const result = await provider.transcribe(new ArrayBuffer(100));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text).toBe('hello'); // Uses raw_text
      }
    });

    it('falls back to annotated text if raw_text missing', async () => {
      const provider = new ModalProsodyProvider();

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            annotated_text: '[softly] hello',
          }),
          { status: 200 }
        )
      );

      const result = await provider.transcribe(new ArrayBuffer(100));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text).toBe('[softly] hello');
      }
    });

    it('passes through errors from transcribeWithProsody', async () => {
      const provider = new ModalProsodyProvider();

      fetchSpy.mockResolvedValueOnce(
        new Response('Service unavailable', { status: 503 })
      );

      const result = await provider.transcribe(new ArrayBuffer(100));

      expect(result.success).toBe(false);
    });

    it('includes duration in result', async () => {
      const provider = new ModalProsodyProvider();

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            annotated_text: 'test',
            raw_text: 'test',
            duration_seconds: 5.2,
          }),
          { status: 200 }
        )
      );

      const result = await provider.transcribe(new ArrayBuffer(100));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.durationSeconds).toBe(5.2);
      }
    });
  });

  // ===========================================================================
  // CHECK HEALTH
  // ===========================================================================

  describe('checkHealth', () => {
    it('calls correct health endpoint', async () => {
      const provider = new ModalProsodyProvider();

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      );

      await provider.checkHealth();

      expect(fetchSpy).toHaveBeenCalledWith(MODAL_HEALTH_URL, { method: 'GET' });
    });

    it('returns healthy true when status is ok', async () => {
      const provider = new ModalProsodyProvider();

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      );

      const result = await provider.checkHealth();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.healthy).toBe(true);
      }
    });

    it('returns healthy false on non-ok response', async () => {
      const provider = new ModalProsodyProvider();

      fetchSpy.mockResolvedValueOnce(
        new Response('Service unavailable', { status: 503 })
      );

      const result = await provider.checkHealth();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.healthy).toBe(false);
      }
    });

    it('returns healthy false on network error', async () => {
      const provider = new ModalProsodyProvider();

      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      const result = await provider.checkHealth();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.healthy).toBe(false);
      }
    });

    it('returns healthy false when status is not ok', async () => {
      const provider = new ModalProsodyProvider();

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'degraded' }), { status: 200 })
      );

      const result = await provider.checkHealth();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.healthy).toBe(false);
      }
    });

    it('uses custom health URL when configured', async () => {
      const customHealthUrl = 'https://custom.example.com/health';
      const provider = new ModalProsodyProvider({ healthUrl: customHealthUrl });

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      );

      await provider.checkHealth();

      expect(fetchSpy).toHaveBeenCalledWith(customHealthUrl, { method: 'GET' });
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('edge cases', () => {
    it('handles prosody annotations with special characters', async () => {
      const provider = new ModalProsodyProvider();

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            annotated_text: '[softly, hesitant] I don\'t know... [pause, 2.1s] maybe?',
            raw_text: 'I don\'t know maybe',
          }),
          { status: 200 }
        )
      );

      const result = await provider.transcribeWithProsody(new ArrayBuffer(100));

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.annotatedText).toContain('[pause, 2.1s]');
      }
    });

    it('handles empty annotated_text string', async () => {
      const provider = new ModalProsodyProvider();

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ annotated_text: '' }),
          { status: 200 }
        )
      );

      const result = await provider.transcribeWithProsody(new ArrayBuffer(100));

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('No annotated text');
      }
    });

    it('handles malformed JSON response', async () => {
      const provider = new ModalProsodyProvider();

      fetchSpy.mockResolvedValueOnce(
        new Response('not json', { status: 200 })
      );

      const result = await provider.transcribeWithProsody(new ArrayBuffer(100));

      expect(result.success).toBe(false);
    });
  });
});
