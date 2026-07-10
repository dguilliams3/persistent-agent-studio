/**
 * @module @persistence/core/__tests__/providers-types.test
 * @description Unit tests for provider type definitions
 *
 * Tests cover:
 * - ModelDefinition interface structure
 * - ProviderDefinition interface structure
 * - Message and ContentBlock types
 * - SystemBlock type
 * - FormatRequestOptions type
 * - ParsedResponse type
 * - ProviderError type
 * - TokenCount type
 *
 * @covers ../providers/types.ts
 */

import { describe, it, expect } from 'vitest';
import type {
  ModelDefinition,
  ProviderDefinition,
  Message,
  ContentBlock,
  SystemBlock,
  ReasoningEffort,
  FormatRequestOptions,
  ParsedResponse,
  ProviderError,
  TokenCount,
} from '../providers/types';

// ============================================================================
// ModelDefinition Interface
// ============================================================================

describe('ModelDefinition interface', () => {
  it('accepts complete model definition', () => {
    const model: ModelDefinition = {
      id: 'claude-sonnet-4-6-20250514',
      displayName: 'Claude 4.6 Sonnet',
      contextWindow: 200000,
      pricing: {
        input: 3.00,
        output: 15.00,
        cacheRead: 0.30,
        cacheWrite: 3.75,
      },
      capabilities: {
        vision: true,
        reasoning: false,
        streaming: true,
      },
    };

    expect(model.id).toBe('claude-sonnet-4-6-20250514');
    expect(model.pricing.input).toBe(3.00);
    expect(model.capabilities.vision).toBe(true);
  });

  it('accepts model with quirks', () => {
    const model: ModelDefinition = {
      id: 'gpt-5.2',
      displayName: 'GPT-5.2',
      contextWindow: 200000,
      pricing: {
        input: 2.50,
        output: 10.00,
      },
      capabilities: {
        vision: true,
        reasoning: true,
        streaming: true,
      },
      quirks: {
        reasoningOverhead: 2000,
        tokenParamName: 'max_completion_tokens',
      },
    };

    expect(model.quirks?.reasoningOverhead).toBe(2000);
    expect(model.quirks?.tokenParamName).toBe('max_completion_tokens');
  });

  it('accepts model without optional pricing fields', () => {
    const model: ModelDefinition = {
      id: 'gpt-4o-mini',
      displayName: 'GPT-4o Mini',
      contextWindow: 128000,
      pricing: {
        input: 0.15,
        output: 0.60,
        // No cacheRead or cacheWrite (OpenAI)
      },
      capabilities: {
        vision: true,
        reasoning: false,
        streaming: true,
      },
    };

    expect(model.pricing.cacheRead).toBeUndefined();
    expect(model.pricing.cacheWrite).toBeUndefined();
  });
});

// ============================================================================
// Message & ContentBlock Types
// ============================================================================

describe('Message interface', () => {
  it('accepts simple text message', () => {
    const message: Message = {
      role: 'user',
      content: 'Hello, Claude!',
    };

    expect(message.role).toBe('user');
    expect(message.content).toBe('Hello, Claude!');
  });

  it('accepts message with content blocks', () => {
    const textBlock: ContentBlock = {
      type: 'text',
      text: 'What is in this image?',
    };

    const imageBlock: ContentBlock = {
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: 'iVBORw0KGgo...',
      },
    };

    const message: Message = {
      role: 'user',
      content: [textBlock, imageBlock],
    };

    expect(Array.isArray(message.content)).toBe(true);
    expect((message.content as ContentBlock[])).toHaveLength(2);
  });

  it('accepts all valid roles', () => {
    const roles: Array<Message['role']> = ['user', 'assistant', 'system'];

    for (const role of roles) {
      const message: Message = { role, content: 'test' };
      expect(message.role).toBe(role);
    }
  });
});

