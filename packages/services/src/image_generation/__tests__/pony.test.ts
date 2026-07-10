/**
 * Pony Studio Image Generation Provider Tests
 *
 * @module @persistence/services/image_generation/__tests__/pony
 * @description Tests for Pony Studio local image generation provider.
 *
 * @covers PonyStudioProvider - generate, getProviderName
 * @covers getPonyPresets
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PonyStudioProvider, getPonyPresets } from '../pony.js';
import type { PonyStudioConfig } from '../types.js';

describe('PonyStudioProvider', () => {
  const mockConfig: PonyStudioConfig = {
    baseUrl: 'https://pony.example.com',
    username: 'testuser',
    password: 'testpass',
    timeout: 60000,
  };

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
    it('accepts config object', () => {
      const provider = PonyStudioProvider.fromCredentials(mockConfig);
      expect(provider).toBeDefined();
    });

    it('uses default timeout when not provided', () => {
      const provider = PonyStudioProvider.fromCredentials({
        baseUrl: 'https://pony.example.com',
        username: 'user',
        password: 'pass',
      });
      expect(provider).toBeDefined();
    });
  });

  // ===========================================================================
  // GET PROVIDER NAME
  // ===========================================================================

  describe('getProviderName', () => {
    it('returns pony', () => {
      const provider = PonyStudioProvider.fromCredentials(mockConfig);
      expect(provider.getProviderName()).toBe('pony');
    });
  });

  // ===========================================================================
  // GENERATE - HEALTH CHECK
  // ===========================================================================

  describe('generate - health check', () => {
    it('checks health endpoint first', async () => {
      const provider = PonyStudioProvider.fromCredentials(mockConfig);

      fetchSpy.mockResolvedValueOnce(
        new Response('OK', { status: 200 })
      );

      // Will fail at auth step, but we verify health was called
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 401 })
      );

      await provider.generate('test');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://pony.example.com/api/health',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    it('returns error when health check fails', async () => {
      const provider = PonyStudioProvider.fromCredentials(mockConfig);

      fetchSpy.mockResolvedValueOnce(
        new Response('Service Unavailable', { status: 503 })
      );

      const result = await provider.generate('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SERVICE_ERROR');
        expect(result.error.message).toContain('health check failed');
      }
    });

    it('returns timeout error when pony is unreachable', async () => {
      const provider = PonyStudioProvider.fromCredentials(mockConfig);

      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      fetchSpy.mockRejectedValueOnce(abortError);

      const result = await provider.generate('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('TIMEOUT');
        expect(result.error.message).toContain('unreachable');
      }
    });
  });

  // ===========================================================================
  // GENERATE - AUTHENTICATION
  // ===========================================================================

  describe('generate - authentication', () => {
    it('authenticates after health check', async () => {
      const provider = PonyStudioProvider.fromCredentials(mockConfig);

      // Health check OK
      fetchSpy.mockResolvedValueOnce(new Response('OK', { status: 200 }));

      // Auth
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'jwt-token' }), { status: 200 })
      );

      // Will fail at generate step
      fetchSpy.mockResolvedValueOnce(
        new Response('Error', { status: 500 })
      );

      await provider.generate('test');

      // Second call should be auth
      expect(fetchSpy.mock.calls[1][0]).toBe('https://pony.example.com/api/auth');
      expect(fetchSpy.mock.calls[1][1]).toMatchObject({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('sends credentials in auth request', async () => {
      const provider = PonyStudioProvider.fromCredentials(mockConfig);

      fetchSpy.mockResolvedValueOnce(new Response('OK', { status: 200 }));
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'jwt' }), { status: 200 })
      );
      fetchSpy.mockResolvedValueOnce(new Response('Error', { status: 500 }));

      await provider.generate('test');

      const authCall = fetchSpy.mock.calls[1];
      const body = JSON.parse(authCall[1]?.body as string);

      expect(body).toEqual({
        username: 'testuser',
        password: 'testpass',
      });
    });

    it('returns auth error when credentials invalid', async () => {
      const provider = PonyStudioProvider.fromCredentials(mockConfig);

      fetchSpy.mockResolvedValueOnce(new Response('OK', { status: 200 }));
      fetchSpy.mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 })
      );

      const result = await provider.generate('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AUTH_ERROR');
      }
    });

    it('handles access_token response format', async () => {
      const provider = PonyStudioProvider.fromCredentials(mockConfig);

      fetchSpy.mockResolvedValueOnce(new Response('OK', { status: 200 }));
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'oauth-style-token' }), { status: 200 })
      );
      fetchSpy.mockResolvedValueOnce(new Response('Error', { status: 500 }));

      await provider.generate('test');

      // Should proceed past auth
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });
  });

  // ===========================================================================
  // GENERATE - QUEUE GENERATION
  // ===========================================================================

  describe('generate - queue generation', () => {
    const setupSuccessfulAuth = () => {
      fetchSpy.mockResolvedValueOnce(new Response('OK', { status: 200 })); // health
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'jwt-token' }), { status: 200 })
      ); // auth
    };

    it('sends generation request with built prompt', async () => {
      const provider = PonyStudioProvider.fromCredentials(mockConfig);
      setupSuccessfulAuth();

      // Generate request
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ jobs: [{ promptId: 'job-123' }] }), { status: 200 })
      );

      // Jobs poll - job not in pending = done
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ pendingJobs: [] }), { status: 200 })
      );

      // Gallery fetch
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ images: [{ r2ImageUrl: 'https://r2.example.com/img.png' }] }), { status: 200 })
      );

      // Image fetch
      fetchSpy.mockResolvedValueOnce(new Response(new ArrayBuffer(200), { status: 200 }));

      await provider.generate('test');

      const generateCall = fetchSpy.mock.calls[2];
      expect(generateCall[0]).toBe('https://pony.example.com/api/generate');
      expect(generateCall[1]).toMatchObject({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer jwt-token',
        }),
      });
    });

    it('builds prompt with quality prefix', async () => {
      const provider = PonyStudioProvider.fromCredentials(mockConfig);
      setupSuccessfulAuth();

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ jobs: [{ promptId: 'job-123' }] }), { status: 200 })
      );
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ pendingJobs: [] }), { status: 200 })
      );
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ images: [{ url: '/img.png' }] }), { status: 200 })
      );
      fetchSpy.mockResolvedValueOnce(new Response(new ArrayBuffer(200), { status: 200 }));

      await provider.generate('custom prompt text');

      const generateCall = fetchSpy.mock.calls[2];
      const body = JSON.parse(generateCall[1]?.body as string);

      expect(body.prompt).toContain('score_9');
      expect(body.prompt).toContain('custom prompt text');
    });

    it('parses structured parameters', async () => {
      const provider = PonyStudioProvider.fromCredentials(mockConfig);
      setupSuccessfulAuth();

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ jobs: [{ promptId: 'job-123' }] }), { status: 200 })
      );
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ pendingJobs: [] }), { status: 200 })
      );
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ images: [{ url: '/img.png' }] }), { status: 200 })
      );
      fetchSpy.mockResolvedValueOnce(new Response(new ArrayBuffer(200), { status: 200 }));

      await provider.generate("position='cowgirl' style='anime' extra text");

      const generateCall = fetchSpy.mock.calls[2];
      const body = JSON.parse(generateCall[1]?.body as string);

      expect(body.prompt).toContain('cowgirl position');
      expect(body.prompt).toContain('anime style');
      expect(body.prompt).toContain('extra text');
    });

    it('uses negative prompt', async () => {
      const provider = PonyStudioProvider.fromCredentials(mockConfig);
      setupSuccessfulAuth();

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ jobs: [{ promptId: 'job-123' }] }), { status: 200 })
      );
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ pendingJobs: [] }), { status: 200 })
      );
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ images: [{ url: '/img.png' }] }), { status: 200 })
      );
      fetchSpy.mockResolvedValueOnce(new Response(new ArrayBuffer(200), { status: 200 }));

      await provider.generate('test');

      const generateCall = fetchSpy.mock.calls[2];
      const body = JSON.parse(generateCall[1]?.body as string);

      expect(body.negative).toBeDefined();
      expect(body.negative).toContain('score_6');
    });
  });

  // ===========================================================================
  // GENERATE - POLLING
  // ===========================================================================

  describe('generate - polling', () => {
    const setupToPolling = () => {
      fetchSpy.mockResolvedValueOnce(new Response('OK', { status: 200 })); // health
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'jwt' }), { status: 200 })
      ); // auth
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ jobs: [{ promptId: 'job-123' }] }), { status: 200 })
      ); // generate
    };

    it('polls jobs endpoint until job completes', { timeout: 15000 }, async () => {
      const provider = PonyStudioProvider.fromCredentials({ ...mockConfig, timeout: 10000 });
      setupToPolling();

      // First poll - job still pending
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ pendingJobs: [{ promptId: 'job-123' }] }), { status: 200 })
      );

      // Second poll - job complete
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ pendingJobs: [] }), { status: 200 })
      );

      // Gallery
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ images: [{ r2ImageUrl: 'url' }] }), { status: 200 })
      );

      // Image
      fetchSpy.mockResolvedValueOnce(new Response(new ArrayBuffer(200), { status: 200 }));

      await provider.generate('test');

      // Should have called jobs endpoint multiple times
      const jobsCalls = fetchSpy.mock.calls.filter((c) =>
        (c[0] as string).includes('/api/jobs')
      );
      expect(jobsCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('fetches from gallery when job completes', async () => {
      const provider = PonyStudioProvider.fromCredentials(mockConfig);
      setupToPolling();

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ pendingJobs: [] }), { status: 200 })
      );

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ images: [{ r2ImageUrl: 'https://r2.example.com/image.png' }] }), { status: 200 })
      );

      fetchSpy.mockResolvedValueOnce(new Response(new ArrayBuffer(200), { status: 200 }));

      await provider.generate('test');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/gallery'),
        expect.any(Object)
      );
    });
  });

  // ===========================================================================
  // GENERATE - IMAGE FETCH
  // ===========================================================================

  describe('generate - image fetch', () => {
    const setupToImageFetch = () => {
      fetchSpy.mockResolvedValueOnce(new Response('OK', { status: 200 }));
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'jwt' }), { status: 200 })
      );
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ jobs: [{ promptId: 'job-123' }] }), { status: 200 })
      );
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ pendingJobs: [] }), { status: 200 })
      );
    };

    it('fetches image from r2ImageUrl', async () => {
      const provider = PonyStudioProvider.fromCredentials(mockConfig);
      setupToImageFetch();

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ images: [{ r2ImageUrl: 'https://r2.example.com/image.png' }] }), { status: 200 })
      );

      fetchSpy.mockResolvedValueOnce(new Response(new ArrayBuffer(200), { status: 200 }));

      await provider.generate('test');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://r2.example.com/image.png',
        expect.objectContaining({
          headers: { 'Authorization': 'Bearer jwt' },
        })
      );
    });

    it('handles relative image URLs', async () => {
      const provider = PonyStudioProvider.fromCredentials(mockConfig);
      setupToImageFetch();

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ images: [{ url: '/images/test.png' }] }), { status: 200 })
      );

      fetchSpy.mockResolvedValueOnce(new Response(new ArrayBuffer(200), { status: 200 }));

      await provider.generate('test');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://pony.example.com/images/test.png',
        expect.any(Object)
      );
    });

    it('returns base64 encoded image', async () => {
      const provider = PonyStudioProvider.fromCredentials(mockConfig);
      setupToImageFetch();

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ images: [{ url: '/img.png' }] }), { status: 200 })
      );

      fetchSpy.mockResolvedValueOnce(new Response(new ArrayBuffer(200), { status: 200 }));

      const result = await provider.generate('test');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.base64).toMatch(/^data:image\/png;base64,/);
        expect(result.data.format).toBe('image/png');
        expect(result.data.provider).toBe('pony');
      }
    });

    it('handles image fetch failure', async () => {
      const provider = PonyStudioProvider.fromCredentials(mockConfig);
      setupToImageFetch();

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ images: [{ url: '/img.png' }] }), { status: 200 })
      );

      fetchSpy.mockResolvedValueOnce(new Response('Not found', { status: 404 }));

      const result = await provider.generate('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SERVICE_ERROR');
        expect(result.error.message).toContain('Image fetch failed');
      }
    });
  });

  // ===========================================================================
  // GET PONY PRESETS
  // ===========================================================================

  describe('getPonyPresets', () => {
    it('returns all preset categories', () => {
      const presets = getPonyPresets();

      expect(presets).toHaveProperty('position');
      expect(presets).toHaveProperty('body_type');
      expect(presets).toHaveProperty('hair_color');
      expect(presets).toHaveProperty('expression');
      expect(presets).toHaveProperty('setting');
      expect(presets).toHaveProperty('ethnicity');
      expect(presets).toHaveProperty('fantasy');
      expect(presets).toHaveProperty('aesthetic');
      expect(presets).toHaveProperty('style');
    });

    it('returns preset options as arrays', () => {
      const presets = getPonyPresets();

      expect(Array.isArray(presets.position)).toBe(true);
      expect(presets.position).toContain('missionary');
      expect(presets.position).toContain('cowgirl');

      expect(Array.isArray(presets.style)).toBe(true);
      expect(presets.style).toContain('realistic');
      expect(presets.style).toContain('anime');
    });
  });

  // ===========================================================================
  // ERROR HANDLING
  // ===========================================================================

  describe('error handling', () => {
    it('handles network errors', async () => {
      const provider = PonyStudioProvider.fromCredentials(mockConfig);

      fetchSpy.mockRejectedValueOnce(new Error('Network failure'));

      const result = await provider.generate('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NETWORK_ERROR');
      }
    });

    it('handles generation queue failure', async () => {
      const provider = PonyStudioProvider.fromCredentials(mockConfig);

      fetchSpy.mockResolvedValueOnce(new Response('OK', { status: 200 }));
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'jwt' }), { status: 200 })
      );
      fetchSpy.mockResolvedValueOnce(
        new Response('Queue full', { status: 503 })
      );

      const result = await provider.generate('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SERVICE_ERROR');
        expect(result.error.message).toContain('Generate failed');
      }
    });

    it('handles missing job ID in response', async () => {
      const provider = PonyStudioProvider.fromCredentials(mockConfig);

      fetchSpy.mockResolvedValueOnce(new Response('OK', { status: 200 }));
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ token: 'jwt' }), { status: 200 })
      );
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ jobs: [] }), { status: 200 })
      );

      const result = await provider.generate('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('No job ID');
      }
    });
  });
});
