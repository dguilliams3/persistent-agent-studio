/**
 * Replicate Image Generation Provider Tests
 *
 * @module @persistence/services/image_generation/__tests__/replicate
 * @description Tests for Replicate API image generation provider.
 *
 * @covers ReplicateProvider - generate, getProviderName
 * @covers createFluxSchnellProvider, createFluxDevProvider, createSDXLProvider
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ReplicateProvider,
  createFluxSchnellProvider,
  createFluxDevProvider,
  createSDXLProvider,
} from '../replicate.js';

describe('ReplicateProvider', () => {
  const mockApiToken = 'r8_test_token_12345';
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
    it('accepts simple API token string (defaults to flux-schnell)', () => {
      const provider = ReplicateProvider.fromCredentials(mockApiToken);
      expect(provider.getProviderName()).toBe('replicate-flux-schnell');
    });

    it('accepts config object with model string', () => {
      const provider = ReplicateProvider.fromCredentials({
        apiToken: mockApiToken,
        model: 'flux-dev',
      });
      expect(provider.getProviderName()).toBe('replicate-flux-dev');
    });

    it('accepts config object with custom model config', () => {
      const provider = ReplicateProvider.fromCredentials({
        apiToken: mockApiToken,
        model: {
          modelId: 'custom/model',
          name: 'Custom',
          provider: 'custom-provider',
        },
      });
      expect(provider.getProviderName()).toBe('custom-provider');
    });

    it('handles unknown model string gracefully', () => {
      const provider = ReplicateProvider.fromCredentials({
        apiToken: mockApiToken,
        model: 'unknown-model',
      });
      expect(provider.getProviderName()).toBe('unknown-model');
    });
  });

  // ===========================================================================
  // GENERATE - ENDPOINT AND HEADERS
  // ===========================================================================

  describe('generate - endpoint and headers', () => {
    it('calls models endpoint for official models (no version)', async () => {
      const provider = ReplicateProvider.fromCredentials({
        apiToken: mockApiToken,
        model: 'flux-schnell',
      });

      fetchSpy
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ status: 'succeeded', output: ['https://example.com/image.png'] }),
            { status: 201 }
          )
        )
        .mockResolvedValueOnce(
          new Response(new ArrayBuffer(100), { status: 200 })
        );

      await provider.generate('test prompt');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions'),
        expect.any(Object)
      );
    });

    it('calls predictions endpoint for versioned models', async () => {
      const provider = ReplicateProvider.fromCredentials({
        apiToken: mockApiToken,
        model: 'sdxl',
      });

      fetchSpy
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ status: 'succeeded', output: ['https://example.com/image.png'] }),
            { status: 201 }
          )
        )
        .mockResolvedValueOnce(
          new Response(new ArrayBuffer(100), { status: 200 })
        );

      await provider.generate('test prompt');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.replicate.com/v1/predictions',
        expect.any(Object)
      );
    });

    it('sends correct auth headers', async () => {
      const provider = ReplicateProvider.fromCredentials(mockApiToken);

      fetchSpy
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ status: 'succeeded', output: ['https://example.com/image.png'] }),
            { status: 201 }
          )
        )
        .mockResolvedValueOnce(
          new Response(new ArrayBuffer(100), { status: 200 })
        );

      await provider.generate('test');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockApiToken}`,
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('sends Prefer wait header', async () => {
      const provider = ReplicateProvider.fromCredentials(mockApiToken);

      fetchSpy
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ status: 'succeeded', output: ['https://example.com/image.png'] }),
            { status: 201 }
          )
        )
        .mockResolvedValueOnce(
          new Response(new ArrayBuffer(100), { status: 200 })
        );

      await provider.generate('test');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Prefer': expect.stringMatching(/^wait=\d+$/),
          }),
        })
      );
    });
  });

  // ===========================================================================
  // GENERATE - REQUEST BODY
  // ===========================================================================

  describe('generate - request body', () => {
    it('includes prompt in input', async () => {
      const provider = ReplicateProvider.fromCredentials(mockApiToken);

      fetchSpy
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ status: 'succeeded', output: ['url'] }),
            { status: 201 }
          )
        )
        .mockResolvedValueOnce(new Response(new ArrayBuffer(100)));

      await provider.generate('a beautiful sunset');

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);

      expect(body.input.prompt).toBe('a beautiful sunset');
    });

    it('includes version for versioned models', async () => {
      const provider = ReplicateProvider.fromCredentials({
        apiToken: mockApiToken,
        model: 'sdxl',
      });

      fetchSpy
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ status: 'succeeded', output: ['url'] }),
            { status: 201 }
          )
        )
        .mockResolvedValueOnce(new Response(new ArrayBuffer(100)));

      await provider.generate('test');

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);

      expect(body.version).toBeDefined();
    });

    it('sets flux-schnell specific parameters', async () => {
      const provider = ReplicateProvider.fromCredentials({
        apiToken: mockApiToken,
        model: 'flux-schnell',
      });

      fetchSpy
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ status: 'succeeded', output: ['url'] }),
            { status: 201 }
          )
        )
        .mockResolvedValueOnce(new Response(new ArrayBuffer(100)));

      await provider.generate('test');

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);

      expect(body.input.go_fast).toBe(true);
      expect(body.input.disable_safety_checker).toBe(true);
      expect(body.input.output_format).toBe('png');
    });

    it('sets flux-dev specific parameters', async () => {
      const provider = ReplicateProvider.fromCredentials({
        apiToken: mockApiToken,
        model: 'flux-dev',
      });

      fetchSpy
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ status: 'succeeded', output: ['url'] }),
            { status: 201 }
          )
        )
        .mockResolvedValueOnce(new Response(new ArrayBuffer(100)));

      await provider.generate('test', { guidance: 4.0, steps: 30 });

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);

      expect(body.input.guidance).toBe(4.0);
      expect(body.input.num_inference_steps).toBe(30);
    });

    it('sets SDXL specific parameters', async () => {
      const provider = ReplicateProvider.fromCredentials({
        apiToken: mockApiToken,
        model: 'sdxl',
      });

      fetchSpy
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ status: 'succeeded', output: ['url'] }),
            { status: 201 }
          )
        )
        .mockResolvedValueOnce(new Response(new ArrayBuffer(100)));

      await provider.generate('test', {
        negativePrompt: 'ugly, blurry',
        steps: 40,
        guidance: 8.0,
      });

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);

      expect(body.input.negative_prompt).toBe('ugly, blurry');
      expect(body.input.num_inference_steps).toBe(40);
      expect(body.input.guidance_scale).toBe(8.0);
      expect(body.input.scheduler).toBe('K_EULER');
    });

    it('applies modelSettings override', async () => {
      const provider = ReplicateProvider.fromCredentials(mockApiToken);

      fetchSpy
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ status: 'succeeded', output: ['url'] }),
            { status: 201 }
          )
        )
        .mockResolvedValueOnce(new Response(new ArrayBuffer(100)));

      await provider.generate('test', {
        modelSettings: { custom_param: 'value' },
      });

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);

      expect(body.input.custom_param).toBe('value');
    });
  });

  // ===========================================================================
  // GENERATE - RESPONSE HANDLING
  // ===========================================================================

  describe('generate - response handling', () => {
    it('returns image with base64 on success', async () => {
      const provider = ReplicateProvider.fromCredentials(mockApiToken);
      const imageBytes = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes

      fetchSpy
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ status: 'succeeded', output: ['https://example.com/image.png'] }),
            { status: 201 }
          )
        )
        .mockResolvedValueOnce(new Response(imageBytes.buffer, { status: 200 }));

      const result = await provider.generate('test');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.base64).toMatch(/^data:image\/png;base64,/);
        expect(result.data.url).toBe('https://example.com/image.png');
        expect(result.data.format).toBe('image/png');
        expect(result.data.provider).toBe('replicate-flux-schnell');
      }
    });

    it('handles array output format', async () => {
      const provider = ReplicateProvider.fromCredentials(mockApiToken);

      fetchSpy
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              status: 'succeeded',
              output: ['url1', 'url2', 'url3'],
            }),
            { status: 201 }
          )
        )
        .mockResolvedValueOnce(new Response(new ArrayBuffer(100), { status: 200 }));

      const result = await provider.generate('test');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe('url1'); // Takes first
      }
    });

    it('handles string output format', async () => {
      const provider = ReplicateProvider.fromCredentials(mockApiToken);

      fetchSpy
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ status: 'succeeded', output: 'https://single.url/image.png' }),
            { status: 201 }
          )
        )
        .mockResolvedValueOnce(new Response(new ArrayBuffer(100), { status: 200 }));

      const result = await provider.generate('test');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe('https://single.url/image.png');
      }
    });

    it('handles starting/processing status (timeout)', async () => {
      const provider = ReplicateProvider.fromCredentials(mockApiToken);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: 'starting' }),
          { status: 201 }
        )
      );

      const result = await provider.generate('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('TIMEOUT');
      }
    });

    it('handles unexpected status', async () => {
      const provider = ReplicateProvider.fromCredentials(mockApiToken);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: 'failed' }),
          { status: 201 }
        )
      );

      const result = await provider.generate('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SERVICE_ERROR');
        expect(result.error.message).toContain('failed');
      }
    });

    it('handles API error in response', async () => {
      const provider = ReplicateProvider.fromCredentials(mockApiToken);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: 'Invalid prompt' }),
          { status: 201 }
        )
      );

      const result = await provider.generate('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SERVICE_ERROR');
        expect(result.error.message).toBe('Invalid prompt');
      }
    });

    it('handles empty output array', async () => {
      const provider = ReplicateProvider.fromCredentials(mockApiToken);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: 'succeeded', output: [] }),
          { status: 201 }
        )
      );

      const result = await provider.generate('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SERVICE_ERROR');
        expect(result.error.message).toContain('No image URL');
      }
    });
  });

  // ===========================================================================
  // GENERATE - ERROR HANDLING
  // ===========================================================================

  describe('generate - error handling', () => {
    it('handles 401 auth errors', async () => {
      const provider = ReplicateProvider.fromCredentials(mockApiToken);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ detail: 'Invalid token' }),
          { status: 401 }
        )
      );

      const result = await provider.generate('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AUTH_ERROR');
        expect(result.error.statusCode).toBe(401);
      }
    });

    it('handles 402 payment required', async () => {
      const provider = ReplicateProvider.fromCredentials(mockApiToken);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ detail: 'Insufficient credits' }),
          { status: 402 }
        )
      );

      const result = await provider.generate('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INSUFFICIENT_CREDIT');
      }
    });

    it('handles 422 validation errors', async () => {
      const provider = ReplicateProvider.fromCredentials(mockApiToken);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ detail: 'Invalid parameters' }),
          { status: 422 }
        )
      );

      const result = await provider.generate('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });

    it('handles image fetch failure', async () => {
      const provider = ReplicateProvider.fromCredentials(mockApiToken);

      fetchSpy
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ status: 'succeeded', output: ['https://example.com/image.png'] }),
            { status: 201 }
          )
        )
        .mockResolvedValueOnce(new Response('Not found', { status: 404 }));

      const result = await provider.generate('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SERVICE_ERROR');
      }
    });

    it('handles network errors', async () => {
      const provider = ReplicateProvider.fromCredentials(mockApiToken);

      fetchSpy.mockRejectedValueOnce(new Error('Network failure'));

      const result = await provider.generate('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NETWORK_ERROR');
        expect(result.error.message).toContain('Network failure');
      }
    });

    it('handles timeout via AbortError', async () => {
      const provider = ReplicateProvider.fromCredentials(mockApiToken);

      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      fetchSpy.mockRejectedValueOnce(abortError);

      const result = await provider.generate('test', { timeout: 1 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('TIMEOUT');
      }
    });
  });

  // ===========================================================================
  // FACTORY FUNCTIONS
  // ===========================================================================

  describe('factory functions', () => {
    it('createFluxSchnellProvider creates correct provider', async () => {
      const provider = createFluxSchnellProvider(mockApiToken);

      fetchSpy
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ status: 'succeeded', output: ['url'] }),
            { status: 201 }
          )
        )
        .mockResolvedValueOnce(new Response(new ArrayBuffer(100)));

      await provider.generate('test');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('flux-schnell'),
        expect.any(Object)
      );
    });

    it('createFluxDevProvider creates correct provider', async () => {
      const provider = createFluxDevProvider(mockApiToken);

      fetchSpy
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ status: 'succeeded', output: ['url'] }),
            { status: 201 }
          )
        )
        .mockResolvedValueOnce(new Response(new ArrayBuffer(100)));

      await provider.generate('test');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('flux-dev'),
        expect.any(Object)
      );
    });

    it('createSDXLProvider creates correct provider', async () => {
      const provider = createSDXLProvider(mockApiToken);

      fetchSpy
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ status: 'succeeded', output: ['url'] }),
            { status: 201 }
          )
        )
        .mockResolvedValueOnce(new Response(new ArrayBuffer(100)));

      await provider.generate('test');

      // SDXL uses versioned endpoint
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.replicate.com/v1/predictions',
        expect.any(Object)
      );
    });
  });
});
