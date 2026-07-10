/**
 * @module @persistence/core/__tests__/providers-index.test
 * @description Unit tests for provider registry and exports
 *
 * Tests cover:
 * - PROVIDERS registry structure
 * - Re-exports from anthropic and openai modules
 * - Type exports (ProviderName, ModelName)
 * - Resolution function exports
 *
 * @covers ../providers/index.ts
 */

import { describe, it, expect } from 'vitest';
import {
  PROVIDERS,
  anthropic,
  deepseek,
  kimi,
  openai,
  getProviderAvailabilityMap,
  resolveProvider,
  resolveModel,
  resolveProviderModel,
  isValidProviderModel,
  getAllProviderModels,
} from '../providers/index';
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
  ProviderName,
  ModelName,
} from '../providers/index';

// ============================================================================
// PROVIDERS Registry
// ============================================================================

describe('PROVIDERS registry', () => {
  it('contains anthropic provider', () => {
    expect(PROVIDERS.anthropic).toBeDefined();
    expect(PROVIDERS.anthropic.name).toBe('Anthropic');
  });

  it('contains openai provider', () => {
    expect(PROVIDERS.openai).toBeDefined();
    expect(PROVIDERS.openai.name).toBe('OpenAI');
  });

  it('contains deepseek provider', () => {
    expect(PROVIDERS.deepseek).toBeDefined();
    expect(PROVIDERS.deepseek.name).toBe('DeepSeek');
  });

  it('contains kimi provider', () => {
    expect(PROVIDERS.kimi).toBeDefined();
    expect(PROVIDERS.kimi.name).toBe('Kimi');
  });

  it('is readonly (const assertion)', () => {
    // This is a compile-time check - PROVIDERS is typed as const
    expect(Object.keys(PROVIDERS)).toEqual(['anthropic', 'openai', 'deepseek', 'kimi']);
  });

  it('allows direct model access', () => {
    expect(PROVIDERS.anthropic.models.opus.id).toBe('claude-opus-4-6');
    expect(PROVIDERS.openai.models['gpt-4o'].id).toBe('gpt-4o');
  });
});

// ============================================================================
// Re-exports: Provider Implementations
// ============================================================================

describe('provider re-exports', () => {
  it('exports anthropic provider directly', () => {
    expect(anthropic).toBeDefined();
    expect(anthropic.name).toBe('Anthropic');
    expect(anthropic).toBe(PROVIDERS.anthropic);
  });

  it('exports openai provider directly', () => {
    expect(openai).toBeDefined();
    expect(openai.name).toBe('OpenAI');
    expect(openai).toBe(PROVIDERS.openai);
  });

  it('exports deepseek provider directly', () => {
    expect(deepseek).toBeDefined();
    expect(deepseek.name).toBe('DeepSeek');
    expect(deepseek).toBe(PROVIDERS.deepseek);
  });

  it('exports kimi provider directly', () => {
    expect(kimi).toBeDefined();
    expect(kimi.name).toBe('Kimi');
    expect(kimi).toBe(PROVIDERS.kimi);
  });
});

// ============================================================================
// Re-exports: Resolution Functions
// ============================================================================

describe('resolution function re-exports', () => {
  it('exports resolveProvider', () => {
    expect(resolveProvider).toBeDefined();
    expect(typeof resolveProvider).toBe('function');
    expect(resolveProvider('anthropic').name).toBe('Anthropic');
  });

  it('exports resolveModel', () => {
    expect(resolveModel).toBeDefined();
    expect(typeof resolveModel).toBe('function');
    expect(resolveModel(anthropic, 'sonnet').id).toBe('claude-sonnet-4-6-20250514');
  });

  it('exports resolveProviderModel', () => {
    expect(resolveProviderModel).toBeDefined();
    expect(typeof resolveProviderModel).toBe('function');
    const { provider, model } = resolveProviderModel('anthropic/opus');
    expect(provider.name).toBe('Anthropic');
    expect(model.id).toBe('claude-opus-4-6');
  });

  it('exports isValidProviderModel', () => {
    expect(isValidProviderModel).toBeDefined();
    expect(typeof isValidProviderModel).toBe('function');
    expect(isValidProviderModel('anthropic/sonnet')).toBe(true);
    expect(isValidProviderModel('invalid')).toBe(false);
  });

  it('exports getAllProviderModels', () => {
    expect(getAllProviderModels).toBeDefined();
    expect(typeof getAllProviderModels).toBe('function');
    const all = getAllProviderModels();
    expect(all).toContain('anthropic/haiku');
    expect(all).toContain('openai/gpt-4o');
    expect(all).toContain('deepseek/deepseek-chat');
    expect(all).toContain('kimi/kimi-k2.6');
  });

  it('exports getProviderAvailabilityMap', () => {
    expect(getProviderAvailabilityMap).toBeDefined();
    const status = getProviderAvailabilityMap((envKeyName) =>
      envKeyName === 'OPENAI_API_KEY' ? 'present' : '',
    );
    expect(status.openai.available).toBe(true);
    expect(status.deepseek.available).toBe(false);
  });
});

