/**
 * OpenAI Provider Definition
 *
 * @module @persistence/core/providers/openai
 *
 * Models: GPT-4o, GPT-4o Mini, GPT-5.2
 * Features: Vision, reasoning (GPT-5.x), streaming
 *
 * @see https://platform.openai.com/docs/models
 */

import { createOpenAICompatibleProvider } from './openaiCompatible';

export const openai = createOpenAICompatibleProvider({
  name: 'OpenAI',
  baseUrl: 'https://api.openai.com/v1',
  envKeyName: 'OPENAI_API_KEY',
  models: {
    'gpt-4o': {
      id: 'gpt-4o',
      displayName: 'GPT-4o',
      contextWindow: 128000,
      pricing: {
        input: 2.5,
        output: 10.0,
      },
      capabilities: {
        vision: true,
        reasoning: false,
        thinking: false,
        streaming: true,
      },
    },

    'gpt-4o-mini': {
      id: 'gpt-4o-mini',
      displayName: 'GPT-4o Mini',
      contextWindow: 128000,
      pricing: {
        input: 0.15,
        output: 0.6,
      },
      capabilities: {
        vision: true,
        reasoning: false,
        thinking: false,
        streaming: true,
      },
    },

    'gpt-5.2': {
      id: 'gpt-5.2',
      displayName: 'GPT-5.2',
      contextWindow: 200000,
      pricing: {
        input: 2.5,
        output: 10.0,
      },
      capabilities: {
        vision: true,
        reasoning: true,
        thinking: false,
        streaming: true,
      },
      quirks: {
        /**
         * GPT-5.2 reasoning bug workaround
         *
         * Even with reasoning_effort='none', GPT-5.2 consumes ~1500-2000
         * reasoning tokens from max_completion_tokens, leaving 0 for content.
         *
         * @see https://community.openai.com/t/reasoning-effort-none-is-not-being-respected-gpt-5-1/1366820
         */
        reasoningOverhead: 2000,
        tokenParamName: 'max_completion_tokens',
      },
    },
  },
});