describe('ContentBlock interface', () => {
  it('accepts text content block', () => {
    const block: ContentBlock = {
      type: 'text',
      text: 'Hello world',
    };

    expect(block.type).toBe('text');
    expect(block.text).toBe('Hello world');
  });

  it('accepts image content block', () => {
    const block: ContentBlock = {
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: 'base64data...',
      },
    };

    expect(block.type).toBe('image');
    expect(block.source?.type).toBe('base64');
    expect(block.source?.media_type).toBe('image/png');
  });
});

// ============================================================================
// SystemBlock Type
// ============================================================================

describe('SystemBlock interface', () => {
  it('accepts simple system block', () => {
    const block: SystemBlock = {
      type: 'text',
      text: 'You are a helpful assistant.',
    };

    expect(block.type).toBe('text');
    expect(block.cache_control).toBeUndefined();
  });

  it('accepts system block with cache control', () => {
    const block: SystemBlock = {
      type: 'text',
      text: 'Long system prompt that should be cached...',
      cache_control: { type: 'ephemeral' },
    };

    expect(block.cache_control?.type).toBe('ephemeral');
  });
});

// ============================================================================
// ReasoningEffort Type
// ============================================================================

describe('ReasoningEffort type', () => {
  it('accepts all valid reasoning effort values', () => {
    const efforts: ReasoningEffort[] = ['none', 'low', 'medium', 'high'];

    expect(efforts).toContain('none');
    expect(efforts).toContain('low');
    expect(efforts).toContain('medium');
    expect(efforts).toContain('high');
  });
});

// ============================================================================
// FormatRequestOptions Type
// ============================================================================

describe('FormatRequestOptions interface', () => {
  const mockModel: ModelDefinition = {
    id: 'test-model',
    displayName: 'Test Model',
    contextWindow: 100000,
    pricing: { input: 1, output: 2 },
    capabilities: { vision: false, reasoning: false, streaming: true },
  };

  it('accepts minimal options', () => {
    const opts: FormatRequestOptions = {
      model: mockModel,
      system: 'You are helpful.',
      messages: [{ role: 'user', content: 'Hi' }],
      maxTokens: 1000,
    };

    expect(opts.model.id).toBe('test-model');
    expect(opts.reasoning).toBeUndefined();
  });

  it('accepts options with system blocks', () => {
    const opts: FormatRequestOptions = {
      model: mockModel,
      system: [
        { type: 'text', text: 'Part 1' },
        { type: 'text', text: 'Part 2', cache_control: { type: 'ephemeral' } },
      ],
      messages: [],
      maxTokens: 2000,
    };

    expect(Array.isArray(opts.system)).toBe(true);
    expect((opts.system as SystemBlock[])).toHaveLength(2);
  });

  it('accepts options with reasoning', () => {
    const opts: FormatRequestOptions = {
      model: mockModel,
      system: 'You are a reasoning model.',
      messages: [],
      maxTokens: 4000,
      reasoning: 'medium',
    };

    expect(opts.reasoning).toBe('medium');
  });
});

// ============================================================================
// ParsedResponse Type
// ============================================================================

describe('ParsedResponse interface', () => {
  it('accepts minimal response', () => {
    const response: ParsedResponse = {
      content: 'Hello! How can I help?',
      usage: {
        input: 100,
        output: 20,
      },
    };

    expect(response.content).toBe('Hello! How can I help?');
    expect(response.usage.input).toBe(100);
    expect(response.finishReason).toBeUndefined();
  });

  it('accepts response with all usage fields', () => {
    const response: ParsedResponse = {
      content: 'Response text',
      usage: {
        input: 1000,
        output: 500,
        cacheRead: 800,
        cacheWrite: 200,
        reasoning: 100,
      },
      finishReason: 'end_turn',
    };

    expect(response.usage.cacheRead).toBe(800);
    expect(response.usage.cacheWrite).toBe(200);
    expect(response.usage.reasoning).toBe(100);
    expect(response.finishReason).toBe('end_turn');
  });

  it('accepts all finish reasons', () => {
    const reasons: Array<ParsedResponse['finishReason']> = [
      'end_turn',
      'max_tokens',
      'stop_sequence',
      'length',
      undefined,
    ];

    for (const reason of reasons) {
      const response: ParsedResponse = {
        content: 'test',
        usage: { input: 0, output: 0 },
        finishReason: reason,
      };
      expect(response.finishReason).toBe(reason);
    }
  });
});

