/**
 * Tests for Response Normalizer Integration
 *
 * @module services/__tests__/response-normalizer-integration
 * @covers callLLM, callLLMNormalized
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock execute function at module level
const mockExecute = vi.fn();

// Mock the @persistence/llm module
vi.mock('@persistence/llm', () => {
  // Create a proper class constructor
  class MockRequestEngine {
    constructor() {}
    execute = mockExecute;
  }

  return {
    resolveProvider: vi.fn((name) => {
      if (name === 'anthropic') {
        return {
          name: 'Anthropic',
          envKeyName: 'ANTHROPIC_API_KEY',
          models: {
            sonnet: {
              id: 'claude-sonnet-4-6-20250514',
              displayName: 'Claude 4.6 Sonnet',
            },
            opus: {
              id: 'claude-opus-4-6',
              displayName: 'Claude 4.6 Opus',
            },
          },
        };
      }
      if (name === 'openai') {
        return {
          name: 'OpenAI',
          envKeyName: 'OPENAI_API_KEY',
          models: {
            'gpt-4o-mini': {
              id: 'gpt-4o-mini',
              displayName: 'GPT-4o Mini',
            },
          },
        };
      }
      throw new Error(`Unknown provider: '${name}'`);
    }),

    resolveModelById: vi.fn((provider: { models: Record<string, { id: string }> }, modelId: string) => {
      const models = Object.values(provider.models);
      return models.find((m) => m.id === modelId);
    }),

    RequestEngine: MockRequestEngine,
  };
});

// Import after mock setup
import { callLLM } from '../response-normalizer-integration.js';

describe('callLLM / callLLMNormalized', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful calls', () => {
    it('returns normalized response with metadata for anthropic', async () => {
      mockExecute.mockResolvedValue({
        content: 'Hello from Claude!',
        usage: {
          input: 100,
          output: 50,
          cacheRead: 0,
          cacheWrite: 0,
        },
        cost: 0.001,
        metadata: {
          provider: 'Anthropic',
          model: 'Claude 4.6 Sonnet',
          latencyMs: 500,
        },
      });

      const result = await callLLM({
        provider: 'anthropic',
        model: 'claude-sonnet-4-6-20250514',
        system: 'You are helpful',
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 1000,
      }, { ANTHROPIC_API_KEY: 'test-key' });

      expect(result.content).toBe('Hello from Claude!');
      expect(result.metadata.provider).toBe('anthropic');
      expect(result.metadata.model).toBe('Claude 4.6 Sonnet');
      expect(result.metadata.tokens.input).toBe(100);
      expect(result.metadata.tokens.output).toBe(50);
      expect(result.metadata.tokens.total).toBe(150);
    });

    it('returns normalized response for openai', async () => {
      mockExecute.mockResolvedValue({
        content: 'Hello from GPT!',
        usage: {
          input: 80,
          output: 40,
        },
        cost: 0.0005,
        metadata: {
          provider: 'OpenAI',
          model: 'GPT-4o Mini',
          latencyMs: 300,
        },
      });

      const result = await callLLM({
        provider: 'openai',
        model: 'gpt-4o-mini',
        system: 'You are helpful',
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 500,
      }, { OPENAI_API_KEY: 'test-key' });

      expect(result.content).toBe('Hello from GPT!');
      expect(result.metadata.provider).toBe('openai');
      expect(result.metadata.tokens.total).toBe(120);
    });

    it('includes cache tokens in metadata', async () => {
      mockExecute.mockResolvedValue({
        content: 'Cached response',
        usage: {
          input: 100,
          output: 50,
          cacheRead: 75,
          cacheWrite: 25,
        },
      });

      const result = await callLLM({
        provider: 'anthropic',
        model: 'sonnet',
        system: 'Test',
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 100,
      }, { ANTHROPIC_API_KEY: 'test-key' });

      expect(result.metadata.tokens.cacheRead).toBe(75);
      expect(result.metadata.tokens.cacheWrite).toBe(25);
    });

    it('defaults cache tokens to 0 when not provided', async () => {
      mockExecute.mockResolvedValue({
        content: 'No cache response',
        usage: {
          input: 100,
          output: 50,
          // No cacheRead/cacheWrite
        },
      });

      const result = await callLLM({
        provider: 'anthropic',
        model: 'sonnet',
        system: 'Test',
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 100,
      }, { ANTHROPIC_API_KEY: 'test-key' });

      expect(result.metadata.tokens.cacheRead).toBe(0);
      expect(result.metadata.tokens.cacheWrite).toBe(0);
    });

    it('passes reasoning parameter to engine', async () => {
      mockExecute.mockResolvedValue({
        content: 'Response',
        usage: { input: 10, output: 10 },
      });

      await callLLM({
        provider: 'openai',
        model: 'gpt-4o-mini',
        system: 'Test',
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 100,
        reasoning: 'none',
      }, { OPENAI_API_KEY: 'test-key' });

      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          reasoning: 'none',
        })
      );
    });
  });

  describe('model resolution', () => {
    it('resolves model by exact ID', async () => {
      mockExecute.mockResolvedValue({
        content: 'Test',
        usage: { input: 10, output: 10 },
      });

      await callLLM({
        provider: 'anthropic',
        model: 'claude-sonnet-4-6-20250514',
        system: 'Test',
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 100,
      }, { ANTHROPIC_API_KEY: 'test-key' });

      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.objectContaining({
            id: 'claude-sonnet-4-6-20250514',
          }),
        })
      );
    });

    it('resolves model by short key', async () => {
      mockExecute.mockResolvedValue({
        content: 'Test',
        usage: { input: 10, output: 10 },
      });

      await callLLM({
        provider: 'anthropic',
        model: 'sonnet', // Short key, not full ID
        system: 'Test',
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 100,
      }, { ANTHROPIC_API_KEY: 'test-key' });

      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.objectContaining({
            displayName: 'Claude 4.6 Sonnet',
          }),
        })
      );
    });

    it('throws error for unknown model instead of silent fallback', async () => {
      await expect(callLLM({
        provider: 'anthropic',
        model: 'nonexistent-model',
        system: 'Test',
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 100,
      }, { ANTHROPIC_API_KEY: 'test-key' })).rejects.toThrow(
        /Unknown model 'nonexistent-model' for provider 'Anthropic'/
      );
    });
  });

  describe('error handling', () => {
    it('normalizes and rethrows engine errors', async () => {
      mockExecute.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(callLLM({
        provider: 'anthropic',
        model: 'sonnet',
        system: 'Test',
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 100,
      }, { ANTHROPIC_API_KEY: 'test-key' })).rejects.toThrow();
    });

    it('throws for unknown provider', async () => {
      await expect(callLLM({
        provider: 'unknown-provider',
        model: 'some-model',
        system: 'Test',
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 100,
      }, {})).rejects.toThrow(/unknown.provider/i);
    });
  });

  describe('request parameters', () => {
    it('passes all parameters to engine.execute()', async () => {
      mockExecute.mockResolvedValue({
        content: 'Response',
        usage: { input: 10, output: 10 },
      });

      const messages = [
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'Response' },
        { role: 'user', content: 'Second' },
      ];

      await callLLM({
        provider: 'anthropic',
        model: 'sonnet',
        system: 'You are a helpful assistant',
        messages,
        maxTokens: 2000,
      }, { ANTHROPIC_API_KEY: 'test-key' });

      expect(mockExecute).toHaveBeenCalledWith({
        provider: expect.any(Object),
        model: expect.any(Object),
        mode: 'sync',
        system: 'You are a helpful assistant',
        messages,
        maxTokens: 2000,
        reasoning: undefined,
      });
    });
  });
});
