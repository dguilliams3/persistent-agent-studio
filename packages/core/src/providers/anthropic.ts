/**
 * Anthropic Provider Definition
 *
 * @module @persistence/core/providers/anthropic
 *
 * Models: Claude 3.5 Haiku, Claude 4.6 Sonnet, Claude 4.6 Opus
 * Features: Prompt caching, vision, streaming
 *
 * @see https://docs.anthropic.com/en/docs/about-claude/models
 */

import type { ProviderDefinition, FormatRequestOptions, ParsedResponse, TokenCount } from './types';

export const anthropic: ProviderDefinition = {
  name: 'Anthropic',

  api: {
    url: 'https://api.anthropic.com/v1/messages',
    version: '2023-06-01',
  },

  envKeyName: 'ANTHROPIC_API_KEY',

  models: {
    haiku: {
      id: 'claude-haiku-4-5-20250514',
      displayName: 'Claude 4.5 Haiku',
      contextWindow: 200000,
      pricing: {
        input: 0.80,
        output: 4.00,
        cacheRead: 0.08,
        cacheWrite: 1.00,
      },
      capabilities: {
        vision: true,
        reasoning: false,
        thinking: false,
        streaming: true,
      },
    },

    sonnet: {
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
        thinking: false,
        streaming: true,
      },
    },

    opus: {
      id: 'claude-opus-4-6',
      displayName: 'Claude 4.6 Opus',
      contextWindow: 200000,
      pricing: {
        input: 5.00,      // Updated: $5/MTok input
        output: 25.00,    // 5x ratio: $25/MTok output
        cacheRead: 0.50,  // 10% of input
        cacheWrite: 6.25, // 125% of input
      },
      capabilities: {
        vision: true,
        reasoning: false,
        thinking: true,  // Opus supports extended thinking
        streaming: true,
      },
    },
  },

  getHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': this.api.version!,
    };
  },

  formatRequest(opts: FormatRequestOptions): Record<string, unknown> {
    const { model, system, messages, maxTokens } = opts;

    // Handle system as string or cache-aware blocks
    const systemContent = typeof system === 'string'
      ? system
      : system;  // Already in block format

    return {
      model: model.id,
      max_tokens: maxTokens,
      system: systemContent,
      messages,
    };
  },

  parseResponse(data: unknown): ParsedResponse {
    const response = data as {
      content?: Array<{ type: string; text?: string }>;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
      };
      stop_reason?: string;
    };

    // Extract text from content blocks
    const textBlock = response.content?.find(b => b.type === 'text');
    if (!textBlock?.text) {
      throw new Error(
        `Anthropic returned empty content: ${JSON.stringify(response).slice(0, 200)}`
      );
    }

    return {
      content: textBlock.text,
      usage: {
        input: response.usage?.input_tokens ?? 0,
        output: response.usage?.output_tokens ?? 0,
        cacheRead: response.usage?.cache_read_input_tokens,
        cacheWrite: response.usage?.cache_creation_input_tokens,
      },
      finishReason: response.stop_reason === 'end_turn' ? 'end_turn' : undefined,
    };
  },

  parseError(error: unknown): { code: string; message: string; retryable: boolean } {
    const err = error as { error?: { type?: string; message?: string }; status?: number };

    return {
      code: err.error?.type ?? 'unknown_error',
      message: err.error?.message ?? 'Unknown Anthropic error',
      retryable: err.status === 429 || err.status === 529,  // Rate limit or overload
    };
  },

  async countTokens(text, model, apiKey): Promise<TokenCount> {
    // Anthropic's free token counting API
    const response = await fetch('https://api.anthropic.com/v1/messages/count_tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': this.api.version!,
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: model.id,
        messages: [{ role: 'user', content: text }],
      }),
    });

    const data = await response.json() as {
      input_tokens?: number;
      error?: { message?: string };
    };

    if (data.error) {
      throw new Error(`Token counting failed: ${data.error.message}`);
    }

    return {
      tokens: data.input_tokens ?? 0,
      precise: true,  // From actual API
    };
  },
};
