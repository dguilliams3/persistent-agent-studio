/**
 * @module @persistence/core/__tests__/providers-compat.test
 * @description Unit tests for OpenAI-compatible third-party provider entries.
 *
 * @covers ../providers/deepseek.ts
 * @covers ../providers/kimi.ts
 * @covers ../providers/availability.ts
 */

import { describe, expect, it } from 'vitest';
import { deepseek, kimi, getProviderAvailabilityMap } from '../providers';

describe('deepseek provider', () => {
  it('uses the official base URL and env key', () => {
    expect(deepseek.api.baseUrl).toBe('https://api.deepseek.com');
    expect(deepseek.api.url).toBe('/chat/completions');
    expect(deepseek.envKeyName).toBe('DEEPSEEK_API_KEY');
  });

  it('registers the current and compatibility model IDs', () => {
    expect(deepseek.models['deepseek-chat']?.id).toBe('deepseek-chat');
    expect(deepseek.models['deepseek-reasoner']?.id).toBe('deepseek-reasoner');
    expect(deepseek.models['deepseek-v4-flash']?.id).toBe('deepseek-v4-flash');
    expect(deepseek.models['deepseek-v4-pro']?.id).toBe('deepseek-v4-pro');
  });
});

describe('kimi provider', () => {
  it('uses the international Moonshot base URL and env key', () => {
    expect(kimi.api.baseUrl).toBe('https://api.moonshot.ai/v1');
    expect(kimi.api.url).toBe('/chat/completions');
    expect(kimi.envKeyName).toBe('MOONSHOT_API_KEY');
  });

  it('registers the current K2 family', () => {
    expect(kimi.models['kimi-k2.7-code']?.id).toBe('kimi-k2.7-code');
    expect(kimi.models['kimi-k2.7-code-highspeed']?.id).toBe('kimi-k2.7-code-highspeed');
    expect(kimi.models['kimi-k2.6']?.id).toBe('kimi-k2.6');
    expect(kimi.models['kimi-k2.5']?.id).toBe('kimi-k2.5');
  });
});

describe('getProviderAvailabilityMap()', () => {
  it('reports missing and present secrets by provider env key', () => {
    const status = getProviderAvailabilityMap((envKeyName) => {
      if (envKeyName === 'OPENAI_API_KEY' || envKeyName === 'MOONSHOT_API_KEY') {
        return 'configured';
      }
      return '';
    });

    expect(status.openai.available).toBe(true);
    expect(status.kimi.available).toBe(true);
    expect(status.deepseek.available).toBe(false);
    expect(status.deepseek.reason).toBe('Missing secret DEEPSEEK_API_KEY');
  });
});
