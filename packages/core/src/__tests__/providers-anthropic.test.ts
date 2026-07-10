/**
 * @module @persistence/core/__tests__/providers-anthropic.test
 * @description Unit tests for Anthropic provider definition
 *
 * Tests cover:
 * - Provider metadata (name, API URL, env key)
 * - Model definitions (haiku, sonnet, opus)
 * - getHeaders() function
 * - formatRequest() function
 * - parseResponse() function
 * - parseError() function
 * - countTokens() function (mocked)
 *
 * @covers ../providers/anthropic.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { anthropic } from '../providers/anthropic';
import type { FormatRequestOptions, SystemBlock } from '../providers/types';

// ============================================================================
// Provider Metadata
// ============================================================================

describe('anthropic provider metadata', () => {
  it('has correct name', () => {
    expect(anthropic.name).toBe('Anthropic');
  });

  it('has correct API URL', () => {
    expect(anthropic.api.url).toBe('https://api.anthropic.com/v1/messages');
  });

  it('has API version', () => {
    expect(anthropic.api.version).toBe('2023-06-01');
  });

  it('has correct environment variable name', () => {
    expect(anthropic.envKeyName).toBe('ANTHROPIC_API_KEY');
  });
});

// ============================================================================
// Model Definitions
// ============================================================================

describe('anthropic models', () => {
  it('has haiku, sonnet, and opus models', () => {
    expect(anthropic.models.haiku).toBeDefined();
    expect(anthropic.models.sonnet).toBeDefined();
    expect(anthropic.models.opus).toBeDefined();
  });

  describe('haiku model', () => {
    const haiku = anthropic.models.haiku;

    it('has correct model ID', () => {
      expect(haiku.id).toBe('claude-haiku-4-5-20250514');
    });

    it('has correct display name', () => {
      expect(haiku.displayName).toBe('Claude 4.5 Haiku');
    });

    it('has 200K context window', () => {
      expect(haiku.contextWindow).toBe(200000);
    });

    it('has correct pricing', () => {
      expect(haiku.pricing.input).toBe(0.80);
      expect(haiku.pricing.output).toBe(4.00);
      expect(haiku.pricing.cacheRead).toBe(0.08);
      expect(haiku.pricing.cacheWrite).toBe(1.00);
    });

    it('has vision capability', () => {
      expect(haiku.capabilities.vision).toBe(true);
    });

    it('does not have reasoning capability', () => {
      expect(haiku.capabilities.reasoning).toBe(false);
    });

    it('has streaming capability', () => {
      expect(haiku.capabilities.streaming).toBe(true);
    });
  });

  describe('sonnet model', () => {
    const sonnet = anthropic.models.sonnet;

    it('has correct model ID', () => {
      expect(sonnet.id).toBe('claude-sonnet-4-6-20250514');
    });

    it('has correct display name', () => {
      expect(sonnet.displayName).toBe('Claude 4.6 Sonnet');
    });

    it('has correct pricing (more expensive than haiku)', () => {
      expect(sonnet.pricing.input).toBe(3.00);
      expect(sonnet.pricing.output).toBe(15.00);
      expect(sonnet.pricing.input).toBeGreaterThan(anthropic.models.haiku.pricing.input);
    });
  });

  describe('opus model', () => {
    const opus = anthropic.models.opus;

    it('has correct model ID', () => {
      expect(opus.id).toBe('claude-opus-4-6');
    });

    it('has correct display name', () => {
      expect(opus.displayName).toBe('Claude 4.6 Opus');
    });

    it('is the most expensive', () => {
      expect(opus.pricing.input).toBeGreaterThan(anthropic.models.sonnet.pricing.input);
      expect(opus.pricing.output).toBeGreaterThan(anthropic.models.sonnet.pricing.output);
    });

    it('has correct pricing', () => {
      expect(opus.pricing.input).toBe(5.00);
      expect(opus.pricing.output).toBe(25.00);
      expect(opus.pricing.cacheRead).toBe(0.50);
      expect(opus.pricing.cacheWrite).toBe(6.25);
    });
  });
});

// ============================================================================
// getHeaders()
// ============================================================================

describe('anthropic.getHeaders()', () => {
  it('returns correct headers', () => {
    const headers = anthropic.getHeaders('test-api-key');

    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['x-api-key']).toBe('test-api-key');
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('uses provided API key', () => {
    const headers = anthropic.getHeaders('sk-ant-api123');
    expect(headers['x-api-key']).toBe('sk-ant-api123');
  });
});

// ============================================================================
// formatRequest()
// ============================================================================

describe('anthropic.formatRequest()', () => {
  const sonnet = anthropic.models.sonnet;

  it('formats basic request correctly', () => {
    const opts: FormatRequestOptions = {
      model: sonnet,
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'Hello!' }],
      maxTokens: 1000,
    };

    const request = anthropic.formatRequest(opts);

    expect(request.model).toBe('claude-sonnet-4-6-20250514');
    expect(request.max_tokens).toBe(1000);
    expect(request.system).toBe('You are a helpful assistant.');
    expect(request.messages).toEqual([{ role: 'user', content: 'Hello!' }]);
  });

  it('passes through system blocks for caching', () => {
    const systemBlocks: SystemBlock[] = [
      { type: 'text', text: 'Part 1' },
      { type: 'text', text: 'Part 2', cache_control: { type: 'ephemeral' } },
    ];

    const opts: FormatRequestOptions = {
      model: sonnet,
      system: systemBlocks,
      messages: [],
      maxTokens: 500,
    };

    const request = anthropic.formatRequest(opts);

    expect(request.system).toEqual(systemBlocks);
  });

  it('includes multiple messages', () => {
    const opts: FormatRequestOptions = {
      model: sonnet,
      system: 'System prompt',
      messages: [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'First response' },
        { role: 'user', content: 'Second message' },
      ],
      maxTokens: 2000,
    };

    const request = anthropic.formatRequest(opts);

    expect((request.messages as unknown[]).length).toBe(3);
  });

  it('ignores reasoning parameter (not supported by Anthropic)', () => {
    const opts: FormatRequestOptions = {
      model: sonnet,
      system: 'Prompt',
      messages: [],
      maxTokens: 1000,
      reasoning: 'high', // Should be ignored
    };

    const request = anthropic.formatRequest(opts);

    expect(request.reasoning_effort).toBeUndefined();
    expect((request as Record<string, unknown>).reasoning).toBeUndefined();
  });
});

// ============================================================================
// parseResponse()
// ============================================================================

describe('anthropic.parseResponse()', () => {
  it('parses successful response', () => {
    const rawResponse = {
      content: [{ type: 'text', text: 'Hello! How can I help?' }],
      usage: {
        input_tokens: 100,
        output_tokens: 20,
      },
      stop_reason: 'end_turn',
    };

    const result = anthropic.parseResponse(rawResponse);

    expect(result.content).toBe('Hello! How can I help?');
    expect(result.usage.input).toBe(100);
    expect(result.usage.output).toBe(20);
    expect(result.finishReason).toBe('end_turn');
  });

  it('parses cache token usage', () => {
    const rawResponse = {
      content: [{ type: 'text', text: 'Cached response' }],
      usage: {
        input_tokens: 150,
        output_tokens: 30,
        cache_read_input_tokens: 120,
        cache_creation_input_tokens: 30,
      },
      stop_reason: 'end_turn',
    };

    const result = anthropic.parseResponse(rawResponse);

    expect(result.usage.cacheRead).toBe(120);
    expect(result.usage.cacheWrite).toBe(30);
  });

  it('handles missing cache tokens', () => {
    const rawResponse = {
      content: [{ type: 'text', text: 'Response' }],
      usage: {
        input_tokens: 50,
        output_tokens: 10,
      },
    };

    const result = anthropic.parseResponse(rawResponse);

    expect(result.usage.cacheRead).toBeUndefined();
    expect(result.usage.cacheWrite).toBeUndefined();
  });

  it('handles missing usage (returns 0)', () => {
    const rawResponse = {
      content: [{ type: 'text', text: 'Response' }],
    };

    const result = anthropic.parseResponse(rawResponse);

    expect(result.usage.input).toBe(0);
    expect(result.usage.output).toBe(0);
  });

  it('throws on empty content', () => {
    const rawResponse = {
      content: [],
      usage: { input_tokens: 10, output_tokens: 0 },
    };

    expect(() => anthropic.parseResponse(rawResponse))
      .toThrow('Anthropic returned empty content');
  });

  it('throws when text block missing', () => {
    const rawResponse = {
      content: [{ type: 'tool_use', id: '123' }], // No text block
      usage: { input_tokens: 10, output_tokens: 10 },
    };

    expect(() => anthropic.parseResponse(rawResponse))
      .toThrow('Anthropic returned empty content');
  });

  it('handles non-end_turn stop reasons', () => {
    const rawResponse = {
      content: [{ type: 'text', text: 'Partial response...' }],
      usage: { input_tokens: 50, output_tokens: 100 },
      stop_reason: 'max_tokens',
    };

    const result = anthropic.parseResponse(rawResponse);

    expect(result.finishReason).toBeUndefined(); // Only 'end_turn' is mapped
  });
});

// ============================================================================
// parseError()
// ============================================================================

describe('anthropic.parseError()', () => {
  it('parses standard API error', () => {
    const rawError = {
      error: {
        type: 'invalid_api_key',
        message: 'Your API key is invalid',
      },
      status: 401,
    };

    const error = anthropic.parseError!(rawError);

    expect(error.code).toBe('invalid_api_key');
    expect(error.message).toBe('Your API key is invalid');
    expect(error.retryable).toBe(false);
  });

  it('marks rate limit errors as retryable', () => {
    const rawError = {
      error: {
        type: 'rate_limit_error',
        message: 'Rate limit exceeded',
      },
      status: 429,
    };

    const error = anthropic.parseError!(rawError);

    expect(error.retryable).toBe(true);
  });

  it('marks overload errors as retryable', () => {
    const rawError = {
      error: {
        type: 'overloaded_error',
        message: 'The API is temporarily overloaded',
      },
      status: 529,
    };

    const error = anthropic.parseError!(rawError);

    expect(error.retryable).toBe(true);
  });

  it('handles missing error details', () => {
    const rawError = {};

    const error = anthropic.parseError!(rawError);

    expect(error.code).toBe('unknown_error');
    expect(error.message).toBe('Unknown Anthropic error');
    expect(error.retryable).toBe(false);
  });

  // Note: The implementation expects an object input. Null/undefined
  // handling is not implemented as API errors always return an object.
});

// ============================================================================
// countTokens() - with mocked fetch
// ============================================================================

describe('anthropic.countTokens()', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls Anthropic token counting API', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ input_tokens: 42 }),
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await anthropic.countTokens(
      'Hello world',
      anthropic.models.sonnet,
      'test-api-key'
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages/count_tokens',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-api-key': 'test-api-key',
          'anthropic-version': '2023-06-01',
        }),
      })
    );

    expect(result.tokens).toBe(42);
    expect(result.precise).toBe(true);
  });

  it('includes model ID in request body', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ input_tokens: 100 }),
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    await anthropic.countTokens(
      'Test text',
      anthropic.models.opus,
      'key'
    );

    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);

    expect(body.model).toBe('claude-opus-4-6');
    expect(body.messages).toEqual([{ role: 'user', content: 'Test text' }]);
  });

  it('throws on API error', async () => {
    const mockResponse = {
      ok: false,
      json: vi.fn().mockResolvedValue({
        error: { message: 'Invalid request' },
      }),
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    await expect(anthropic.countTokens(
      'Test',
      anthropic.models.sonnet,
      'bad-key'
    )).rejects.toThrow('Token counting failed: Invalid request');
  });

  it('returns 0 for missing token count', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({}), // No input_tokens
    };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await anthropic.countTokens(
      'Test',
      anthropic.models.sonnet,
      'key'
    );

    expect(result.tokens).toBe(0);
    expect(result.precise).toBe(true);
  });
});
