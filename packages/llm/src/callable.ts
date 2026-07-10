/**
 * Factory function for creating CallableModel instances
 *
 * @module @persistence/llm/callable
 * @description Creates strongly-typed model interfaces that wrap RequestEngine
 *
 * This is the bridge between the type-safe CallableModel interface and the
 * existing RequestEngine implementation. Each CallableModel instance is bound
 * to a specific provider and model, ensuring compile-time safety for
 * provider-specific parameters (thinking for Anthropic, reasoning for OpenAI).
 *
 * @upstream Called by:
 *   - createLLM() factory (Step 2.3)
 *   - Platform layer (future migration)
 * @downstream Calls:
 *   - RequestEngine (packages/llm/src/engine/engine.ts)
 *   - Provider definitions (packages/core/src/providers/)
 *
 * @example
 * import { anthropic } from '@persistence/core/providers';
 * import { createCallableModel } from '@persistence/llm/callable';
 *
 * const opus = createCallableModel(
 *   anthropic,
 *   anthropic.models.opus,
 *   env.ANTHROPIC_API_KEY
 * );
 *
 * // Type-safe: thinking only valid for Anthropic
 * const result = await opus.sync({
 *   system: 'You are Clio',
 *   messages: [{ role: 'user', content: 'Think deeply' }],
 *   maxTokens: 8192,
 *   thinking: { budgetTokens: 4096 }
 * });
 */

import type { ModelDefinition, ProviderDefinition } from '@persistence/core/providers';
import type { SecretsProvider } from '@persistence/core';
import type {
  CallableModel,
  CallableProvider,
  BaseCallParams,
  AnthropicCallParams,
  OpenAICallParams,
  CallResult,
  BatchHandle,
  CancelBatchResult,
  LLM,
  AnthropicProvider,
  OpenAIProvider,
} from './types';
import type { BatchStatus, BatchResult, LLMRequest } from './engine';
import { RequestEngine } from './engine/index.js';
import { anthropic, openai } from '@persistence/core/providers';
import { resolveBatchApiUrl } from './providerUrls';

/**
 * Create a callable model instance
 *
 * @description Factory function that creates a strongly-typed CallableModel
 * interface wrapping RequestEngine. The returned object is bound to a specific
 * provider and model, with TParams enforcing provider-specific call parameters.
 *
 * @typeParam TParams - Call parameters type (AnthropicCallParams or OpenAICallParams)
 *
 * @param provider - Provider definition (anthropic, openai)
 * @param model - Model definition from provider.models
 * @param apiKey - API key for authentication
 * @returns Callable model with sync and batch methods
 *
 * @example
 * // Anthropic model with thinking support
 * const opus = createCallableModel<AnthropicCallParams>(
 *   anthropic,
 *   anthropic.models.opus,
 *   env.ANTHROPIC_API_KEY
 * );
 *
 * // OpenAI model with reasoning support
 * const gpt52 = createCallableModel<OpenAICallParams>(
 *   openai,
 *   openai.models['gpt-5.2'],
 *   env.OPENAI_API_KEY
 * );
 */
export function createCallableModel<TParams extends BaseCallParams>(
  provider: ProviderDefinition,
  model: ModelDefinition,
  apiKey: string
): CallableModel<TParams> {
  // Create engine instance with API key in environment format
  const engine = new RequestEngine({
    [provider.envKeyName]: apiKey,
  });

  return {
    definition: model,

    async sync(params: TParams): Promise<CallResult> {
      // Build the request with explicit type safety
      const request: LLMRequest = {
        provider,
        model,
        mode: 'sync',
        system: params.system,
        messages: params.messages,
        maxTokens: params.maxTokens,
      };

      // Add provider-specific params with proper typing
      if ('thinking' in params && params.thinking) {
        request.thinking = params.thinking as { budgetTokens: number };
      }
      if ('reasoning' in params && params.reasoning) {
        request.reasoning = params.reasoning as LLMRequest['reasoning'];
      }

      // Execute via RequestEngine
      const response = await engine.execute(request);

      // Map LLMResponse to CallResult (simpler interface)
      return {
        content: response.content,
        usage: response.usage,
        cost: response.cost,
        model: model.displayName,
      };
    },

    async batch(params: TParams & { customId: string }): Promise<BatchHandle> {
      const { customId } = params;

      // Build the request with explicit type safety
      const request: LLMRequest = {
        provider,
        model,
        mode: 'batch',
        system: params.system,
        messages: params.messages,
        maxTokens: params.maxTokens,
      };

      // Add provider-specific params with proper typing
      if ('thinking' in params && params.thinking) {
        request.thinking = params.thinking as { budgetTokens: number };
      }
      if ('reasoning' in params && params.reasoning) {
        request.reasoning = params.reasoning as LLMRequest['reasoning'];
      }

      // Submit batch via RequestEngine
      const job = await engine.submitBatch(request, customId);

      // Map BatchJob to BatchHandle (simpler interface)
      return {
        batchId: job.batchId,
        status: job.status === 'validating' ? 'pending' :
                job.status === 'in_progress' ? 'processing' :
                'pending', // Default fallback
      };
    },
  };
}

