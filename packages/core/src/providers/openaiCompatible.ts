/**
 * OpenAI-compatible provider factory
 *
 * @module @persistence/core/providers/openaiCompatible
 * @description Shared request/response wiring for providers that implement the
 * OpenAI Chat Completions API surface with a custom base URL.
 */

import type {
  FormatRequestOptions,
  ModelDefinition,
  ParsedResponse,
  ProviderDefinition,
  TokenCount,
} from './types';

interface OpenAICompatibleProviderOptions {
  name: string;
  baseUrl: string;
  envKeyName: string;
  models: Readonly<Record<string, ModelDefinition>>;
}

export function createOpenAICompatibleProvider({
  name,
  baseUrl,
  envKeyName,
  models,
}: OpenAICompatibleProviderOptions): ProviderDefinition {
  return {
    name,

    api: {
      baseUrl,
      url: '/chat/completions',
    },

    envKeyName,

    models,

    getHeaders(apiKey: string): Record<string, string> {
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      };
    },

    formatRequest(opts: FormatRequestOptions): Record<string, unknown> {
      const { model, system, messages, maxTokens, reasoning } = opts;

      const tokenParam =
        model.quirks?.tokenParamName ??
        (model.capabilities.reasoning ? 'max_completion_tokens' : 'max_tokens');

      let adjustedMaxTokens = maxTokens;
      if (
        model.capabilities.reasoning &&
        reasoning === 'none' &&
        model.quirks?.reasoningOverhead
      ) {
        adjustedMaxTokens += model.quirks.reasoningOverhead;
        console.log(
          `[${name}] Applying reasoning bug workaround for ${model.id}: ` +
            `${maxTokens} + ${model.quirks.reasoningOverhead} = ${adjustedMaxTokens}`,
        );
      }

      const systemContent =
        typeof system === 'string' ? system : system.map((block) => block.text).join('\n\n');

      const body: Record<string, unknown> = {
        model: model.id,
        [tokenParam]: adjustedMaxTokens,
        messages: [{ role: 'system', content: systemContent }, ...messages],
      };

      if (model.capabilities.reasoning && reasoning !== undefined) {
        body.reasoning_effort = reasoning;
      }

      return body;
    },

    parseResponse(data: unknown): ParsedResponse {
      const response = data as {
        choices?: Array<{
          message?: { content?: string };
          finish_reason?: string;
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          completion_tokens_details?: {
            reasoning_tokens?: number;
          };
        };
      };

      const choice = response.choices?.[0];
      if (!choice?.message?.content) {
        throw new Error(`${name} returned empty content: ${JSON.stringify(response).slice(0, 200)}`);
      }

      const reasoningTokens = response.usage?.completion_tokens_details?.reasoning_tokens;
      if (reasoningTokens) {
        console.log(`[${name}] Reasoning tokens used: ${reasoningTokens}`);
      }

      return {
        content: choice.message.content,
        usage: {
          input: response.usage?.prompt_tokens ?? 0,
          output: response.usage?.completion_tokens ?? 0,
          reasoning: reasoningTokens,
        },
        finishReason:
          choice.finish_reason === 'stop'
            ? 'end_turn'
            : choice.finish_reason === 'length'
              ? 'max_tokens'
              : undefined,
      };
    },

    parseError(error: unknown): { code: string; message: string; retryable: boolean } {
      const err = error as { error?: { type?: string; message?: string; code?: string }; status?: number };

      return {
        code: err.error?.code ?? err.error?.type ?? 'unknown_error',
        message: err.error?.message ?? `Unknown ${name} error`,
        retryable: err.status === 429,
      };
    },

    async countTokens(text, _model, _apiKey): Promise<TokenCount> {
      const CHARS_PER_TOKEN = 4;
      return {
        tokens: Math.ceil((text?.length ?? 0) / CHARS_PER_TOKEN),
        precise: false,
      };
    },
  };
}
