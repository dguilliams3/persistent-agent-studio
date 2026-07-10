/**
 * Token counting service using Anthropic's countTokens API
 *
 * @module services/tokenizer
 * @description Provides accurate token counting using Anthropic's official API.
 * Unlike character-based estimation (~3.5 chars/token), this returns the exact
 * token count for any text using Claude's actual tokenizer.
 *
 * The countTokens API is free (no token cost) and fast (~100ms latency).
 * Use this for accurate cost estimation and context window management.
 *
 * @upstream Called by:
 *   - /count-tokens API endpoint
 *   - Future: context assembly for precise token budgeting
 *
 * @downstream Calls:
 *   - Anthropic countTokens API (POST /v1/messages/count_tokens)
 *
 * @example
 * const { tokens, error } = await countTokens('Hello world', env.ANTHROPIC_API_KEY);
 * if (tokens !== undefined) {
 *   console.log(`Exact token count: ${tokens}`);
 * }
 */

import { PROVIDERS } from '@persistence/core/providers';
import { countTokensUnified } from '../utils/tokens.js';
import type { Env } from '../bootstrap.js';

type TokenCountOptions = { model?: string };
type TokenMessage = { role: string; content: string };
type TokenCountApiResponse = {
  input_tokens?: number;
  error?: { message?: string };
};

/**
 * @description Count tokens for text using Anthropic's official tokenizer API
 *
 * This is more accurate than character-based estimation (which assumes ~3.5 chars/token).
 * The API call is free - no tokens are charged for counting.
 *
 * @upstream Called by: /count-tokens endpoint, context assembly
 * @downstream Calls: Anthropic countTokens API
 *
 * @param {string} text - The text to count tokens for
 * @param {string} apiKey - Anthropic API key
 * @param {Object} [options] - Optional configuration
 * @param {string} [options.model] - Model to use for tokenization (default: sonnet)
 * @returns {Promise<{tokens?: number, error?: string}>} Token count or error
 *
 * @example
 * // Simple usage
 * const result = await countTokens('Hello world', apiKey);
 * // { tokens: 3 }
 *
 * @example
 * // With specific model (different models may tokenize differently)
 * const result = await countTokens(longText, apiKey, { model: 'opus' });
 *
 * @note Token counts are model-specific. Different models may produce slightly
 *       different counts for the same text (though usually identical for Claude models).
 */
export async function countTokens(text: string, apiKey: string, options: TokenCountOptions = {}) {
  const model = options.model || PROVIDERS.anthropic.models.sonnet.id;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages/count_tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: text
        }]
      })
    });

    const data = await response.json() as TokenCountApiResponse;

    if (data.error) {
      return { error: data.error.message || 'Token counting failed' };
    }

    return { tokens: data.input_tokens };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * @description Count tokens for a system prompt and messages
 *
 * Counts the total tokens that would be used in a full API call,
 * including system prompt and all messages.
 *
 * @upstream Called by: Context window size calculation
 * @downstream Calls: Anthropic countTokens API
 *
 * @param {Object} params - Parameters matching Anthropic message format
 * @param {string} params.system - System prompt text
 * @param {Array<{role: string, content: string}>} params.messages - Message array
 * @param {string} apiKey - Anthropic API key
 * @param {Object} [options] - Optional configuration
 * @param {string} [options.model] - Model to use (default: sonnet)
 * @returns {Promise<{tokens?: number, error?: string}>} Token count or error
 *
 * @example
 * const result = await countContextTokens({
 *   system: 'You are a helpful assistant.',
 *   messages: [{ role: 'user', content: 'Hello' }]
 * }, apiKey);
 */
export async function countContextTokens(
  { system, messages }: { system?: string; messages?: TokenMessage[] },
  apiKey: string,
  options: TokenCountOptions = {}
) {
  const model = options.model || PROVIDERS.anthropic.models.sonnet.id;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages/count_tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        model,
        system: system || undefined,
        messages: messages || [{ role: 'user', content: '' }]
      })
    });

    const data = await response.json() as TokenCountApiResponse;

    if (data.error) {
      return { error: data.error.message || 'Token counting failed' };
    }

    return { tokens: data.input_tokens };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * @description Count tokens using the appropriate provider's tokenizer
 *
 * Uses Anthropic's free countTokens API for Claude models,
 * and tiktoken-compatible estimation for OpenAI models.
 *
 * @upstream Called by: addSummary(), buildSystemPrompt(), /count-tokens endpoint
 * @downstream Calls: Anthropic API (for anthropic), local estimation (for openai)
 *
 * @param {string} text - Text to count tokens for
 * @param {Object} env - Environment with API keys
 * @param {Object} [options] - Options
 * @param {string} [options.provider='anthropic'] - Provider ('anthropic' | 'openai')
 * @param {string} [options.model] - Specific model for tokenization
 * @returns {Promise<{tokens: number, model: string, provider: string}>}
 */
export async function countTokensForProvider(text = '', env: Env, options: Record<string, unknown> = {}): Promise<{ tokens: number; model: string; provider: string; method: string; error?: string }> {
  return countTokensUnified(text, {
    ...options,
    apiKey: env.ANTHROPIC_API_KEY as string
  });
}


/**
 * @description Get token count for text using currently configured summarization model
 *
 * Convenience function that reads provider/model from state.
 *
 * @param {string} text - Text to count
 * @param {D1Database} db - Database instance
 * @param {Object} env - Environment
 * @returns {Promise<{tokens: number, model: string, provider: string}>}
 */
export async function countTokensWithCurrentModel(text: string, db: D1Database, env: Env): Promise<{ tokens: number; model: string; provider: string; method: string; error?: string }> {
  const { countTokensWithCurrentModel: unified } = await import('../utils/tokens.js');
  return unified(text, db, env);
}

