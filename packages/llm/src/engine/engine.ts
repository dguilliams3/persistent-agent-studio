/**
 * LLM Request Engine
 *
 * @module @persistence/llm/engine
 * @description Executes LLM requests using typed provider/model objects
 *
 * The engine receives typed objects - NO string lookups.
 * All provider/model resolution happens at the boundary (persona config loading).
 */

import type { ModelDefinition, ParsedResponse } from '@persistence/core/providers';
import { CACHE_PRICING, cleanResponseContent } from '@persistence/core';
import type {
  LLMRequest,
  LLMResponse,
  EngineEnvironment,
  BatchJob,
  BatchStatus,
  BatchResult,
} from '../types';
import { resolveBatchApiUrl, resolveProviderApiUrl } from '../providerUrls';

/**
 * Batch polling configuration (for execute() with mode: 'batch')
 */
export interface BatchPollingConfig {
  /** Max time to wait for batch completion in ms (default: 300000 = 5 min) */
  maxWaitMs?: number;
  /** Poll interval in ms (default: 5000 = 5 sec) */
  pollIntervalMs?: number;
}

/**
 * Retry configuration for batch result fetching
 */
export interface BatchRetryConfig {
  /** Max retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay before first retry in ms (default: 1000) */
  baseDelayMs?: number;
  /** Maximum delay cap in ms (default: 8000) */
  maxDelayMs?: number;
  /** Optional callback on each retry attempt - platform can wire notifications */
  onRetry?: (attempt: number, maxRetries: number, error: string, delayMs: number) => void | Promise<void>;
  /** Optional callback when all retries exhausted */
  onAllFailed?: (maxRetries: number, error: string) => void | Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 120000;

/** Sleep utility for retry backoff */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class RequestEngine {
  private batchConfig: Required<Omit<BatchPollingConfig, 'onRetry' | 'onAllFailed'>>;
  private retryConfig: Required<Omit<BatchRetryConfig, 'onRetry' | 'onAllFailed'>> & Pick<BatchRetryConfig, 'onRetry' | 'onAllFailed'>;

  constructor(
    private env: EngineEnvironment,
    config?: {
      polling?: BatchPollingConfig;
      retry?: BatchRetryConfig;
    }
  ) {
    this.batchConfig = {
      maxWaitMs: config?.polling?.maxWaitMs ?? 300000,      // 5 min default
      pollIntervalMs: config?.polling?.pollIntervalMs ?? 5000, // 5 sec default
    };
    this.retryConfig = {
      maxRetries: config?.retry?.maxRetries ?? 3,
      baseDelayMs: config?.retry?.baseDelayMs ?? 1000,      // 1 sec default
      maxDelayMs: config?.retry?.maxDelayMs ?? 8000,        // 8 sec cap
      onRetry: config?.retry?.onRetry,
      onAllFailed: config?.retry?.onAllFailed,
    };
  }

  async execute(request: LLMRequest): Promise<LLMResponse> {
    const { provider, mode } = request;

    // Get API key from environment using provider's envKeyName
    const apiKey = this.env[provider.envKeyName];
    if (!apiKey) {
      throw new Error(
        `Missing API key: ${provider.envKeyName} not found in environment`
      );
    }

    if (mode === 'batch') {
      return this.executeBatch(request, apiKey);
    }

    return this.executeSync(request, apiKey);
  }

  private async executeSync(request: LLMRequest, apiKey: string): Promise<LLMResponse> {
    const { provider, model, system, messages, maxTokens, reasoning, timeout } = request;
    const startTime = Date.now();

    // Format request using provider's method
    // NOTE: model is ModelDefinition, not string!
    const body = provider.formatRequest({
      model,
      system,
      messages,
      maxTokens,
      reasoning,
    });

    // Set up timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      timeout ?? DEFAULT_TIMEOUT_MS
    );

    try {
      // Make the request
      const response = await fetch(resolveProviderApiUrl(provider), {
        method: 'POST',
        headers: provider.getHeaders(apiKey),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const parsed = provider.parseError?.(errorData) ?? {
          code: 'http_error',
          message: `HTTP ${response.status}`,
          retryable: response.status === 429,
        };
        throw new Error(`${provider.name} API error: ${parsed.message}`);
      }

      // Parse response using provider's method
      const data = await response.json();
      const parsed = provider.parseResponse(data);

      // Apply provider-agnostic cleanup (unwrap code blocks, normalize whitespace)
      const content = cleanResponseContent(parsed.content);

      // Calculate cost using model's pricing
      const cost = this.calculateCost(model.pricing, parsed.usage);

      return {
        content,
        usage: parsed.usage,
        cost,
        metadata: {
          provider: provider.name,
          model: model.displayName,
          latencyMs: Date.now() - startTime,
          finishReason: parsed.finishReason,
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`${provider.name} request timed out after ${timeout ?? DEFAULT_TIMEOUT_MS}ms`);
      }
      throw error;
    }
  }

  /**
   * Submit a batch request (async - results come later)
   *
   * @param request - LLM request to submit
   * @param customId - Unique ID for tracking this request
   * @returns BatchJob with batchId for status checking
   */
  async submitBatch(request: LLMRequest, customId: string): Promise<BatchJob> {
    const { provider, model, system, messages, maxTokens, reasoning } = request;

    const apiKey = this.env[provider.envKeyName];
    if (!apiKey) {
      throw new Error(`Missing API key: ${provider.envKeyName} not found in environment`);
    }

    // Format request params using provider's method
    const params = provider.formatRequest({
      model,
      system,
      messages,
      maxTokens,
      reasoning,
    });

    // Anthropic batch endpoint
    const batchUrl = resolveBatchApiUrl(provider, '/messages/batches');

    const response = await fetch(batchUrl, {
      method: 'POST',
      headers: provider.getHeaders(apiKey),
      body: JSON.stringify({
        requests: [{
          custom_id: customId,
          params,
        }],
      }),
    });

    const data = await response.json() as {
      id?: string;
      processing_status?: string;
      expires_at?: string;
      error?: { message?: string };
    };

    if (!response.ok || !data.id) {
      throw new Error(`Batch submission failed: ${data.error?.message || `HTTP ${response.status}`}`);
    }

    return {
      batchId: data.id,
      customId,
      status: (data.processing_status || 'validating') as BatchJob['status'],
      expiresAt: data.expires_at,
      provider: provider.name,
      model: model.displayName,
    };
  }

  /**
   * Check status of a submitted batch
   *
   * @param batchId - Batch ID from submitBatch
   * @param provider - Provider definition (for API URL and auth)
   * @returns Current batch status
   */
  async checkBatchStatus(batchId: string, provider: LLMRequest['provider']): Promise<BatchStatus> {
    const apiKey = this.env[provider.envKeyName];
    if (!apiKey) {
      throw new Error(`Missing API key: ${provider.envKeyName} not found in environment`);
    }

    const statusUrl = resolveBatchApiUrl(provider, `/messages/batches/${batchId}`);

    const response = await fetch(statusUrl, {
      headers: provider.getHeaders(apiKey),
    });

    const data = await response.json() as {
      processing_status?: string;
      results_url?: string;
      request_counts?: BatchStatus['requestCounts'];
      ended_at?: string;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(`Batch status check failed: ${data.error?.message || `HTTP ${response.status}`}`);
    }

    return {
      status: (data.processing_status || 'in_progress') as BatchJob['status'],
      resultsUrl: data.results_url,
      requestCounts: data.request_counts,
      endedAt: data.ended_at,
    };
  }

  /**
   * Fetch results from a completed batch with exponential backoff retry
   *
   * Retries up to maxRetries times with exponential backoff on failure.
   * Optional callbacks allow platform to wire notifications (e.g., Telegram).
   *
   * @param resultsUrl - URL from checkBatchStatus (when status === 'ended')
   * @param provider - Provider definition (for auth)
   * @param model - Model definition (for cost calculation)
   * @returns Array of batch results
   */
  async fetchBatchResults(
    resultsUrl: string,
    provider: LLMRequest['provider'],
    model: ModelDefinition
  ): Promise<BatchResult[]> {
    const apiKey = this.env[provider.envKeyName];
    if (!apiKey) {
      throw new Error(`Missing API key: ${provider.envKeyName} not found in environment`);
    }

    const { maxRetries, baseDelayMs, maxDelayMs, onRetry, onAllFailed } = this.retryConfig;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(resultsUrl, {
          headers: provider.getHeaders(apiKey),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        // Results are JSONL format (one JSON object per line)
        const text = await response.text();
        const lines = text.trim().split('\n').filter(Boolean);

        return lines.map(line => {
          const item = JSON.parse(line) as {
            custom_id: string;
            result?: {
              type: string;
              message?: unknown;
              error?: { message?: string };
            };
          };

          if (item.result?.type === 'succeeded' && item.result.message) {
            const parsed = provider.parseResponse(item.result.message);
            const content = cleanResponseContent(parsed.content);
            const cost = this.calculateCost(model.pricing, parsed.usage);

            return {
              customId: item.custom_id,
              response: {
                content,
                usage: parsed.usage,
                cost: cost * CACHE_PRICING.batchDiscount, // 50% batch discount
                metadata: {
                  provider: provider.name,
                  model: model.displayName,
                  latencyMs: 0, // N/A for batch
                  finishReason: parsed.finishReason,
                },
              },
            };
          }

          return {
            customId: item.custom_id,
            error: item.result?.error?.message || 'Unknown error',
          };
        });
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));

        // If not last attempt, retry with exponential backoff
        if (attempt < maxRetries) {
          const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);

          // Notify via callback (platform can wire Telegram)
          if (onRetry) {
            await Promise.resolve(onRetry(attempt, maxRetries, lastError.message, delay));
          }

          await sleep(delay);
        }
      }
    }

    // All retries exhausted
    if (onAllFailed) {
      await Promise.resolve(onAllFailed(maxRetries, lastError?.message ?? 'Unknown error'));
    }

    throw new Error(`Batch results fetch failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  // Keep for backwards compatibility - redirects to submitBatch
  private async executeBatch(request: LLMRequest, _apiKey: string): Promise<LLMResponse> {
    // Generate a unique ID for this request
    const customId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Submit the batch
    const job = await this.submitBatch(request, customId);

    // For execute(), we need to wait for results (not ideal for long batches)
    // Uses configurable polling intervals
    const { maxWaitMs, pollIntervalMs } = this.batchConfig;
    const startTime = Date.now();

    // Safety: limit poll attempts to prevent infinite loops on unexpected statuses
    const maxPollAttempts = 100;
    let pollCount = 0;

    // Known valid statuses from Anthropic batch API
    const knownStatuses = ['in_progress', 'finalizing', 'validating', 'ended', 'canceled', 'expired', 'canceling'];

    while (Date.now() - startTime < maxWaitMs && pollCount < maxPollAttempts) {
      pollCount++;
      const status = await this.checkBatchStatus(job.batchId, request.provider);

      // Warn about unexpected statuses to help debug API changes
      if (!knownStatuses.includes(status.status)) {
        console.warn(`[RequestEngine] Unexpected batch status: "${status.status}" for batch ${job.batchId}`);
      }

      if (status.status === 'ended' && status.resultsUrl) {
        const results = await this.fetchBatchResults(status.resultsUrl, request.provider, request.model);
        const result = results.find(r => r.customId === customId);

        if (result?.response) {
          return result.response;
        }
        if (result?.error) {
          throw new Error(`Batch request failed: ${result.error}`);
        }
        throw new Error('Batch completed but result not found');
      }

      if (status.status === 'canceled' || status.status === 'expired') {
        throw new Error(`Batch ${status.status}`);
      }

      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    // Determine why loop exited for better error messaging
    if (pollCount >= maxPollAttempts) {
      throw new Error(`Batch polling exceeded ${maxPollAttempts} attempts (batchId: ${job.batchId})`);
    }

    throw new Error(`Batch timed out after ${maxWaitMs / 1000}s (batchId: ${job.batchId})`);
  }

  private calculateCost(
    pricing: ModelDefinition['pricing'],
    usage: ParsedResponse['usage']
  ): number {
    const inputCost = (usage.input * pricing.input) / 1_000_000;
    const outputCost = (usage.output * pricing.output) / 1_000_000;
    const cacheReadCost = ((usage.cacheRead ?? 0) * (pricing.cacheRead ?? 0)) / 1_000_000;
    const cacheWriteCost = ((usage.cacheWrite ?? 0) * (pricing.cacheWrite ?? 0)) / 1_000_000;

    return inputCost + outputCost + cacheReadCost + cacheWriteCost;
  }
}
