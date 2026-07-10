/**
 * Cloudflare AI Image Generation Provider Tests
 *
 * @module @persistence/services/image_generation/__tests__/cloudflare
 * @description Tests for Cloudflare Workers AI image generation provider.
 *
 * @covers CloudflareAIProvider - generate, getProviderName
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CloudflareAIProvider } from '../cloudflare.js';
import type { CloudflareAIBinding } from '../types.js';

describe('CloudflareAIProvider', () => {
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
      const provider = new CloudflareAIProvider(mockAI);
      expect(provider).toBeDefined();
    });

    it('accepts AI binding with config', () => {
      const provider = new CloudflareAIProvider(mockAI, {
        defaultNegativePrompt: 'custom negative',
      });
      expect(provider).toBeDefined();
    });
  });

  // ===========================================================================
  // GET PROVIDER NAME
  // ===========================================================================

  describe('getProviderName', () => {
    it('returns cloudflare', () => {
      const provider = new CloudflareAIProvider(mockAI);
      expect(provider.getProviderName()).toBe('cloudflare');
    });
  });

  // ===========================================================================
  // GENERATE - AI BINDING CALLS
  // ===========================================================================

  describe('generate - AI binding calls', () => {
    it('calls correct SDXL model', async () => {
      const provider = new CloudflareAIProvider(mockAI);

      runSpy.mockResolvedValueOnce(new ArrayBuffer(1000));

      await provider.generate('test prompt');

      expect(runSpy).toHaveBeenCalledWith(
        '@cf/stabilityai/stable-diffusion-xl-base-1.0',
        expect.any(Object)
      );
    });

    it('passes prompt to AI binding', async () => {
      const provider = new CloudflareAIProvider(mockAI);

      runSpy.mockResolvedValueOnce(new ArrayBuffer(1000));

      await provider.generate('a beautiful sunset');

      expect(runSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          prompt: 'a beautiful sunset',
        })
      );
    });

    it('uses default negative prompt', async () => {
      const provider = new CloudflareAIProvider(mockAI);

      runSpy.mockResolvedValueOnce(new ArrayBuffer(1000));

      await provider.generate('test');

      expect(runSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          negative_prompt: expect.stringContaining('ugly'),
        })
      );
    });

    it('uses custom negative prompt from config', async () => {
      const provider = new CloudflareAIProvider(mockAI, {
        defaultNegativePrompt: 'no cats',
      });

      runSpy.mockResolvedValueOnce(new ArrayBuffer(1000));

      await provider.generate('test');

      expect(runSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          negative_prompt: 'no cats',
        })
      );
    });

    it('uses negative prompt from options', async () => {
      const provider = new CloudflareAIProvider(mockAI);

      runSpy.mockResolvedValueOnce(new ArrayBuffer(1000));

      await provider.generate('test', { negativePrompt: 'no dogs' });

      expect(runSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          negative_prompt: 'no dogs',
        })
      );
    });
  });

  // ===========================================================================
  // GENERATE - RESPONSE HANDLING
  // ===========================================================================

  describe('generate - response handling', () => {
    it('handles ArrayBuffer response', async () => {
      const provider = new CloudflareAIProvider(mockAI);
      const imageData = new ArrayBuffer(1000);

      runSpy.mockResolvedValueOnce(imageData);

      const result = await provider.generate('test');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.base64).toMatch(/^data:image\/png;base64,/);
        expect(result.data.format).toBe('image/png');
        expect(result.data.provider).toBe('cloudflare');
      }
    });

    it('handles Uint8Array response', async () => {
      const provider = new CloudflareAIProvider(mockAI);
      const imageData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      // Need >100 bytes for base64 check
      const largeData = new Uint8Array(200);
      runSpy.mockResolvedValueOnce(largeData);

      const result = await provider.generate('test');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.base64).toBeDefined();
      }
    });

    it('handles ReadableStream response', async () => {
      const provider = new CloudflareAIProvider(mockAI);

      // Create a mock ReadableStream
      const chunks = [
        new Uint8Array(100),
        new Uint8Array(100),
      ];
      let chunkIndex = 0;

      const mockStream = {
        getReader: () => ({
          read: async () => {
            if (chunkIndex < chunks.length) {
              return { done: false, value: chunks[chunkIndex++] };
            }
            return { done: true, value: undefined };
          },
        }),
      };

      Object.setPrototypeOf(mockStream, ReadableStream.prototype);

      runSpy.mockResolvedValueOnce(mockStream as unknown as ReadableStream);

      const result = await provider.generate('test');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.base64).toBeDefined();
      }
    });

    it('handles object with base64 image property', async () => {
      const provider = new CloudflareAIProvider(mockAI);

      runSpy.mockResolvedValueOnce({
        image: 'SGVsbG8gV29ybGQ=', // base64 encoded "Hello World"
      });

      const result = await provider.generate('test');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.base64).toMatch(/^data:image\/png;base64,/);
      }
    });

    it('handles object with data URL image property', async () => {
      const provider = new CloudflareAIProvider(mockAI);

      runSpy.mockResolvedValueOnce({
        image: 'data:image/jpeg;base64,/9j/4AAQ',
      });

      const result = await provider.generate('test');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.base64).toBe('data:image/jpeg;base64,/9j/4AAQ');
      }
    });

    it('handles object with ArrayBuffer image property', async () => {
      const provider = new CloudflareAIProvider(mockAI);
      const imageBuffer = new ArrayBuffer(200);

      runSpy.mockResolvedValueOnce({ image: imageBuffer });

      const result = await provider.generate('test');

      expect(result.success).toBe(true);
    });

    it('rejects empty/small image data', async () => {
      const provider = new CloudflareAIProvider(mockAI);

      runSpy.mockResolvedValueOnce(new ArrayBuffer(10)); // Too small

      const result = await provider.generate('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SERVICE_ERROR');
        expect(result.error.message).toContain('too small');
      }
    });
  });

  // ===========================================================================
  // GENERATE - ERROR HANDLING
  // ===========================================================================

  describe('generate - error handling', () => {
    it('handles AI binding errors', async () => {
      const provider = new CloudflareAIProvider(mockAI);

      runSpy.mockRejectedValueOnce(new Error('AI model unavailable'));

      const result = await provider.generate('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NETWORK_ERROR');
        expect(result.error.message).toContain('AI model unavailable');
      }
    });

    it('handles non-Error exceptions', async () => {
      const provider = new CloudflareAIProvider(mockAI);

      runSpy.mockRejectedValueOnce('String error');

      const result = await provider.generate('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NETWORK_ERROR');
        expect(result.error.message).toBe('String error');
      }
    });

    it('handles content filter rejections', async () => {
      const provider = new CloudflareAIProvider(mockAI);

      runSpy.mockRejectedValueOnce(new Error('Content blocked by safety filter'));

      const result = await provider.generate('inappropriate content');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Content blocked');
      }
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('edge cases', () => {
    it('handles empty prompt', async () => {
      const provider = new CloudflareAIProvider(mockAI);

      runSpy.mockResolvedValueOnce(new ArrayBuffer(200));

      const result = await provider.generate('');

      expect(runSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ prompt: '' })
      );
    });

    it('handles very long prompts', async () => {
      const provider = new CloudflareAIProvider(mockAI);
      const longPrompt = 'a'.repeat(10000);

      runSpy.mockResolvedValueOnce(new ArrayBuffer(200));

      const result = await provider.generate(longPrompt);

      expect(runSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ prompt: longPrompt })
      );
    });

    it('handles prompts with special characters', async () => {
      const provider = new CloudflareAIProvider(mockAI);
      const specialPrompt = 'test "quotes" and <brackets> & ampersands';

      runSpy.mockResolvedValueOnce(new ArrayBuffer(200));

      await provider.generate(specialPrompt);

      expect(runSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ prompt: specialPrompt })
      );
    });
  });
});
