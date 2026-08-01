/**
 * API Mock Utilities
 *
 * @module tests/utils/api
 * @description Mock utilities for testing fetch-based API calls
 *
 * Provides helpers to mock global fetch for testing API client
 * and hooks that make HTTP requests.
 *
 * @upstream Called by: Hook tests, API client tests
 * @downstream Calls: vitest vi.fn()
 *
 * @usage
 * import { mockFetch, mockApiResponse, mockApiError } from '../utils/api';
 *
 * mockApiResponse({ items: [1, 2, 3] });
 * // Now fetch('/api/items') returns { items: [1, 2, 3] }
 */

import { vi } from 'vitest';

/**
 * @description Mock global fetch with custom response
 *
 * @param {*} response - Response body (will be JSON.stringify'd)
 * @param {Object} options - Response options
 * @param {number} options.status - HTTP status code (default: 200)
 * @param {boolean} options.ok - Response ok flag (default: true)
 * @param {Object} options.headers - Response headers
 * @returns {Function} The mock fetch function for assertions
 *
 * @example
 * const mockFn = mockFetch({ data: 'test' });
 * await fetch('/api');
 * expect(mockFn).toHaveBeenCalledWith('/api');
 */
export function mockFetch(response, options = {}) {
  const { status = 200, ok = true, headers = {} } = options;

  const mockResponse = {
    ok,
    status,
    headers: new Map(Object.entries(headers)),
    json: vi.fn().mockResolvedValue(response),
    text: vi.fn().mockResolvedValue(JSON.stringify(response)),
    clone: vi.fn(function () {
      return { ...this };
    }),
  };

  global.fetch = vi.fn().mockResolvedValue(mockResponse);
  return global.fetch;
}

/**
 * @description Mock a successful API response (shorthand)
 *
 * @param {*} data - Response data
 * @param {number} status - HTTP status (default: 200)
 * @returns {Function} The mock fetch function
 *
 * @example
 * mockApiResponse({ users: [] });
 */
export function mockApiResponse(data, status = 200) {
  return mockFetch(data, { status, ok: status >= 200 && status < 300 });
}

/**
 * @description Mock an API error response
 *
 * @param {string} message - Error message
 * @param {number} status - HTTP status (default: 500)
 * @returns {Function} The mock fetch function
 *
 * @example
 * mockApiError('Server error', 500);
 */
export function mockApiError(message, status = 500) {
  return mockFetch({ error: message }, { status, ok: false });
}

/**
 * @description Mock a network error (fetch rejection)
 *
 * @param {string} message - Error message (default: 'Network error')
 * @returns {Function} The mock fetch function
 *
 * @example
 * mockNetworkError();
 * await expect(fetch('/api')).rejects.toThrow('Network error');
 */
export function mockNetworkError(message = 'Network error') {
  global.fetch = vi.fn().mockRejectedValue(new Error(message));
  return global.fetch;
}

/**
 * @description Mock fetch to return different responses for different URLs
 *
 * @param {Object} urlMap - Map of URL patterns to responses
 * @returns {Function} The mock fetch function
 *
 * @example
 * mockFetchByUrl({
 *   '/api/users': { users: [] },
 *   '/api/posts': { posts: [] },
 * });
 */
export function mockFetchByUrl(urlMap) {
  global.fetch = vi.fn().mockImplementation((url) => {
    const matchedUrl = Object.keys(urlMap).find((pattern) =>
      url.includes(pattern)
    );

    if (matchedUrl) {
      const response = urlMap[matchedUrl];
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(response),
        text: () => Promise.resolve(JSON.stringify(response)),
      });
    }

    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
      text: () => Promise.resolve('{"error":"Not found"}'),
    });
  });

  return global.fetch;
}

/**
 * @description Mock fetch with a sequence of responses (for testing retries)
 *
 * @param {Array} responses - Array of response configs
 * @returns {Function} The mock fetch function
 *
 * @example
 * mockFetchSequence([
 *   { ok: false, status: 500 },  // First call fails
 *   { ok: true, data: { success: true } },  // Retry succeeds
 * ]);
 */
export function mockFetchSequence(responses) {
  let callIndex = 0;

  global.fetch = vi.fn().mockImplementation(() => {
    const responseConfig = responses[callIndex] || responses[responses.length - 1];
    callIndex++;

    if (responseConfig.error) {
      return Promise.reject(new Error(responseConfig.error));
    }

    return Promise.resolve({
      ok: responseConfig.ok !== false,
      status: responseConfig.status || 200,
      json: () => Promise.resolve(responseConfig.data || responseConfig),
      text: () =>
        Promise.resolve(JSON.stringify(responseConfig.data || responseConfig)),
    });
  });

  return global.fetch;
}

/**
 * @description Reset fetch mock to original state
 */
export function resetFetchMock() {
  if (global.fetch && global.fetch.mockRestore) {
    global.fetch.mockRestore();
  }
  global.fetch = vi.fn();
}
