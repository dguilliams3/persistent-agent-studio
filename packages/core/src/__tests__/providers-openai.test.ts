/**
 * @module @persistence/core/__tests__/providers-openai.test
 * @description Unit tests for OpenAI provider definition
 *
 * Tests cover:
 * - Provider metadata (name, API URL, env key)
 * - Model definitions (gpt-4o, gpt-4o-mini, gpt-5.2)
 * - getHeaders() function
 * - formatRequest() function (including reasoning bug workaround)
 * - parseResponse() function
 * - parseError() function
 * - countTokens() function (character-based estimation)
 *
 * @covers ../providers/openai.ts
 */

import { describe, it, expect, vi } from 'vitest';
import { openai } from '../providers/openai';
import type { FormatRequestOptions, SystemBlock } from '../providers/types';

// ============================================================================
// Provider Metadata
// ============================================================================

describe('openai provider metadata', () => {
  it('has correct name', () => {
    expect(openai.name).toBe('OpenAI');
  });

  it('has correct API URL', () => {
    expect(openai.api.baseUrl).toBe('https://api.openai.com/v1');
    expect(openai.api.url).toBe('/chat/completions');
  });

  it('does not have API version (OpenAI uses Bearer token)', () => {
    expect(openai.api.version).toBeUndefined();
  });

  it('has correct environment variable name', () => {
    expect(openai.envKeyName).toBe('OPENAI_API_KEY');
  });
});

// ============================================================================
// Model Definitions
// ============================================================================

describe('openai models', () => {
  it('has gpt-4o, gpt-4o-mini, and gpt-5.2 models', () => {
    expect(openai.models['gpt-4o']).toBeDefined();
    expect(openai.models['gpt-4o-mini']).toBeDefined();
    expect(openai.models['gpt-5.2']).toBeDefined();
  });

  describe('gpt-4o model', () => {
    const gpt4o = openai.models['gpt-4o'];

    it('has correct model ID', () => {
      expect(gpt4o.id).toBe('gpt-4o');
    });

    it('has correct display name', () => {
      expect(gpt4o.displayName).toBe('GPT-4o');
    });

    it('has 128K context window', () => {
      expect(gpt4o.contextWindow).toBe(128000);
    });

    it('has correct pricing', () => {
      expect(gpt4o.pricing.input).toBe(2.50);
      expect(gpt4o.pricing.output).toBe(10.00);
    });

    it('does not have cache pricing (OpenAI)', () => {
      expect(gpt4o.pricing.cacheRead).toBeUndefined();
      expect(gpt4o.pricing.cacheWrite).toBeUndefined();
    });

    it('has vision capability', () => {
      expect(gpt4o.capabilities.vision).toBe(true);
    });

    it('does not have reasoning capability', () => {
      expect(gpt4o.capabilities.reasoning).toBe(false);
    });
  });

  describe('gpt-4o-mini model', () => {
    const mini = openai.models['gpt-4o-mini'];

    it('is cheaper than gpt-4o', () => {
      expect(mini.pricing.input).toBeLessThan(openai.models['gpt-4o'].pricing.input);
      expect(mini.pricing.output).toBeLessThan(openai.models['gpt-4o'].pricing.output);
    });

    it('has correct pricing', () => {
      expect(mini.pricing.input).toBe(0.15);
      expect(mini.pricing.output).toBe(0.60);
    });
  });

  describe('gpt-5.2 model', () => {
    const gpt52 = openai.models['gpt-5.2'];

    it('has correct model ID', () => {
      expect(gpt52.id).toBe('gpt-5.2');
    });

    it('has 200K context window', () => {
      expect(gpt52.contextWindow).toBe(200000);
    });

    it('has reasoning capability', () => {
      expect(gpt52.capabilities.reasoning).toBe(true);
    });

    it('has reasoning overhead quirk', () => {
      expect(gpt52.quirks?.reasoningOverhead).toBe(2000);
    });

    it('uses max_completion_tokens parameter', () => {
      expect(gpt52.quirks?.tokenParamName).toBe('max_completion_tokens');
    });
  });
});

// ============================================================================
// getHeaders()
// ============================================================================

describe('openai.getHeaders()', () => {
  it('returns correct headers with Bearer token', () => {
    const headers = openai.getHeaders('sk-test-key');

    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Authorization']).toBe('Bearer sk-test-key');
  });

  it('does not include x-api-key (Anthropic style)', () => {
    const headers = openai.getHeaders('key');
    expect(headers['x-api-key']).toBeUndefined();
  });
});