/**
 * Create a callable provider with batch utilities
 *
 * @description Factory function that creates a CallableProvider interface
 * wrapping RequestEngine's batch management methods. Individual models are
 * added as properties by createLLM().
 *
 * @typeParam TParams - Call parameters type (AnthropicCallParams or OpenAICallParams)
 *
 * @param provider - Provider definition (anthropic, openai)
 * @param apiKey - API key for authentication
 * @returns Callable provider with checkBatch, fetchResults, cancelBatch methods
 *
 * @upstream Called by: createLLM()
 * @downstream Calls: RequestEngine batch methods
 *
 * @example
 * const provider = createCallableProvider<AnthropicCallParams>(
 *   anthropic,
 *   apiKey
 * );
 * const status = await provider.checkBatch('batch_abc123');
 */
export function createCallableProvider<TParams extends BaseCallParams>(
  provider: ProviderDefinition,
  apiKey: string
): CallableProvider<TParams> {
  // Create engine instance with API key
  const engine = new RequestEngine({
    [provider.envKeyName]: apiKey,
  });

  return {
    definition: provider,

    async checkBatch(batchId: string): Promise<BatchStatus> {
      return engine.checkBatchStatus(batchId, provider);
    },

    async fetchResults(resultsUrl: string): Promise<BatchResult[]> {
      // Need a model for cost calculation - use first available
      const firstModel = Object.values(provider.models)[0];
      return engine.fetchBatchResults(resultsUrl, provider, firstModel);
    },

    async cancelBatch(batchId: string): Promise<CancelBatchResult> {
      // Use provider's batch API to cancel
      const batchUrl = resolveBatchApiUrl(
        provider,
        `/messages/batches/${batchId}/cancel`
      );

      const response = await fetch(batchUrl, {
        method: 'POST',
        headers: provider.getHeaders(apiKey),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `HTTP ${response.status}: ${JSON.stringify(errorData)}`,
        };
      }

      const data = await response.json() as {
        processing_status?: string;
        [key: string]: unknown;
      };

      return {
        success: true,
        status: data.processing_status || 'canceling',
        cancelInitiatedAt: new Date().toISOString(),
      };
    },
  };
}

/**
 * Create unified LLM interface from secrets
 *
 * @description Factory function that creates a fully-typed LLM interface.
 * Retrieves API keys from SecretsProvider and wires up all providers/models.
 *
 * Provider-specific parameters are enforced at compile time:
 * - llm.anthropic.*.sync() accepts `thinking` (AnthropicCallParams)
 * - llm.openai.*.sync() accepts `reasoning` (OpenAICallParams)
 *
 * @param secrets - SecretsProvider with API keys
 * @returns Typed LLM interface with all providers and models
 *
 * @upstream Called by: Platform bootstrap (platforms/cloudflare/src/bootstrap.ts)
 * @downstream Calls: createCallableProvider(), createCallableModel()
 *
 * @example
 * import { createLLM } from '@persistence/llm';
 *
 * const llm = await createLLM(secrets);
 *
 * // Anthropic with thinking
 * const result = await llm.anthropic.opus.sync({
 *   system: 'You are Clio',
 *   messages: [{ role: 'user', content: 'Think deeply' }],
 *   maxTokens: 8192,
 *   thinking: { budgetTokens: 4096 }
 * });
 *
 * // OpenAI with reasoning
 * const summary = await llm.openai['gpt-5.2'].sync({
 *   system: 'Summarize concisely',
 *   messages: [{ role: 'user', content: historyText }],
 *   maxTokens: 1500,
 *   reasoning: 'none'
 * });
 *
 * // Batch operations
 * const handle = await llm.anthropic.sonnet.batch({
 *   customId: 'cycle-42',
 *   system: '...',
 *   messages: [...],
 *   maxTokens: 8192
 * });
 * const status = await llm.anthropic.checkBatch(handle.batchId);
 */
export async function createLLM(secrets: SecretsProvider): Promise<LLM> {
  // Retrieve API keys from secrets provider
  const anthropicKey = await secrets.get('ANTHROPIC_API_KEY');
  const openaiKey = await secrets.get('OPENAI_API_KEY');

  // Create base providers with batch utilities
  const anthropicProvider = createCallableProvider<AnthropicCallParams>(
    anthropic,
    anthropicKey || ''
  );
  const openaiProvider = createCallableProvider<OpenAICallParams>(
    openai,
    openaiKey || ''
  );

  // Wire up Anthropic models
  const anthropicWithModels: AnthropicProvider = {
    ...anthropicProvider,
    opus: createCallableModel<AnthropicCallParams>(
      anthropic,
      anthropic.models.opus,
      anthropicKey || ''
    ),
    sonnet: createCallableModel<AnthropicCallParams>(
      anthropic,
      anthropic.models.sonnet,
      anthropicKey || ''
    ),
    haiku: createCallableModel<AnthropicCallParams>(
      anthropic,
      anthropic.models.haiku,
      anthropicKey || ''
    ),
  };

  // Wire up OpenAI models
  const openaiWithModels: OpenAIProvider = {
    ...openaiProvider,
    'gpt-4o': createCallableModel<OpenAICallParams>(
      openai,
      openai.models['gpt-4o'],
      openaiKey || ''
    ),
    'gpt-4o-mini': createCallableModel<OpenAICallParams>(
      openai,
      openai.models['gpt-4o-mini'],
      openaiKey || ''
    ),
    'gpt-5.2': createCallableModel<OpenAICallParams>(
      openai,
      openai.models['gpt-5.2'],
      openaiKey || ''
    ),
  };

  return {
    anthropic: anthropicWithModels,
    openai: openaiWithModels,
  };
}
