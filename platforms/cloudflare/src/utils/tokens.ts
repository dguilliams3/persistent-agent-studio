/**
 * @file worker/src/utils/tokens.js
 * @description Unified token counting utility supporting multiple providers
 *
 * Uses tiktoken WASM for OpenAI models (accurate, fast, offline)
 * Uses Anthropic countTokens API for Claude models (free, accurate)
 * Falls back to character estimation for unknown providers
 */

/**
 * @file worker/src/utils/tokens.js
 * @description Unified token counting utility supporting multiple providers
 *
 * Uses gpt-tokenizer (pure JS) for OpenAI models - works in Cloudflare Workers
 * Uses Anthropic countTokens API for Claude models (free, accurate)
 * Falls back to character estimation for unknown providers
 *
 * Note: tiktoken WASM doesn't work in Workers - gpt-tokenizer is the pure JS alternative
 */

import { encode, encodeChat } from 'gpt-tokenizer';
import { PROVIDERS } from '@persistence/core/providers';
import type { Env } from '../bootstrap.js';

const DEFAULT_OPENAI_MODEL = 'gpt-4';
const DEFAULT_ANTHROPIC_MODEL = PROVIDERS?.anthropic?.models?.sonnet?.id || 'claude-sonnet-4-6-20250514';

const PROVIDER_ALIASES = new Map([
  ['openai', 'openai'],
  ['azure-openai', 'openai'],
  ['azure_openai', 'openai'],
  ['azureopenai', 'openai'],
  ['anthropic', 'anthropic'],
  ['claude', 'anthropic']
]);

type TokenProvider = 'openai' | 'anthropic' | string;

interface TokenCountResult {
  tokens: number;
  model: string;
  provider: TokenProvider;
  method: 'gpt-tokenizer' | 'api' | 'estimated';
  error?: string;
}

interface CountTokensOptions {
  provider?: string;
  model?: string;
  apiKey?: string;
}

interface AnthropicCountResponse {
  input_tokens?: number;
  total_tokens?: number;
  tokens?: number;
  error?: {
    message?: string;
  } | string;
}

function ensureString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  return String(value);
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function normalizeProvider(provider?: string): string | undefined {
  if (!provider) return undefined;
  const lower = provider.toLowerCase();
  return PROVIDER_ALIASES.get(lower) || lower;
}

function isOpenAIModel(model = '') {
  if (!model) return false;
  const normalized = model.toLowerCase().replace(/^ft:/, '');
  return normalized.startsWith('gpt')
    || normalized.startsWith('text-davinci')
    || normalized.startsWith('text-curie')
    || normalized.startsWith('text-babbage')
    || normalized.startsWith('text-ada')
    || normalized.startsWith('text-embedding')
    || normalized.startsWith('o1')
    || normalized.startsWith('o3')
    || normalized.startsWith('o4')
    || normalized.startsWith('omni')
    || normalized.includes('gpt-');
}

function isAnthropicModel(model = '') {
  if (!model) return false;
  const normalized = model.toLowerCase();
  return normalized.startsWith('claude');
}

function inferProviderFromModel(model?: string): 'openai' | 'anthropic' | undefined {
  if (!model) return undefined;
  if (isOpenAIModel(model)) return 'openai';
  if (isAnthropicModel(model)) return 'anthropic';
  return undefined;
}

/**
 * @description Count tokens for text using gpt-tokenizer (pure JS, works in Workers)
 * Uses cl100k_base encoding which is accurate for GPT-4, GPT-3.5-turbo, and newer models
 *
 * @param {string} text - Text to tokenize
 * @param {string} [model='gpt-4'] - OpenAI model name (for metadata)
 * @returns {{tokens: number, model: string, provider: 'openai', method: string}}
 */
export function countTokensOpenAI(text: unknown, model = DEFAULT_OPENAI_MODEL): TokenCountResult {
  const safeText = ensureString(text);
  // gpt-tokenizer uses cl100k_base encoding (GPT-4 family)
  const tokens = encode(safeText).length;

  return {
    tokens,
    model,
    provider: 'openai',
    method: 'gpt-tokenizer'
  };
}

export async function countTokensAnthropic(text: unknown, apiKey?: string, model = DEFAULT_ANTHROPIC_MODEL): Promise<TokenCountResult> {
  const safeText = ensureString(text);

  if (!apiKey) {
    return {
      tokens: estimateTokens(safeText),
      model,
      provider: 'anthropic',
      method: 'estimated',
      error: 'No API key provided'
    };
  }

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
        messages: [{ role: 'user', content: safeText }]
      })
    });

    const data = await response.json() as AnthropicCountResponse;

    if (!response.ok || data.error) {
      const errObj = data?.error;
      const errorMessage = (typeof errObj === 'object' && errObj !== null ? errObj.message : errObj) || `HTTP ${response.status}`;
      throw new Error(String(errorMessage));
    }

    const tokens = typeof data.input_tokens === 'number'
      ? data.input_tokens
      : typeof data.total_tokens === 'number'
        ? data.total_tokens
        : data.tokens;

    if (typeof tokens === 'number') {
      return {
        tokens,
        model,
        provider: 'anthropic',
        method: 'api'
      };
    }

    throw new Error('Token count missing from response');
  } catch (error) {
    return {
      tokens: estimateTokens(safeText),
      model,
      provider: 'anthropic',
      method: 'estimated',
      error: error instanceof Error ? error.message : 'Token counting failed'
    };
  }
}

export async function countTokensUnified(text = '', options: CountTokensOptions = {}): Promise<TokenCountResult> {
  const safeText = ensureString(text);
  const {
    provider,
    model,
    apiKey
  } = options;

  const normalizedProvider = normalizeProvider(provider);
  const inferredProvider = normalizedProvider || inferProviderFromModel(model);

  if (inferredProvider === 'openai') {
    return countTokensOpenAI(safeText, model || DEFAULT_OPENAI_MODEL);
  }

  if (inferredProvider === 'anthropic' || !inferredProvider) {
    return countTokensAnthropic(safeText, apiKey, model || DEFAULT_ANTHROPIC_MODEL);
  }

  return {
    tokens: estimateTokens(safeText),
    model: model || 'unknown',
    provider: normalizedProvider || inferredProvider || 'unknown',
    method: 'estimated'
  };
}

export async function countTokensWithCurrentModel(text: unknown, db: D1Database, env?: Env): Promise<TokenCountResult> {
  const { getState } = await import('../db/index.js');

  const provider = (await getState(db, 'summarize_provider')) || 'anthropic';
  const model = await getState(db, 'summarize_model');

  return countTokensUnified(ensureString(text), {
    provider: provider as string,
    model: model as string,
    apiKey: env?.ANTHROPIC_API_KEY as string
  });
}
