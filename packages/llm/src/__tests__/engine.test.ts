/**
 * @module @persistence/llm/__tests__/engine.test
 * @description Unit tests for LLM Request Engine
 *
 * Tests cover:
 * - RequestEngine constructor configuration
 * - execute() with sync mode
 * - execute() with batch mode
 * - submitBatch() API interaction
 * - checkBatchStatus() polling
 * - fetchBatchResults() with retry logic
 * - Cost calculation
 * - Timeout handling
 * - Error scenarios
 *
 * @covers ../engine/engine.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RequestEngine } from '../engine/engine';
import type { LLMRequest, EngineEnvironment } from '../engine/types';
import type { ProviderDefinition, ModelDefinition } from '@persistence/core/providers';

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock @persistence/core BEFORE importing engine
vi.mock('@persistence/core', () => ({
  CACHE_PRICING: {
    cacheReadDiscount: 0.1,
    cacheWritePremium5m: 1.25,
    cacheWritePremium1h: 2.0,
    cacheWritePremium: 1.25,
    batchDiscount: 0.5,
  },
  // Identity function - cleanup logic tested separately in @persistence/core
  cleanResponseContent: (content: string) => content,
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock provider for testing
const mockModelPricing = {
  input: 3.0,
  output: 15.0,
  cacheRead: 0.30,
  cacheWrite: 3.75,
};

const mockModel: ModelDefinition = {
  id: 'claude-test-model',
  displayName: 'Claude Test',
  contextWindow: 200000,
  pricing: mockModelPricing,
  capabilities: {
    vision: true,
    reasoning: false,
    thinking: false,
    streaming: true,
  },
};

const mockProvider: ProviderDefinition = {
  name: 'TestProvider',
  api: {
    url: 'https://api.test.com/v1/messages',
    version: '2023-06-01',
  },
  envKeyName: 'TEST_API_KEY',
  models: { test: mockModel },
  getHeaders: (apiKey: string) => ({
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'test-version': '2023-06-01',
  }),
  formatRequest: (opts) => ({
    model: opts.model.id,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: opts.messages,
  }),
  parseResponse: (data: unknown) => {
    const d = data as { content?: Array<{ text: string }>; usage?: Record<string, number>; stop_reason?: string };
    return {
      content: d.content?.[0]?.text ?? '',
      usage: {
        input: d.usage?.input_tokens ?? 0,
        output: d.usage?.output_tokens ?? 0,
        cacheRead: d.usage?.cache_read_input_tokens,
        cacheWrite: d.usage?.cache_creation_input_tokens,
      },
      finishReason: d.stop_reason,
    };
  },
  parseError: (error: unknown) => {
    const e = error as { error?: { message?: string } };
    return {
      code: 'test_error',
      message: e.error?.message ?? 'Test error',
      retryable: false,
    };
  },
};

const mockEnv: EngineEnvironment = {
  TEST_API_KEY: 'test-key-12345',
  ANTHROPIC_API_KEY: 'anthropic-key-12345',
};

function createTestRequest(overrides: Partial<LLMRequest> = {}): LLMRequest {
  return {
    provider: mockProvider,
    model: mockModel,
    system: 'You are a helpful assistant.',
    messages: [{ role: 'user', content: 'Hello' }],
    maxTokens: 1000,
    mode: 'sync',
    ...overrides,
  };
}

function createMockResponse(content: string, usage = { input_tokens: 100, output_tokens: 50 }) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      content: [{ type: 'text', text: content }],
      usage,
      stop_reason: 'end_turn',
    }),
  };
}

// =============================================================================
// CONSTRUCTOR TESTS
// =============================================================================

describe('RequestEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('creates engine with default config', () => {
      const engine = new RequestEngine(mockEnv);
      expect(engine).toBeInstanceOf(RequestEngine);
    });

    it('accepts custom polling config', () => {
      const engine = new RequestEngine(mockEnv, {
        polling: {
          maxWaitMs: 60000,
          pollIntervalMs: 1000,
        },
      });
      expect(engine).toBeInstanceOf(RequestEngine);
    });

    it('accepts custom retry config', () => {
      const engine = new RequestEngine(mockEnv, {
        retry: {
          maxRetries: 5,
          baseDelayMs: 2000,
          maxDelayMs: 16000,
        },
      });
      expect(engine).toBeInstanceOf(RequestEngine);
    });
  });

  // =============================================================================
  // SYNC EXECUTE TESTS
  // =============================================================================

  describe('execute() - sync mode', () => {
    it('makes request to provider API', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse('Hello, world!'));
      const engine = new RequestEngine(mockEnv);
      const request = createTestRequest();

      await engine.execute(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'test-key-12345',
          }),
        })
      );
    });

    it('resolves relative provider URLs against baseUrl', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse('Relative path works'));
      const engine = new RequestEngine(mockEnv);
      const request = createTestRequest({
        provider: {
          ...mockProvider,
          api: {
            baseUrl: 'https://api.relative.test/v1',
            url: '/chat/completions',
          },
        },
      });

      await engine.execute(request);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.relative.test/v1/chat/completions',
        expect.any(Object),
      );
    });

    it('returns parsed content', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse('Test response'));
      const engine = new RequestEngine(mockEnv);
      const request = createTestRequest();

      const response = await engine.execute(request);

      expect(response.content).toBe('Test response');
    });

    it('returns usage information', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse('Test', {
        input_tokens: 200,
        output_tokens: 100,
        cache_read_input_tokens: 50,
        cache_creation_input_tokens: 25,
      }));
      const engine = new RequestEngine(mockEnv);
      const request = createTestRequest();

      const response = await engine.execute(request);

      expect(response.usage).toEqual({
        input: 200,
        output: 100,
        cacheRead: 50,
        cacheWrite: 25,
      });
    });

    it('calculates cost correctly', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse('Test', {
        input_tokens: 1000,
        output_tokens: 500,
      }));
      const engine = new RequestEngine(mockEnv);
      const request = createTestRequest();

      const response = await engine.execute(request);

      // Cost = (1000 * 3.0 / 1M) + (500 * 15.0 / 1M) = 0.003 + 0.0075 = 0.0105
      expect(response.cost).toBeCloseTo(0.0105, 6);
    });

    it('includes cache costs in calculation', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse('Test', {
        input_tokens: 1000,
        output_tokens: 500,
        cache_read_input_tokens: 2000,
        cache_creation_input_tokens: 500,
      }));
      const engine = new RequestEngine(mockEnv);
      const request = createTestRequest();

      const response = await engine.execute(request);

      // Cost = input + output + cacheRead + cacheWrite
      // = (1000 * 3.0 / 1M) + (500 * 15.0 / 1M) + (2000 * 0.30 / 1M) + (500 * 3.75 / 1M)
      // = 0.003 + 0.0075 + 0.0006 + 0.001875 = 0.012975
      expect(response.cost).toBeCloseTo(0.012975, 6);
    });

    it('returns metadata with provider and model info', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse('Test'));
      const engine = new RequestEngine(mockEnv);
      const request = createTestRequest();

      const response = await engine.execute(request);

      expect(response.metadata.provider).toBe('TestProvider');
      expect(response.metadata.model).toBe('Claude Test');
      expect(response.metadata.finishReason).toBe('end_turn');
      expect(response.metadata.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('throws error when API key is missing', async () => {
      const engine = new RequestEngine({}); // No API keys
      const request = createTestRequest();

      await expect(engine.execute(request)).rejects.toThrow(
        'Missing API key: TEST_API_KEY not found in environment'
      );
    });

    it('throws error on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: { message: 'Bad request' } }),
      });
      const engine = new RequestEngine(mockEnv);
      const request = createTestRequest();

      await expect(engine.execute(request)).rejects.toThrow('TestProvider API error: Bad request');
    });

    it('handles timeout', async () => {
      mockFetch.mockImplementation(() => new Promise((_, reject) => {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        setTimeout(() => reject(error), 100);
      }));

      const engine = new RequestEngine(mockEnv);
      const request = createTestRequest({ timeout: 50 });

      const executePromise = engine.execute(request);
      vi.advanceTimersByTime(100);

      await expect(executePromise).rejects.toThrow('TestProvider request timed out after 50ms');
    });
  });

  // =============================================================================
  // BATCH SUBMIT TESTS
  // =============================================================================

  describe('submitBatch()', () => {
    it('submits request to batch endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'batch_abc123',
          processing_status: 'validating',
          expires_at: '2026-01-30T00:00:00Z',
        }),
      });
      const engine = new RequestEngine(mockEnv);
      const request = createTestRequest();

      await engine.submitBatch(request, 'custom-001');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/messages/batches',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('custom-001'),
        })
      );
    });

    it('returns BatchJob with batch ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'batch_xyz789',
          processing_status: 'in_progress',
          expires_at: '2026-01-30T12:00:00Z',
        }),
      });
      const engine = new RequestEngine(mockEnv);
      const request = createTestRequest();

      const job = await engine.submitBatch(request, 'my-custom-id');

      expect(job.batchId).toBe('batch_xyz789');
      expect(job.customId).toBe('my-custom-id');
      expect(job.status).toBe('in_progress');
      expect(job.provider).toBe('TestProvider');
      expect(job.model).toBe('Claude Test');
    });

    it('throws error on submission failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: { message: 'Server error' } }),
      });
      const engine = new RequestEngine(mockEnv);
      const request = createTestRequest();

      await expect(engine.submitBatch(request, 'custom-001')).rejects.toThrow(
        'Batch submission failed: Server error'
      );
    });
  });

  // =============================================================================
  // BATCH STATUS TESTS
  // =============================================================================

  describe('checkBatchStatus()', () => {
    it('checks status at correct endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          processing_status: 'in_progress',
        }),
      });
      const engine = new RequestEngine(mockEnv);

      await engine.checkBatchStatus('batch_abc123', mockProvider);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/messages/batches/batch_abc123',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'test-key-12345',
          }),
        })
      );
    });

    it('returns status with results URL when completed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          processing_status: 'ended',
          results_url: 'https://api.test.com/results/batch_abc123',
          request_counts: { processing: 0, succeeded: 1, errored: 0, canceled: 0, expired: 0 },
          ended_at: '2026-01-29T12:00:00Z',
        }),
      });
      const engine = new RequestEngine(mockEnv);

      const status = await engine.checkBatchStatus('batch_abc123', mockProvider);

      expect(status.status).toBe('ended');
      expect(status.resultsUrl).toBe('https://api.test.com/results/batch_abc123');
      expect(status.requestCounts?.succeeded).toBe(1);
      expect(status.endedAt).toBe('2026-01-29T12:00:00Z');
    });

    it('throws error on status check failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: { message: 'Batch not found' } }),
      });
      const engine = new RequestEngine(mockEnv);

      await expect(engine.checkBatchStatus('batch_invalid', mockProvider)).rejects.toThrow(
        'Batch status check failed: Batch not found'
      );
    });
  });

  // =============================================================================
  // BATCH RESULTS TESTS
  // =============================================================================

  describe('fetchBatchResults()', () => {
    const resultsUrl = 'https://api.test.com/results/batch_abc123';

    it('fetches and parses JSONL results', async () => {
      const jsonlContent = [
        JSON.stringify({
          custom_id: 'req-001',
          result: {
            type: 'succeeded',
            message: {
              content: [{ type: 'text', text: 'Response 1' }],
              usage: { input_tokens: 100, output_tokens: 50 },
              stop_reason: 'end_turn',
            },
          },
        }),
      ].join('\n');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(jsonlContent),
      });

      const engine = new RequestEngine(mockEnv);
      const results = await engine.fetchBatchResults(resultsUrl, mockProvider, mockModel);

      expect(results).toHaveLength(1);
      expect(results[0].customId).toBe('req-001');
      expect(results[0].response?.content).toBe('Response 1');
    });

    it('applies batch discount (50%) to cost', async () => {
      const jsonlContent = JSON.stringify({
        custom_id: 'req-001',
        result: {
          type: 'succeeded',
          message: {
            content: [{ type: 'text', text: 'Test' }],
            usage: { input_tokens: 1000, output_tokens: 500 },
            stop_reason: 'end_turn',
          },
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(jsonlContent),
      });

      const engine = new RequestEngine(mockEnv);
      const results = await engine.fetchBatchResults(resultsUrl, mockProvider, mockModel);

      // Base cost = 0.0105 (see sync test)
      // With 50% batch discount = 0.00525
      expect(results[0].response?.cost).toBeCloseTo(0.00525, 6);
    });

    it('handles failed results', async () => {
      const jsonlContent = JSON.stringify({
        custom_id: 'req-001',
        result: {
          type: 'errored',
          error: { message: 'Content policy violation' },
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(jsonlContent),
      });

      const engine = new RequestEngine(mockEnv);
      const results = await engine.fetchBatchResults(resultsUrl, mockProvider, mockModel);

      expect(results[0].error).toBe('Content policy violation');
      expect(results[0].response).toBeUndefined();
    });

    it('retries on fetch failure with exponential backoff', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Still failing'))
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({
            custom_id: 'req-001',
            result: {
              type: 'succeeded',
              message: {
                content: [{ type: 'text', text: 'Finally!' }],
                usage: { input_tokens: 100, output_tokens: 50 },
              },
            },
          })),
        });

      const onRetry = vi.fn();
      const engine = new RequestEngine(mockEnv, {
        retry: {
          maxRetries: 3,
          baseDelayMs: 100,
          maxDelayMs: 400,
          onRetry,
        },
      });

      const resultsPromise = engine.fetchBatchResults(resultsUrl, mockProvider, mockModel);

      // First retry after 100ms
      await vi.advanceTimersByTimeAsync(100);
      // Second retry after 200ms (2^1 * 100)
      await vi.advanceTimersByTimeAsync(200);

      const results = await resultsPromise;

      expect(results[0].response?.content).toBe('Finally!');
      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, 1, 3, 'Network error', 100);
      expect(onRetry).toHaveBeenNthCalledWith(2, 2, 3, 'Still failing', 200);
    });

    it('calls onAllFailed when retries exhausted', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent failure'));

      const onAllFailed = vi.fn();
      const engine = new RequestEngine(mockEnv, {
        retry: {
          maxRetries: 2,
          baseDelayMs: 50,
          maxDelayMs: 200,
          onAllFailed,
        },
      });

      const resultsPromise = engine.fetchBatchResults(resultsUrl, mockProvider, mockModel);
      // Mark promise as handled to prevent unhandled rejection warning
      resultsPromise.catch(() => {});

      // Advance through retries
      await vi.advanceTimersByTimeAsync(50);
      await vi.advanceTimersByTimeAsync(100);

      await expect(resultsPromise).rejects.toThrow('Batch results fetch failed after 2 attempts');
      expect(onAllFailed).toHaveBeenCalledWith(2, 'Persistent failure');
    });

    it('respects maxDelayMs cap', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockRejectedValueOnce(new Error('Error 3'))
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({
            custom_id: 'req-001',
            result: { type: 'succeeded', message: { content: [{ text: 'OK' }], usage: {} } },
          })),
        });

      const onRetry = vi.fn();
      const engine = new RequestEngine(mockEnv, {
        retry: {
          maxRetries: 4,
          baseDelayMs: 100,
          maxDelayMs: 250, // Cap at 250ms
          onRetry,
        },
      });

      const resultsPromise = engine.fetchBatchResults(resultsUrl, mockProvider, mockModel);

      // First retry: 100ms
      await vi.advanceTimersByTimeAsync(100);
      // Second retry: min(200, 250) = 200ms
      await vi.advanceTimersByTimeAsync(200);
      // Third retry: min(400, 250) = 250ms (capped)
      await vi.advanceTimersByTimeAsync(250);

      await resultsPromise;

      expect(onRetry).toHaveBeenNthCalledWith(3, 3, 4, 'Error 3', 250);
    });
  });

  // =============================================================================
  // BATCH MODE EXECUTE TESTS
  // =============================================================================

  describe('execute() - batch mode', () => {
    it('submits and polls until completion', async () => {
      // Track the custom_id from the submit call
      let capturedCustomId = '';

      // Submit response - capture the custom_id from the request
      mockFetch.mockImplementationOnce(async (_url: unknown, opts: unknown) => {
        const body = JSON.parse((opts as { body: string }).body);
        capturedCustomId = body.requests[0].custom_id;
        return {
          ok: true,
          json: () => Promise.resolve({
            id: 'batch_poll123',
            processing_status: 'validating',
          }),
        };
      });

      // First poll - still in progress
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          processing_status: 'in_progress',
        }),
      });

      // Second poll - completed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          processing_status: 'ended',
          results_url: 'https://api.test.com/results/batch_poll123',
        }),
      });

      // Results fetch - return the correct custom_id
      mockFetch.mockImplementationOnce(async () => {
        return {
          ok: true,
          text: () => Promise.resolve(JSON.stringify({
            custom_id: capturedCustomId,
            result: {
              type: 'succeeded',
              message: {
                content: [{ type: 'text', text: 'Batch result!' }],
                usage: { input_tokens: 100, output_tokens: 50 },
              },
            },
          })),
        };
      });

      const engine = new RequestEngine(mockEnv, {
        polling: { maxWaitMs: 60000, pollIntervalMs: 1000 },
      });
      const request = createTestRequest({ mode: 'batch' });

      const executePromise = engine.execute(request);

      // Advance through polling intervals
      await vi.advanceTimersByTimeAsync(1000); // First poll
      await vi.advanceTimersByTimeAsync(1000); // Second poll

      const response = await executePromise;

      expect(response.content).toBe('Batch result!');
      expect(mockFetch).toHaveBeenCalledTimes(4); // submit + 2 polls + results
    });

    it('throws on batch timeout', async () => {
      // Submit response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'batch_timeout',
          processing_status: 'validating',
        }),
      });

      // All polls return in_progress
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ processing_status: 'in_progress' }),
      });

      const engine = new RequestEngine(mockEnv, {
        polling: { maxWaitMs: 3000, pollIntervalMs: 1000 },
      });
      const request = createTestRequest({ mode: 'batch' });

      const executePromise = engine.execute(request);
      // Mark promise as handled to prevent unhandled rejection warning
      executePromise.catch(() => {});

      // Advance past maxWaitMs
      await vi.advanceTimersByTimeAsync(4000);

      await expect(executePromise).rejects.toThrow(
        'Batch timed out after 3s (batchId: batch_timeout)'
      );
    });

    it('throws on batch cancellation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'batch_cancel', processing_status: 'validating' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ processing_status: 'canceled' }),
      });

      const engine = new RequestEngine(mockEnv, {
        polling: { maxWaitMs: 60000, pollIntervalMs: 1000 },
      });
      const request = createTestRequest({ mode: 'batch' });

      const executePromise = engine.execute(request);
      // Mark promise as handled to prevent unhandled rejection warning
      executePromise.catch(() => {});
      await vi.advanceTimersByTimeAsync(1000);

      await expect(executePromise).rejects.toThrow('Batch canceled');
    });

    it('throws on batch expiration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'batch_expire', processing_status: 'validating' }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ processing_status: 'expired' }),
      });

      const engine = new RequestEngine(mockEnv, {
        polling: { maxWaitMs: 60000, pollIntervalMs: 1000 },
      });
      const request = createTestRequest({ mode: 'batch' });

      const executePromise = engine.execute(request);
      // Mark promise as handled to prevent unhandled rejection warning
      executePromise.catch(() => {});
      await vi.advanceTimersByTimeAsync(1000);

      await expect(executePromise).rejects.toThrow('Batch expired');
    });
  });
});
