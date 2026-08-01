/**
 * Kimi provider definition
 *
 * @module @persistence/core/providers/kimi
 *
 * Official docs verified 2026-07-05:
 * - Base URL: https://api.moonshot.ai/v1
 * - Current K2 family: kimi-k2.7-code, kimi-k2.7-code-highspeed, kimi-k2.6, kimi-k2.5
 *
 * @see https://platform.kimi.ai/docs/guide/start-using-kimi-api
 * @see https://platform.kimi.ai/docs/models
 */

import { createOpenAICompatibleProvider } from './openaiCompatible';

export const kimi = createOpenAICompatibleProvider({
  name: 'Kimi',
  baseUrl: 'https://api.moonshot.ai/v1',
  envKeyName: 'MOONSHOT_API_KEY',
  models: {
    'kimi-k2.7-code': {
      id: 'kimi-k2.7-code',
      displayName: 'Kimi K2.7 Code',
      contextWindow: 256_000,
      pricing: {
        input: 0.95,
        output: 4.0,
        cacheRead: 0.19,
      },
      capabilities: {
        vision: true,
        reasoning: false,
        thinking: false,
        streaming: true,
      },
    },
    'kimi-k2.7-code-highspeed': {
      id: 'kimi-k2.7-code-highspeed',
      displayName: 'Kimi K2.7 Code HighSpeed',
      contextWindow: 256_000,
      pricing: {
        input: 0.95,
        output: 4.0,
        cacheRead: 0.19,
      },
      capabilities: {
        vision: true,
        reasoning: false,
        thinking: false,
        streaming: true,
      },
    },
    'kimi-k2.6': {
      id: 'kimi-k2.6',
      displayName: 'Kimi K2.6',
      contextWindow: 256_000,
      pricing: {
        input: 0.95,
        output: 4.0,
        cacheRead: 0.16,
      },
      capabilities: {
        vision: true,
        reasoning: false,
        thinking: false,
        streaming: true,
      },
    },
    'kimi-k2.5': {
      id: 'kimi-k2.5',
      displayName: 'Kimi K2.5',
      contextWindow: 256_000,
      pricing: {
        input: 0.6,
        output: 3.0,
        cacheRead: 0.1,
      },
      capabilities: {
        vision: true,
        reasoning: false,
        thinking: false,
        streaming: true,
      },
    },
  },
});
