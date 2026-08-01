/**
 * @module @persistence/llm/__tests__/callable
 * @description Unit tests for LLM factory functions
 *
 * Tests cover:
 * - createCallableModel() returns CallableModel with sync/batch methods
 * - createCallableModel() correctly binds provider and model
 * - createCallableModel() accesses .definition property
 * - createCallableProvider() returns CallableProvider with batch utilities
 * - createCallableProvider() has checkBatch, fetchResults, cancelBatch
 * - createLLM() returns fully-wired LLM interface
 * - createLLM() creates anthropic provider with opus, sonnet, haiku
 * - createLLM() creates openai provider with gpt-4o, gpt-4o-mini, gpt-5.2
 * - Type safety: Anthropic models enforce AnthropicCallParams
 * - Type safety: OpenAI models enforce OpenAICallParams
 * - SecretsProvider integration for API key retrieval
 *
 * @covers ../callable.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { expectTypeOf } from 'vitest';
import {
  createCallableModel,
  createCallableProvider,
  createLLM,
} from '../callable';
import type {
  CallableModel,
  CallableProvider,
  AnthropicCallParams,
  OpenAICallParams,
  LLM,
} from '../types';
import type { SecretsProvider } from '@persistence/core';
import type { ProviderDefinition, ModelDefinition } from '@persistence/core/providers';
import { anthropic, openai } from '@persistence/core/providers';

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock RequestEngine as a proper class constructor
vi.mock('../engine/index.js', () => {
  class MockRequestEngine {
    execute = vi.fn().mockResolvedValue({
      content: 'Mock response',
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      },
      cost: 0.005,
      metadata: {
        provider: 'Test',
        model: 'test-model',
        finishReason: 'end_turn',
        latencyMs: 150,
      },
    });
    submitBatch = vi.fn().mockResolvedValue({
      batchId: 'batch_test123',
      customId: 'custom-001',
      status: 'validating',
      provider: 'Test',
      model: 'test-model',
    });
    checkBatchStatus = vi.fn().mockResolvedValue({
      status: 'pending',
      batchId: 'batch_test123',
    });
    fetchBatchResults = vi.fn().mockResolvedValue([
      {
        customId: 'custom-001',
        response: {
          content: 'Batch response',
          usage: { inputTokens: 100, outputTokens: 50 },
          cost: 0.0025,
        },
      },
    ]);
  }
  return { RequestEngine: MockRequestEngine };
});

// Mock core providers to ensure stable test data
vi.mock('@persistence/core/providers', () => ({
  anthropic: {
    name: 'Anthropic',
    envKeyName: 'ANTHROPIC_API_KEY',
    api: {
      url: 'https://api.anthropic.com/v1/messages',
      version: '2023-06-01',
    },
    models: {
      opus: {
        id: 'claude-opus-4',
        displayName: 'Claude Opus',
        contextWindow: 200000,
        pricing: { input: 5.0, output: 15.0, cacheRead: 0.5, cacheWrite: 6.25 },
        capabilities: { vision: true, reasoning: false, streaming: true },
      },
      sonnet: {
        id: 'claude-sonnet-4',
        displayName: 'Claude Sonnet',
        contextWindow: 200000,
        pricing: { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
        capabilities: { vision: true, reasoning: false, streaming: true },
      },
      haiku: {
        id: 'claude-haiku-3',
        displayName: 'Claude Haiku',
        contextWindow: 200000,
        pricing: { input: 0.8, output: 4.0, cacheRead: 0.08, cacheWrite: 1.0 },
        capabilities: { vision: true, reasoning: false, streaming: true },
      },
    },
    getHeaders: vi.fn((key: string) => ({
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    })),
    formatRequest: vi.fn((opts: any) => ({
      model: opts.model.id,
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: opts.messages,
    })),
    parseResponse: vi.fn((data: any) => ({
      content: data.content?.[0]?.text ?? '',
      usage: {
        input: data.usage?.input_tokens ?? 0,
        output: data.usage?.output_tokens ?? 0,
        cacheRead: data.usage?.cache_read_input_tokens,
        cacheWrite: data.usage?.cache_creation_input_tokens,
      },
      finishReason: data.stop_reason,
    })),
    parseError: vi.fn((error: any) => ({
      code: 'anthropic_error',
      message: error.error?.message ?? 'Anthropic API error',
      retryable: false,
    })),
  } as unknown as ProviderDefinition,
  openai: {
    name: 'OpenAI',
    envKeyName: 'OPENAI_API_KEY',
    api: {
      url: 'https://api.openai.com/v1/chat/completions',
      version: 'v1',
    },
    models: {
      'gpt-4o': {
        id: 'gpt-4o',
        displayName: 'GPT-4o',
        contextWindow: 128000,
        pricing: { input: 2.5, output: 10.0, cacheRead: 0.25, cacheWrite: 5.0 },
        capabilities: { vision: true, reasoning: false, streaming: true },
      },
      'gpt-4o-mini': {
        id: 'gpt-4o-mini',
        displayName: 'GPT-4o Mini',
        contextWindow: 128000,
        pricing: { input: 0.15, output: 0.6, cacheRead: 0.015, cacheWrite: 0.3 },
        capabilities: { vision: true, reasoning: false, streaming: true },
      },
      'gpt-5.2': {
        id: 'gpt-5.2',
        displayName: 'GPT-5.2',
        contextWindow: 128000,
        pricing: { input: 5.0, output: 20.0, cacheRead: 0.5, cacheWrite: 10.0 },
        capabilities: { vision: true, reasoning: true, streaming: true },
      },
    },
    getHeaders: vi.fn((key: string) => ({
      'authorization': `Bearer ${key}`,
      'openai-version': 'v1',
    })),
    formatRequest: vi.fn((opts: any) => ({
      model: opts.model.id,
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: opts.messages,
    })),
    parseResponse: vi.fn((data: any) => ({
      content: data.choices?.[0]?.message?.content ?? '',
      usage: {
        input: data.usage?.prompt_tokens ?? 0,
        output: data.usage?.completion_tokens ?? 0,
        cacheRead: data.usage?.prompt_tokens_details?.cached_tokens,
        cacheWrite: undefined,
      },
      finishReason: data.choices?.[0]?.finish_reason,
    })),
    parseError: vi.fn((error: any) => ({
      code: 'openai_error',
      message: error.error?.message ?? 'OpenAI API error',
      retryable: false,
    })),
  } as unknown as ProviderDefinition,
}));

// Create mock SecretsProvider
const createMockSecrets = (keys: Record<string, string> = {}): SecretsProvider => ({
  get: vi.fn(async (key: string) => keys[key] ?? ''),
});

// =============================================================================
// createCallableModel() TESTS
// =============================================================================

describe('createCallableModel()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates CallableModel with sync and batch methods', () => {
    const model = createCallableModel<AnthropicCallParams>(
      anthropic,
      anthropic.models.opus,
      'test-key'
    );

    expect(model).toHaveProperty('sync');
    expect(model).toHaveProperty('batch');
    expect(typeof model.sync).toBe('function');
    expect(typeof model.batch).toBe('function');
  });

  it('returns .definition property with model metadata', () => {
    const model = createCallableModel<AnthropicCallParams>(
      anthropic,
      anthropic.models.opus,
      'test-key'
    );

    expect(model.definition).toBeDefined();
    expect(model.definition.id).toBe('claude-opus-4');
    expect(model.definition.displayName).toBe('Claude Opus');
    expect(model.definition.pricing).toBeDefined();
  });

  it('sync method accepts provider-specific parameters', async () => {
    const model = createCallableModel<AnthropicCallParams>(
      anthropic,
      anthropic.models.sonnet,
      'test-key'
    );

    const result = await model.sync({
      system: 'You are helpful',
      messages: [{ role: 'user', content: 'Hello' }],
      maxTokens: 2048,
      thinking: { budgetTokens: 1024 }, // Anthropic-specific
    });

    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('usage');
    expect(result).toHaveProperty('cost');
    expect(result).toHaveProperty('model');
  });

  it('batch method accepts customId parameter', async () => {
    const model = createCallableModel<AnthropicCallParams>(
      anthropic,
      anthropic.models.haiku,
      'test-key'
    );

    const handle = await model.batch({
      customId: 'batch-001',
      system: 'You are helpful',
      messages: [{ role: 'user', content: 'Process this' }],
      maxTokens: 2048,
    });

    expect(handle).toHaveProperty('batchId');
    expect(handle).toHaveProperty('status');
    expect(handle.batchId).toBe('batch_test123');
    expect(handle.status).toMatch(/pending|processing/);
  });

  it('creates separate engine instances for different models', () => {
    const opus = createCallableModel<AnthropicCallParams>(
      anthropic,
      anthropic.models.opus,
      'key-1'
    );
    const sonnet = createCallableModel<AnthropicCallParams>(
      anthropic,
      anthropic.models.sonnet,
      'key-2'
    );

    // Verify they're distinct instances
    expect(opus.definition.id).toBe('claude-opus-4');
    expect(sonnet.definition.id).toBe('claude-sonnet-4');
  });

  describe('type safety', () => {
    it('Anthropic models accept AnthropicCallParams', () => {
      type TestModel = ReturnType<typeof createCallableModel<AnthropicCallParams>>;
      expectTypeOf<TestModel>().toHaveProperty('sync');
    });

    it('OpenAI models accept OpenAICallParams', () => {
      type TestModel = ReturnType<typeof createCallableModel<OpenAICallParams>>;
      expectTypeOf<TestModel>().toHaveProperty('sync');
    });
  });
});

// =============================================================================
// createCallableProvider() TESTS
// =============================================================================

describe('createCallableProvider()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates CallableProvider with batch methods', () => {
    const provider = createCallableProvider<AnthropicCallParams>(
      anthropic,
      'test-key'
    );

    expect(provider).toHaveProperty('checkBatch');
    expect(provider).toHaveProperty('fetchResults');
    expect(provider).toHaveProperty('cancelBatch');
    expect(typeof provider.checkBatch).toBe('function');
    expect(typeof provider.fetchResults).toBe('function');
    expect(typeof provider.cancelBatch).toBe('function');
  });

  it('returns .definition property with provider metadata', () => {
    const provider = createCallableProvider<AnthropicCallParams>(
      anthropic,
      'test-key'
    );

    expect(provider.definition).toBeDefined();
    expect(provider.definition.name).toBe('Anthropic');
    expect(provider.definition.envKeyName).toBe('ANTHROPIC_API_KEY');
  });

  it('checkBatch calls RequestEngine.checkBatchStatus()', async () => {
    const provider = createCallableProvider<AnthropicCallParams>(
      anthropic,
      'test-key'
    );

    const status = await provider.checkBatch('batch_abc123');

    expect(status).toBeDefined();
    expect(status.status).toBe('pending');
  });

  it('fetchResults calls RequestEngine.fetchBatchResults()', async () => {
    const provider = createCallableProvider<AnthropicCallParams>(
      anthropic,
      'test-key'
    );

    const results = await provider.fetchResults('https://api.example.com/results/batch_123');

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it('cancelBatch sends cancel request to provider API', async () => {
    // Mock fetch for cancel request
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        processing_status: 'canceling',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const provider = createCallableProvider<AnthropicCallParams>(
      anthropic,
      'test-key'
    );

    const result = await provider.cancelBatch('batch_xyz789');

    expect(result.success).toBe(true);
    expect(result.status).toBe('canceling');
    expect(mockFetch).toHaveBeenCalled();
  });

  it('creates separate instances for different providers', () => {
    const anthropicProvider = createCallableProvider<AnthropicCallParams>(
      anthropic,
      'key-1'
    );
    const openaiProvider = createCallableProvider<OpenAICallParams>(
      openai,
      'key-2'
    );

    expect(anthropicProvider.definition.name).toBe('Anthropic');
    expect(openaiProvider.definition.name).toBe('OpenAI');
  });

  describe('type safety', () => {
    it('accepts AnthropicCallParams for Anthropic', () => {
      type TestProvider = ReturnType<
        typeof createCallableProvider<AnthropicCallParams>
      >;
      expectTypeOf<TestProvider>().toHaveProperty('checkBatch');
    });

    it('accepts OpenAICallParams for OpenAI', () => {
      type TestProvider = ReturnType<
        typeof createCallableProvider<OpenAICallParams>
      >;
      expectTypeOf<TestProvider>().toHaveProperty('checkBatch');
    });
  });
});

// =============================================================================
// createLLM() TESTS
// =============================================================================

describe('createLLM()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns LLM interface with anthropic and openai providers', async () => {
    const secrets = createMockSecrets({
      ANTHROPIC_API_KEY: 'anthropic-key',
      OPENAI_API_KEY: 'openai-key',
    });

    const llm = await createLLM(secrets);

    expect(llm).toHaveProperty('anthropic');
    expect(llm).toHaveProperty('openai');
  });

  it('retrieves API keys from SecretsProvider', async () => {
    const secrets = createMockSecrets({
      ANTHROPIC_API_KEY: 'my-anthropic-key',
      OPENAI_API_KEY: 'my-openai-key',
    });

    const llm = await createLLM(secrets);

    expect(secrets.get).toHaveBeenCalledWith('ANTHROPIC_API_KEY');
    expect(secrets.get).toHaveBeenCalledWith('OPENAI_API_KEY');
  });

  describe('Anthropic provider wiring', () => {
    it('has opus, sonnet, haiku models', async () => {
      const secrets = createMockSecrets({
        ANTHROPIC_API_KEY: 'test-key',
      });

      const llm = await createLLM(secrets);

      expect(llm.anthropic).toHaveProperty('opus');
      expect(llm.anthropic).toHaveProperty('sonnet');
      expect(llm.anthropic).toHaveProperty('haiku');
    });

    it('opus is CallableModel with sync and batch', async () => {
      const secrets = createMockSecrets({
        ANTHROPIC_API_KEY: 'test-key',
      });

      const llm = await createLLM(secrets);

      expect(typeof llm.anthropic.opus.sync).toBe('function');
      expect(typeof llm.anthropic.opus.batch).toBe('function');
      expect(llm.anthropic.opus.definition).toBeDefined();
    });

    it('sonnet is CallableModel with sync and batch', async () => {
      const secrets = createMockSecrets({
        ANTHROPIC_API_KEY: 'test-key',
      });

      const llm = await createLLM(secrets);

      expect(typeof llm.anthropic.sonnet.sync).toBe('function');
      expect(typeof llm.anthropic.sonnet.batch).toBe('function');
      expect(llm.anthropic.sonnet.definition).toBeDefined();
    });

    it('haiku is CallableModel with sync and batch', async () => {
      const secrets = createMockSecrets({
        ANTHROPIC_API_KEY: 'test-key',
      });

      const llm = await createLLM(secrets);

      expect(typeof llm.anthropic.haiku.sync).toBe('function');
      expect(typeof llm.anthropic.haiku.batch).toBe('function');
      expect(llm.anthropic.haiku.definition).toBeDefined();
    });

    it('provider has batch utilities: checkBatch, fetchResults, cancelBatch', async () => {
      const secrets = createMockSecrets({
        ANTHROPIC_API_KEY: 'test-key',
      });

      const llm = await createLLM(secrets);

      expect(typeof llm.anthropic.checkBatch).toBe('function');
      expect(typeof llm.anthropic.fetchResults).toBe('function');
      expect(typeof llm.anthropic.cancelBatch).toBe('function');
    });

    it('opus sync accepts AnthropicCallParams with thinking', async () => {
      const secrets = createMockSecrets({
        ANTHROPIC_API_KEY: 'test-key',
      });

      const llm = await createLLM(secrets);

      const result = await llm.anthropic.opus.sync({
        system: 'You are Claude',
        messages: [{ role: 'user', content: 'Think' }],
        maxTokens: 8192,
        thinking: { budgetTokens: 4096 }, // Should work
      });

      expect(result.content).toBeDefined();
    });

    it('provider has definition property', async () => {
      const secrets = createMockSecrets({
        ANTHROPIC_API_KEY: 'test-key',
      });

      const llm = await createLLM(secrets);

      expect(llm.anthropic.definition).toBeDefined();
      expect(llm.anthropic.definition.name).toBe('Anthropic');
    });
  });

  describe('OpenAI provider wiring', () => {
    it('has gpt-4o, gpt-4o-mini, gpt-5.2 models', async () => {
      const secrets = createMockSecrets({
        OPENAI_API_KEY: 'test-key',
      });

      const llm = await createLLM(secrets);

      expect(llm.openai).toHaveProperty('gpt-4o');
      expect(llm.openai).toHaveProperty('gpt-4o-mini');
      expect(llm.openai).toHaveProperty('gpt-5.2');
    });

    it('gpt-4o is CallableModel with sync and batch', async () => {
      const secrets = createMockSecrets({
        OPENAI_API_KEY: 'test-key',
      });

      const llm = await createLLM(secrets);

      expect(typeof llm.openai['gpt-4o'].sync).toBe('function');
      expect(typeof llm.openai['gpt-4o'].batch).toBe('function');
      expect(llm.openai['gpt-4o'].definition).toBeDefined();
    });

    it('gpt-4o-mini is CallableModel with sync and batch', async () => {
      const secrets = createMockSecrets({
        OPENAI_API_KEY: 'test-key',
      });

      const llm = await createLLM(secrets);

      expect(typeof llm.openai['gpt-4o-mini'].sync).toBe('function');
      expect(typeof llm.openai['gpt-4o-mini'].batch).toBe('function');
      expect(llm.openai['gpt-4o-mini'].definition).toBeDefined();
    });

    it('gpt-5.2 is CallableModel with sync and batch', async () => {
      const secrets = createMockSecrets({
        OPENAI_API_KEY: 'test-key',
      });

      const llm = await createLLM(secrets);

      expect(typeof llm.openai['gpt-5.2'].sync).toBe('function');
      expect(typeof llm.openai['gpt-5.2'].batch).toBe('function');
      expect(llm.openai['gpt-5.2'].definition).toBeDefined();
    });

    it('provider has batch utilities: checkBatch, fetchResults, cancelBatch', async () => {
      const secrets = createMockSecrets({
        OPENAI_API_KEY: 'test-key',
      });

      const llm = await createLLM(secrets);

      expect(typeof llm.openai.checkBatch).toBe('function');
      expect(typeof llm.openai.fetchResults).toBe('function');
      expect(typeof llm.openai.cancelBatch).toBe('function');
    });

    it('gpt-5.2 sync accepts OpenAICallParams with reasoning', async () => {
      const secrets = createMockSecrets({
        OPENAI_API_KEY: 'test-key',
      });

      const llm = await createLLM(secrets);

      const result = await llm.openai['gpt-5.2'].sync({
        system: 'You are helpful',
        messages: [{ role: 'user', content: 'Reason about this' }],
        maxTokens: 4096,
        reasoning: 'high', // Should work
      });

      expect(result.content).toBeDefined();
    });

    it('provider has definition property', async () => {
      const secrets = createMockSecrets({
        OPENAI_API_KEY: 'test-key',
      });

      const llm = await createLLM(secrets);

      expect(llm.openai.definition).toBeDefined();
      expect(llm.openai.definition.name).toBe('OpenAI');
    });
  });

  describe('handles missing API keys', () => {
    it('uses empty string when ANTHROPIC_API_KEY missing', async () => {
      const secrets = createMockSecrets({
        OPENAI_API_KEY: 'test-key',
        // ANTHROPIC_API_KEY: undefined
      });

      const llm = await createLLM(secrets);

      // Should still create models, but they might fail at runtime
      expect(llm.anthropic.opus).toBeDefined();
    });

    it('uses empty string when OPENAI_API_KEY missing', async () => {
      const secrets = createMockSecrets({
        ANTHROPIC_API_KEY: 'test-key',
        // OPENAI_API_KEY: undefined
      });

      const llm = await createLLM(secrets);

      // Should still create models, but they might fail at runtime
      expect(llm.openai['gpt-4o']).toBeDefined();
    });
  });

  describe('type safety', () => {
    it('LLM type has anthropic and openai properties', async () => {
      type TestLLM = Awaited<ReturnType<typeof createLLM>>;
      expectTypeOf<TestLLM>().toHaveProperty('anthropic');
      expectTypeOf<TestLLM>().toHaveProperty('openai');
    });

    it('Anthropic models accept AnthropicCallParams', async () => {
      const secrets = createMockSecrets({
        ANTHROPIC_API_KEY: 'test-key',
      });

      const llm = await createLLM(secrets);

      type OpusParams = Parameters<typeof llm.anthropic.opus.sync>[0];
      expectTypeOf<OpusParams>().toHaveProperty('thinking');
      expectTypeOf<OpusParams>().not.toHaveProperty('reasoning');
    });

    it('OpenAI models accept OpenAICallParams', async () => {
      const secrets = createMockSecrets({
        OPENAI_API_KEY: 'test-key',
      });

      const llm = await createLLM(secrets);

      type OpenAICallable = typeof llm.openai['gpt-5.2'];
      type GPTParams = Parameters<OpenAICallable['sync']>[0];
      expectTypeOf<GPTParams>().toHaveProperty('reasoning');
      expectTypeOf<GPTParams>().not.toHaveProperty('thinking');
    });
  });

  describe('integration scenarios', () => {
    it('supports full workflow: sync call', async () => {
      const secrets = createMockSecrets({
        ANTHROPIC_API_KEY: 'test-key',
        OPENAI_API_KEY: 'test-key',
      });

      const llm = await createLLM(secrets);

      // Anthropic sync with thinking
      const anthropicResult = await llm.anthropic.opus.sync({
        system: 'You are Clio',
        messages: [{ role: 'user', content: 'Think about meaning' }],
        maxTokens: 8192,
        thinking: { budgetTokens: 4096 },
      });

      expect(anthropicResult.content).toBe('Mock response');
      expect(anthropicResult.cost).toBe(0.005);

      // OpenAI sync with reasoning
      const openaiResult = await llm.openai['gpt-5.2'].sync({
        system: 'Summarize concisely',
        messages: [{ role: 'user', content: 'Long text...' }],
        maxTokens: 1500,
        reasoning: 'high',
      });

      expect(openaiResult.content).toBe('Mock response');
    });

    it('supports full workflow: batch submission', async () => {
      const secrets = createMockSecrets({
        ANTHROPIC_API_KEY: 'test-key',
      });

      const llm = await createLLM(secrets);

      const handle = await llm.anthropic.sonnet.batch({
        customId: 'cycle-42',
        system: 'You are helpful',
        messages: [{ role: 'user', content: 'Process' }],
        maxTokens: 2048,
      });

      expect(handle.batchId).toBe('batch_test123');
      // BatchHandle maps 'validating' → 'pending' (simpler interface)
      expect(handle.status).toBe('pending');
    });

    it('supports full workflow: batch status checking', async () => {
      const secrets = createMockSecrets({
        ANTHROPIC_API_KEY: 'test-key',
      });

      const llm = await createLLM(secrets);

      const status = await llm.anthropic.checkBatch('batch_test123');

      expect(status).toBeDefined();
      expect(status.status).toBe('pending');
    });

    it('supports accessing model pricing via definition', async () => {
      const secrets = createMockSecrets({
        ANTHROPIC_API_KEY: 'test-key',
        OPENAI_API_KEY: 'test-key',
      });

      const llm = await createLLM(secrets);

      // Anthropic opus pricing
      expect(llm.anthropic.opus.definition.pricing.input).toBe(5.0);
      expect(llm.anthropic.opus.definition.pricing.output).toBe(15.0);

      // OpenAI gpt-5.2 pricing
      expect(llm.openai['gpt-5.2'].definition.pricing.input).toBe(5.0);
      expect(llm.openai['gpt-5.2'].definition.pricing.output).toBe(20.0);
    });
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('Edge cases', () => {
  it('createCallableModel with empty API key still creates model', () => {
    const model = createCallableModel<AnthropicCallParams>(
      anthropic,
      anthropic.models.opus,
      '' // Empty key
    );

    expect(model).toBeDefined();
    expect(model.definition).toBeDefined();
  });

  it('createCallableProvider with empty API key still creates provider', () => {
    const provider = createCallableProvider<AnthropicCallParams>(
      anthropic,
      '' // Empty key
    );

    expect(provider).toBeDefined();
    expect(provider.definition).toBeDefined();
  });

  it('createLLM returns consistent instances across calls', async () => {
    const secrets = createMockSecrets({
      ANTHROPIC_API_KEY: 'test-key',
      OPENAI_API_KEY: 'test-key',
    });

    const llm1 = await createLLM(secrets);
    const llm2 = await createLLM(secrets);

    // Should have same structure (not same reference, but same types)
    expect(llm1.anthropic.opus.definition.id).toBe(llm2.anthropic.opus.definition.id);
    expect(llm1.openai['gpt-5.2'].definition.id).toBe(llm2.openai['gpt-5.2'].definition.id);
  });
});