// ============================================================================
// Type Exports (Compile-time verification)
// ============================================================================

describe('type exports', () => {
  // These tests verify that types are properly exported and usable
  // If compilation succeeds, the types are correctly exported

  it('ModelDefinition is usable', () => {
    const model: ModelDefinition = PROVIDERS.anthropic.models.sonnet;
    expect(model.id).toBeDefined();
  });

  it('ProviderDefinition is usable', () => {
    const provider: ProviderDefinition = PROVIDERS.anthropic;
    expect(provider.name).toBeDefined();
  });

  it('Message is usable', () => {
    const msg: Message = { role: 'user', content: 'Hello' };
    expect(msg.role).toBe('user');
  });

  it('ContentBlock is usable', () => {
    const block: ContentBlock = { type: 'text', text: 'Hello' };
    expect(block.type).toBe('text');
  });

  it('SystemBlock is usable', () => {
    const block: SystemBlock = { type: 'text', text: 'System' };
    expect(block.type).toBe('text');
  });

  it('ReasoningEffort is usable', () => {
    const effort: ReasoningEffort = 'medium';
    expect(effort).toBe('medium');
  });

  it('FormatRequestOptions is usable', () => {
    const opts: FormatRequestOptions = {
      model: PROVIDERS.anthropic.models.sonnet,
      system: 'System',
      messages: [],
      maxTokens: 1000,
    };
    expect(opts.maxTokens).toBe(1000);
  });

  it('ParsedResponse is usable', () => {
    const response: ParsedResponse = {
      content: 'Hello',
      usage: { input: 10, output: 5 },
    };
    expect(response.content).toBe('Hello');
  });

  it('ProviderError is usable', () => {
    const error: ProviderError = {
      code: 'rate_limit',
      message: 'Rate limited',
      retryable: true,
    };
    expect(error.retryable).toBe(true);
  });

  it('TokenCount is usable', () => {
    const count: TokenCount = { tokens: 100, precise: true };
    expect(count.precise).toBe(true);
  });
});

// ============================================================================
// ProviderName and ModelName Types
// ============================================================================

describe('ProviderName type', () => {
  it('allows valid provider names', () => {
    const name1: ProviderName = 'anthropic';
    const name2: ProviderName = 'openai';

    expect(name1).toBe('anthropic');
    expect(name2).toBe('openai');
  });
});

describe('ModelName type', () => {
  it('allows valid Anthropic model names', () => {
    const haiku: ModelName<'anthropic'> = 'haiku';
    const sonnet: ModelName<'anthropic'> = 'sonnet';
    const opus: ModelName<'anthropic'> = 'opus';

    expect(haiku).toBe('haiku');
    expect(sonnet).toBe('sonnet');
    expect(opus).toBe('opus');
  });

  it('allows valid OpenAI model names', () => {
    const gpt4o: ModelName<'openai'> = 'gpt-4o';
    const mini: ModelName<'openai'> = 'gpt-4o-mini';
    const gpt52: ModelName<'openai'> = 'gpt-5.2';

    expect(gpt4o).toBe('gpt-4o');
    expect(mini).toBe('gpt-4o-mini');
    expect(gpt52).toBe('gpt-5.2');
  });
});

// ============================================================================
// Integration
// ============================================================================

describe('provider module integration', () => {
  it('can build complete API request', () => {
    const provider = PROVIDERS.anthropic;
    const model = provider.models.sonnet;

    const headers = provider.getHeaders('sk-test-key');
    const request = provider.formatRequest({
      model,
      system: 'You are helpful.',
      messages: [{ role: 'user', content: 'Hi' }],
      maxTokens: 1000,
    });

    expect(headers['x-api-key']).toBe('sk-test-key');
    expect(request.model).toBe('claude-sonnet-4-6-20250514');
    expect(request.max_tokens).toBe(1000);
  });

  it('can parse mock response', () => {
    const provider = PROVIDERS.anthropic;

    const mockResponse = {
      content: [{ type: 'text', text: 'Hello!' }],
      usage: { input_tokens: 50, output_tokens: 10 },
      stop_reason: 'end_turn',
    };

    const parsed = provider.parseResponse(mockResponse);

    expect(parsed.content).toBe('Hello!');
    expect(parsed.usage.input).toBe(50);
    expect(parsed.usage.output).toBe(10);
  });
});