// ============================================================================
// ProviderError Type
// ============================================================================

describe('ProviderError interface', () => {
  it('accepts minimal error', () => {
    const error: ProviderError = {
      code: 'rate_limit_exceeded',
      message: 'Too many requests',
      retryable: true,
    };

    expect(error.code).toBe('rate_limit_exceeded');
    expect(error.retryable).toBe(true);
    expect(error.statusCode).toBeUndefined();
  });

  it('accepts error with status code', () => {
    const error: ProviderError = {
      code: 'invalid_api_key',
      message: 'Invalid API key provided',
      retryable: false,
      statusCode: 401,
    };

    expect(error.statusCode).toBe(401);
    expect(error.retryable).toBe(false);
  });
});

// ============================================================================
// TokenCount Type
// ============================================================================

describe('TokenCount interface', () => {
  it('accepts precise count', () => {
    const count: TokenCount = {
      tokens: 1234,
      precise: true,
    };

    expect(count.tokens).toBe(1234);
    expect(count.precise).toBe(true);
  });

  it('accepts estimated count', () => {
    const count: TokenCount = {
      tokens: 1500,
      precise: false,
    };

    expect(count.tokens).toBe(1500);
    expect(count.precise).toBe(false);
  });
});

// ============================================================================
// ProviderDefinition Interface (Structure)
// ============================================================================

describe('ProviderDefinition interface structure', () => {
  // Note: We test the interface structure here; actual provider implementations
  // are tested in separate files (anthropic.test.ts, openai.test.ts)

  it('requires all expected properties', () => {
    // This is a compile-time check - the interface requires these fields
    const mockProvider: ProviderDefinition = {
      name: 'Mock Provider',
      api: {
        url: 'https://api.mock.com/v1/messages',
        version: '2024-01-01',
      },
      envKeyName: 'MOCK_API_KEY',
      models: {
        'test-model': {
          id: 'test-model-id',
          displayName: 'Test Model',
          contextWindow: 100000,
          pricing: { input: 1, output: 2 },
          capabilities: { vision: false, reasoning: false, streaming: true },
        },
      },
      getHeaders: (apiKey) => ({ 'x-api-key': apiKey }),
      formatRequest: () => ({}),
      parseResponse: () => ({
        content: 'test',
        usage: { input: 0, output: 0 },
      }),
      countTokens: async () => ({ tokens: 0, precise: false }),
    };

    expect(mockProvider.name).toBe('Mock Provider');
    expect(mockProvider.api.url).toBe('https://api.mock.com/v1/messages');
    expect(Object.keys(mockProvider.models)).toContain('test-model');
    expect(typeof mockProvider.getHeaders).toBe('function');
    expect(typeof mockProvider.formatRequest).toBe('function');
    expect(typeof mockProvider.parseResponse).toBe('function');
    expect(typeof mockProvider.countTokens).toBe('function');
  });

  it('parseError is optional', () => {
    const minimalProvider: ProviderDefinition = {
      name: 'Minimal',
      api: { url: 'https://api.minimal.com' },
      envKeyName: 'MINIMAL_KEY',
      models: {},
      getHeaders: () => ({}),
      formatRequest: () => ({}),
      parseResponse: () => ({ content: '', usage: { input: 0, output: 0 } }),
      countTokens: async () => ({ tokens: 0, precise: false }),
    };

    expect(minimalProvider.parseError).toBeUndefined();
  });
});
