/**
 * DeepSeek provider definition
 *
 * @module @persistence/core/providers/deepseek
 *
 * Official docs verified 2026-07-05:
 * - Base URL: https://api.deepseek.com
 * - Current models: deepseek-v4-flash, deepseek-v4-pro
 * - Compatibility aliases (deprecated 2026-07-24): deepseek-chat, deepseek-reasoner
 *
 * @see https://api-docs.deepseek.com/
 * @see https://api-docs.deepseek.com/quick_start/pricing
 */

import { createOpenAICompatibleProvider } from './openaiCompatible';

export const deepseek = createOpenAICompatibleProvider({
  name: 'DeepSeek',
  baseUrl: 'https://api.deepseek.com',
  envKeyName: 'DEEPSEEK_API_KEY',
  models: {
    'deepseek-chat': {
      id: 'deepseek-chat',
      displayName: 'DeepSeek Chat (compat alias, deprecated 2026-07-24)',
      contextWindow: 1_000_000,
      pricing: {
        input: 0.14,
        output: 0.28,
      },
      capabilities: {
        vision: false,
        reasoning: false,
        thinking: false,
        streaming: true,
      },
      quirks: {
        tokenParamName: 'max_tokens',
      },
    },
    'deepseek-reasoner': {
      id: 'deepseek-reasoner',
      displayName: 'DeepSeek Reasoner (compat alias, deprecated 2026-07-24)',
      contextWindow: 1_000_000,
      pricing: {
        input: 0.14,
        output: 0.28,
      },
      capabilities: {
        vision: false,
        reasoning: false,
        thinking: false,
        streaming: true,
      },
      quirks: {
        tokenParamName: 'max_tokens',
      },
    },
    'deepseek-v4-flash': {
      id: 'deepseek-v4-flash',
      displayName: 'DeepSeek V4 Flash',
      contextWindow: 1_000_000,
      pricing: {
        input: 0.14,
        output: 0.28,
      },
      capabilities: {
        vision: false,
        reasoning: false,
        thinking: false,
        streaming: true,
      },
      quirks: {
        tokenParamName: 'max_tokens',
      },
    },
    'deepseek-v4-pro': {
      id: 'deepseek-v4-pro',
      displayName: 'DeepSeek V4 Pro',
      contextWindow: 1_000_000,
      pricing: {
        input: 0.435,
        output: 0.87,
      },
      capabilities: {
        vision: false,
        reasoning: false,
        thinking: false,
        streaming: true,
      },
      quirks: {
        tokenParamName: 'max_tokens',
      },
    },
  },
});
