/**
 * @module tests/api/client
 * @description Unit tests for API client
 *
 * Test coverage:
 * - GET, POST, PUT, DELETE methods
 * - Error handling and ApiError class
 * - Request body serialization
 * - Response parsing
 *
 * @covers src/api/client.js
 *   - api.get() - URL construction with WORKER_URL, JSON response parsing,
 *     query parameter passthrough
 *   - api.post() - POST method, JSON body stringification, response data return
 *   - api.put() - PUT method, JSON body serialization
 *   - api.delete() - DELETE method, body with password for protected endpoints
 *   - request() (internal) - Content-Type header, error wrapping, JSON parse fallback
 *   - ApiError class - Error extension, status/data storage, name property
 *
 * @fixtures None (uses mock fetch)
 * @mocks global.fetch
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { api, ApiError, WORKER_URL } from '../../api/client';

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('WORKER_URL', () => {
    it('should default to the placeholder worker URL', () => {
      expect(WORKER_URL).toBe(
        'https://your-worker.workers.dev'
      );
    });
  });

  describe('api.get', () => {
    it('should make GET request to correct URL', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      });

      await api.get('/history');

      expect(global.fetch).toHaveBeenCalledWith(
        `${WORKER_URL}/history`,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should return parsed JSON response', async () => {
      const mockData = { history: [{ id: 1 }, { id: 2 }] };
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await api.get('/history');

      expect(result).toEqual(mockData);
    });

    it('should handle query parameters', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });

      await api.get('/history?limit=100&offset=0');

      expect(global.fetch).toHaveBeenCalledWith(
        `${WORKER_URL}/history?limit=100&offset=0`,
        expect.any(Object)
      );
    });
  });

  describe('api.post', () => {
    it('should make POST request with JSON body', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await api.post('/message', { content: 'Hello' });

      expect(global.fetch).toHaveBeenCalledWith(
        `${WORKER_URL}/message`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ content: 'Hello' }),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should return response data', async () => {
      const mockResponse = { id: 1, created: true };
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await api.post('/message', { content: 'Test' });

      expect(result).toEqual(mockResponse);
    });
  });

  describe('api.put', () => {
    it('should make PUT request with JSON body', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ updated: true }),
      });

      await api.put('/user-status', { status: 'available' });

      expect(global.fetch).toHaveBeenCalledWith(
        `${WORKER_URL}/user-status`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ status: 'available' }),
        })
      );
    });
  });

  describe('api.delete', () => {
    it('should make DELETE request with body', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ deleted: true }),
      });

      await api.delete('/branches/test', { password: 'admin123' });

      expect(global.fetch).toHaveBeenCalledWith(
        `${WORKER_URL}/branches/test`,
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({ password: 'admin123' }),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should throw ApiError on non-ok response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found' }),
      });

      await expect(api.get('/nonexistent')).rejects.toThrow(ApiError);
    });

    it('should include status code in ApiError', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      });

      try {
        await api.post('/admin', { password: 'wrong' });
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(401);
        expect(err.message).toBe('Unauthorized');
      }
    });

    it('should use message field if error field not present', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Server error' }),
      });

      try {
        await api.get('/broken');
      } catch (err) {
        expect(err.message).toBe('Server error');
      }
    });

    it('should provide fallback message for empty error response', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.resolve({}),
      });

      try {
        await api.get('/unavailable');
      } catch (err) {
        expect(err.message).toBe('Request failed: 503');
      }
    });

    it('should wrap network errors with status=0', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      try {
        await api.get('/any');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(0);
        expect(err.message).toBe('Network error');
      }
    });

    it('should handle JSON parse failures gracefully', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const result = await api.get('/bad-json');

      expect(result).toEqual({});
    });

    it('should include response data in ApiError', async () => {
      const errorData = { error: 'Validation failed', fields: ['email'] };
      global.fetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve(errorData),
      });

      try {
        await api.post('/users', { email: 'invalid' });
      } catch (err) {
        expect(err.data).toEqual(errorData);
      }
    });
  });

  describe('ApiError class', () => {
    it('should have correct name property', () => {
      const error = new ApiError('Test', 500);
      expect(error.name).toBe('ApiError');
    });

    it('should be instanceof Error', () => {
      const error = new ApiError('Test', 500);
      expect(error).toBeInstanceOf(Error);
    });

    it('should store all properties', () => {
      const data = { details: 'info' };
      const error = new ApiError('Test message', 418, data);

      expect(error.message).toBe('Test message');
      expect(error.status).toBe(418);
      expect(error.data).toEqual(data);
    });
  });
});