// ============================================================================
// formatRequest()
// ============================================================================

describe('openai.formatRequest()', () => {
  const gpt4o = openai.models['gpt-4o'];
  const gpt52 = openai.models['gpt-5.2'];

  it('formats basic request correctly', () => {
    const opts: FormatRequestOptions = {
      model: gpt4o,
      system: 'You are a helpful assistant.',
      messages: [{ role: 'user', content: 'Hello!' }],
      maxTokens: 1000,
    };

    const request = openai.formatRequest(opts);

    expect(request.model).toBe('gpt-4o');
    expect(request.max_tokens).toBe(1000);

    // OpenAI format: system as first message
    const messages = request.messages as Array<{ role: string; content: string }>;
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toBe('You are a helpful assistant.');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toBe('Hello!');
  });

  it('converts system blocks to string', () => {
    const systemBlocks: SystemBlock[] = [
      { type: 'text', text: 'Part 1.' },
      { type: 'text', text: 'Part 2.' },
    ];

    const opts: FormatRequestOptions = {
      model: gpt4o,
      system: systemBlocks,
      messages: [],
      maxTokens: 500,
    };

    const request = openai.formatRequest(opts);
    const messages = request.messages as Array<{ role: string; content: string }>;

    expect(messages[0].content).toBe('Part 1.\n\nPart 2.');
  });

  it('uses max_completion_tokens for reasoning models', () => {
    const opts: FormatRequestOptions = {
      model: gpt52,
      system: 'Prompt',
      messages: [],
      maxTokens: 2000,
    };

    const request = openai.formatRequest(opts);

    expect(request.max_completion_tokens).toBeDefined();
    expect(request.max_tokens).toBeUndefined();
  });

  it('uses max_tokens for non-reasoning models', () => {
    const opts: FormatRequestOptions = {
      model: gpt4o,
      system: 'Prompt',
      messages: [],
      maxTokens: 2000,
    };

    const request = openai.formatRequest(opts);

    expect(request.max_tokens).toBe(2000);
    expect(request.max_completion_tokens).toBeUndefined();
  });

  describe('reasoning bug workaround', () => {
    it('adds overhead when reasoning=none on capable model', () => {
      // Suppress the console.log from the workaround
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const opts: FormatRequestOptions = {
        model: gpt52,
        system: 'Prompt',
        messages: [],
        maxTokens: 4000,
        reasoning: 'none',
      };

      const request = openai.formatRequest(opts);

      // 4000 + 2000 overhead = 6000
      expect(request.max_completion_tokens).toBe(6000);

      consoleSpy.mockRestore();
    });

    it('does not add overhead for non-reasoning models', () => {
      const opts: FormatRequestOptions = {
        model: gpt4o,
        system: 'Prompt',
        messages: [],
        maxTokens: 4000,
        reasoning: 'none',
      };

      const request = openai.formatRequest(opts);

      expect(request.max_tokens).toBe(4000); // No overhead
    });

    it('does not add overhead when reasoning is not none', () => {
      const opts: FormatRequestOptions = {
        model: gpt52,
        system: 'Prompt',
        messages: [],
        maxTokens: 4000,
        reasoning: 'medium',
      };

      const request = openai.formatRequest(opts);

      expect(request.max_completion_tokens).toBe(4000); // No overhead
    });
  });

  it('includes reasoning_effort for capable models', () => {
    const opts: FormatRequestOptions = {
      model: gpt52,
      system: 'Prompt',
      messages: [],
      maxTokens: 4000,
      reasoning: 'high',
    };

    const request = openai.formatRequest(opts);

    expect(request.reasoning_effort).toBe('high');
  });

  it('does not include reasoning_effort when undefined', () => {
    const opts: FormatRequestOptions = {
      model: gpt52,
      system: 'Prompt',
      messages: [],
      maxTokens: 4000,
    };

    const request = openai.formatRequest(opts);

    expect(request.reasoning_effort).toBeUndefined();
  });
});

// ============================================================================
// parseResponse()
// ============================================================================

