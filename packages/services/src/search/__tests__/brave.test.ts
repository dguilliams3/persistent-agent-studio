/**
 * Claude Web Search Provider Tests
 *
 * @module @persistence/services/search/__tests__/brave
 * @description Tests for Claude web_search tool-based search provider.
 *
 * @note Named 'brave' for historical reasons, but tests ClaudeSearchProvider
 *
 * @covers ClaudeSearchProvider - search, getProviderName
 * @covers BraveSearchProvider (alias)
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ClaudeSearchProvider, BraveSearchProvider } from '../brave.js';
import type { ClaudeSearchConfig } from '../types.js';

describe('ClaudeSearchProvider', () => {
  const mockApiKey = 'test-claude-search-key-placeholder';
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
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);
      expect(provider).toBeDefined();
      expect(provider.getProviderName()).toBe('claude-web-search');
    });

    it('accepts config object', () => {
      const config: ClaudeSearchConfig = {
        apiKey: mockApiKey,
        model: 'claude-sonnet-5',
        maxTokens: 4096,
        systemPrompt: 'Be concise.',
      };
      const provider = ClaudeSearchProvider.fromCredentials(config);
      expect(provider).toBeDefined();
    });
  });

  // ===========================================================================
  // BACKWARD COMPATIBILITY
  // ===========================================================================

  describe('backward compatibility', () => {
    it('BraveSearchProvider is alias for ClaudeSearchProvider', () => {
      const provider = new BraveSearchProvider(mockApiKey);
      expect(provider.getProviderName()).toBe('claude-web-search');
    });
  });

  // ===========================================================================
  // SEARCH - API CALL
  // ===========================================================================

  describe('search - API call', () => {
    it('calls Anthropic Messages API', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: [{ type: 'text', text: 'Search results summary' }],
          }),
          { status: 200 }
        )
      );

      await provider.search('latest AI news');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.any(Object)
      );
    });

    it('sends correct auth headers', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ content: [{ type: 'text', text: 'Results' }] }),
          { status: 200 }
        )
      );

      await provider.search('test query');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
            'x-api-key': mockApiKey,
          }),
        })
      );
    });

    it('includes web_search beta header', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ content: [{ type: 'text', text: 'Results' }] }),
          { status: 200 }
        )
      );

      await provider.search('test query');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'anthropic-beta': 'web-search-2025-03-05',
          }),
        })
      );
    });

    it('includes web_search tool in request', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ content: [{ type: 'text', text: 'Results' }] }),
          { status: 200 }
        )
      );

      await provider.search('test');

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);

      expect(body.tools).toBeDefined();
      expect(body.tools[0].type).toBe('web_search_20250305');
      expect(body.tools[0].name).toBe('web_search');
    });

    it('includes query in user message', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ content: [{ type: 'text', text: 'Results' }] }),
          { status: 200 }
        )
      );

      await provider.search('latest AI developments 2026');

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);

      expect(body.messages[0].role).toBe('user');
      expect(body.messages[0].content).toContain('latest AI developments 2026');
    });

    it('uses default model when not specified', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ content: [{ type: 'text', text: 'Results' }] }),
          { status: 200 }
        )
      );

      await provider.search('test');

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);

      expect(body.model).toBe('claude-sonnet-5');
      // Retired dated ids (claude-sonnet-4-*) 404 at the API — the default
      // must stay a live alias. Regression: "Search failed: model: ..."
      expect(body.model).not.toMatch(/-202\d{5}$/);
    });

    it('disables adaptive thinking so max_tokens buys summary, not deliberation', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ content: [{ type: 'text', text: 'Results' }] }),
          { status: 200 }
        )
      );

      await provider.search('test');

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);

      expect(body.thinking).toEqual({ type: 'disabled' });
    });

    it('uses custom model when specified', async () => {
      const provider = ClaudeSearchProvider.fromCredentials({
        apiKey: mockApiKey,
        model: 'claude-3-haiku-20240307',
      });

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ content: [{ type: 'text', text: 'Results' }] }),
          { status: 200 }
        )
      );

      await provider.search('test');

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);

      expect(body.model).toBe('claude-3-haiku-20240307');
    });

    it('uses custom maxTokens when specified', async () => {
      const provider = ClaudeSearchProvider.fromCredentials({
        apiKey: mockApiKey,
        maxTokens: 4096,
      });

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ content: [{ type: 'text', text: 'Results' }] }),
          { status: 200 }
        )
      );

      await provider.search('test');

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);

      expect(body.max_tokens).toBe(4096);
    });

    it('includes system prompt when configured', async () => {
      const provider = ClaudeSearchProvider.fromCredentials({
        apiKey: mockApiKey,
        systemPrompt: 'Be very concise and factual.',
      });

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ content: [{ type: 'text', text: 'Results' }] }),
          { status: 200 }
        )
      );

      await provider.search('test');

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);

      expect(body.system).toBe('Be very concise and factual.');
    });
  });

  // ===========================================================================
  // SEARCH - RESPONSE HANDLING
  // ===========================================================================

  describe('search - response handling', () => {
    it('returns summary on success', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: [{
              type: 'text',
              text: 'According to recent news, AI developments include...',
            }],
          }),
          { status: 200 }
        )
      );

      const result = await provider.search('latest AI news');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.summary).toBe('According to recent news, AI developments include...');
        expect(result.data.query).toBe('latest AI news');
        expect(result.data.provider).toBe('claude-web-search');
        expect(result.data.searchTimeMs).toBeDefined();
      }
    });

    it('concatenates multiple text blocks', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: [
              { type: 'text', text: 'First part. ' },
              { type: 'text', text: 'Second part.' },
            ],
          }),
          { status: 200 }
        )
      );

      const result = await provider.search('test');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.summary).toBe('First part. Second part.');
      }
    });

    it('handles empty content array', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ content: [] }),
          { status: 200 }
        )
      );

      const result = await provider.search('test');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.summary).toBe('No results found');
      }
    });

    it('skips non-text content blocks', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: [
              { type: 'tool_use', name: 'web_search' },
              { type: 'text', text: 'Actual text result' },
            ],
          }),
          { status: 200 }
        )
      );

      const result = await provider.search('test');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.summary).toBe('Actual text result');
      }
    });

    it('includes search time in result', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ content: [{ type: 'text', text: 'Results' }] }),
          { status: 200 }
        )
      );

      const result = await provider.search('test');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.searchTimeMs).toBe('number');
        expect(result.data.searchTimeMs).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ===========================================================================
  // SEARCH - ERROR HANDLING
  // ===========================================================================

  describe('search - error handling', () => {
    it('handles 401 auth errors', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { message: 'Invalid API key' } }),
          { status: 401 }
        )
      );

      const result = await provider.search('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('AUTH_ERROR');
        expect(result.error.statusCode).toBe(401);
      }
    });

    it('handles 429 rate limit errors', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { message: 'Rate limited' } }),
          { status: 429 }
        )
      );

      const result = await provider.search('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('RATE_LIMIT');
      }
    });

    it('handles 500 server errors', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { message: 'Internal error' } }),
          { status: 500 }
        )
      );

      const result = await provider.search('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SERVICE_ERROR');
      }
    });

    it('handles API error in response body', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { message: 'Model not available' },
          }),
          { status: 400 }
        )
      );

      const result = await provider.search('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Model not available');
      }
    });

    it('handles network errors', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);

      fetchSpy.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await provider.search('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NETWORK_ERROR');
        expect(result.error.message).toContain('Connection refused');
      }
    });

    it('handles timeout via AbortError', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);

      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      fetchSpy.mockRejectedValueOnce(abortError);

      const result = await provider.search('test', { timeout: 1 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('TIMEOUT');
        expect(result.error.message).toContain('timed out');
      }
    });

    it('uses custom timeout from options', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);

      fetchSpy.mockImplementationOnce(async (_, options) => {
        // Simulate long request that would be aborted
        const signal = (options as RequestInit).signal;
        expect(signal).toBeDefined();
        return new Response(
          JSON.stringify({ content: [{ type: 'text', text: 'OK' }] }),
          { status: 200 }
        );
      });

      await provider.search('test', { timeout: 120000 });

      expect(fetchSpy).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe('edge cases', () => {
    it('handles empty search query', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ content: [{ type: 'text', text: 'Results for empty query' }] }),
          { status: 200 }
        )
      );

      const result = await provider.search('');

      expect(fetchSpy).toHaveBeenCalled();
    });

    it('handles very long search query', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);
      const longQuery = 'a'.repeat(1000);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ content: [{ type: 'text', text: 'Results' }] }),
          { status: 200 }
        )
      );

      await provider.search(longQuery);

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);

      expect(body.messages[0].content).toContain(longQuery);
    });

    it('handles special characters in query', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);
      const specialQuery = 'what is <script> & "injection"?';

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ content: [{ type: 'text', text: 'Results' }] }),
          { status: 200 }
        )
      );

      await provider.search(specialQuery);

      const call = fetchSpy.mock.calls[0];
      const body = JSON.parse(call[1]?.body as string);

      expect(body.messages[0].content).toContain(specialQuery);
    });

    it('handles unicode in query', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);
      const unicodeQuery = 'What is Hello in Japanese?';

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ content: [{ type: 'text', text: 'Hello means hello' }] }),
          { status: 200 }
        )
      );

      await provider.search(unicodeQuery);

      expect(fetchSpy).toHaveBeenCalled();
    });

    it('handles response with null content', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ content: null }),
          { status: 200 }
        )
      );

      const result = await provider.search('test');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.summary).toBe('No results found');
      }
    });

    it('handles malformed response gracefully', async () => {
      const provider = ClaudeSearchProvider.fromCredentials(mockApiKey);

      fetchSpy.mockResolvedValueOnce(
        new Response('not json', { status: 200 })
      );

      const result = await provider.search('test');

      expect(result.success).toBe(false);
    });
  });
});