describe('openai.parseResponse()', () => {
  it('parses successful response', () => {
    const rawResponse = {
      choices: [{
        message: { content: 'Hello! How can I help?' },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 20,
      },
    };

    const result = openai.parseResponse(rawResponse);

    expect(result.content).toBe('Hello! How can I help?');
    expect(result.usage.input).toBe(100);
    expect(result.usage.output).toBe(20);
    expect(result.finishReason).toBe('end_turn');
  });

  it('parses reasoning tokens', () => {
    // Suppress the console.log for reasoning tokens
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const rawResponse = {
      choices: [{ message: { content: 'Reasoned response' }, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: 150,
        completion_tokens: 50,
        completion_tokens_details: {
          reasoning_tokens: 30,
        },
      },
    };

    const result = openai.parseResponse(rawResponse);

    expect(result.usage.reasoning).toBe(30);

    consoleSpy.mockRestore();
  });

  it('handles finish_reason "length" as max_tokens', () => {
    const rawResponse = {
      choices: [{ message: { content: 'Truncated...' }, finish_reason: 'length' }],
      usage: { prompt_tokens: 50, completion_tokens: 100 },
    };

    const result = openai.parseResponse(rawResponse);

    expect(result.finishReason).toBe('max_tokens');
  });

  it('handles unknown finish_reason', () => {
    const rawResponse = {
      choices: [{ message: { content: 'Text' }, finish_reason: 'content_filter' }],
      usage: { prompt_tokens: 50, completion_tokens: 10 },
    };

    const result = openai.parseResponse(rawResponse);

    expect(result.finishReason).toBeUndefined();
  });

  it('throws on empty choices', () => {
    const rawResponse = {
      choices: [],
      usage: { prompt_tokens: 10, completion_tokens: 0 },
    };

    expect(() => openai.parseResponse(rawResponse))
      .toThrow('OpenAI returned empty content');
  });

  it('throws when message content missing', () => {
    const rawResponse = {
      choices: [{ message: {}, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 0 },
    };

    expect(() => openai.parseResponse(rawResponse))
      .toThrow('OpenAI returned empty content');
  });

  it('handles missing usage (returns 0)', () => {
    const rawResponse = {
      choices: [{ message: { content: 'Response' }, finish_reason: 'stop' }],
    };

    const result = openai.parseResponse(rawResponse);

    expect(result.usage.input).toBe(0);
    expect(result.usage.output).toBe(0);
  });
});

// ============================================================================
// parseError()
// ============================================================================

describe('openai.parseError()', () => {
  it('parses standard API error', () => {
    const rawError = {
      error: {
        code: 'invalid_api_key',
        message: 'Incorrect API key provided',
      },
      status: 401,
    };

    const error = openai.parseError!(rawError);

    expect(error.code).toBe('invalid_api_key');
    expect(error.message).toBe('Incorrect API key provided');
    expect(error.retryable).toBe(false);
  });

  it('marks rate limit errors as retryable', () => {
    const rawError = {
      error: {
        type: 'rate_limit_exceeded',
        message: 'Rate limit exceeded',
      },
      status: 429,
    };

    const error = openai.parseError!(rawError);

    expect(error.retryable).toBe(true);
  });

  it('uses code before type', () => {
    const rawError = {
      error: {
        code: 'specific_code',
        type: 'general_type',
        message: 'Error message',
      },
    };

    const error = openai.parseError!(rawError);

    expect(error.code).toBe('specific_code');
  });

  it('handles missing error details', () => {
    const rawError = {};

    const error = openai.parseError!(rawError);

    expect(error.code).toBe('unknown_error');
    expect(error.message).toBe('Unknown OpenAI error');
    expect(error.retryable).toBe(false);
  });
});

// ============================================================================
// countTokens() - Character-based estimation
// ============================================================================

describe('openai.countTokens()', () => {
  it('returns character-based estimation', async () => {
    const text = 'Hello, world!'; // 13 characters

    const result = await openai.countTokens(
      text,
      openai.models['gpt-4o'],
      'api-key'
    );

    // 13 chars / 4 chars per token = 3.25, ceil = 4
    expect(result.tokens).toBe(4);
    expect(result.precise).toBe(false);
  });

  it('handles longer text', async () => {
    const text = 'This is a longer piece of text that should result in more tokens.';
    // 65 characters / 4 = 16.25, ceil = 17

    const result = await openai.countTokens(
      text,
      openai.models['gpt-4o'],
      'key'
    );

    expect(result.tokens).toBe(17);
    expect(result.precise).toBe(false);
  });

  it('handles empty text', async () => {
    const result = await openai.countTokens(
      '',
      openai.models['gpt-4o'],
      'key'
    );

    expect(result.tokens).toBe(0);
  });

  it('handles null/undefined text', async () => {
    const result = await openai.countTokens(
      null as unknown as string,
      openai.models['gpt-4o'],
      'key'
    );

    expect(result.tokens).toBe(0);
  });

  it('does not make API calls', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');

    await openai.countTokens(
      'Test text',
      openai.models['gpt-4o'],
      'key'
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
