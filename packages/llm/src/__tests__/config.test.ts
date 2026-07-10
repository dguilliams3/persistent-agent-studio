/**
 * @module @persistence/llm/__tests__/config.test
 * @description Unit tests for model config registry expansion.
 *
 * @covers ../config.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@persistence/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@persistence/db')>();
  return {
    ...actual,
    getState: vi.fn(),
    setState: vi.fn(),
  };
});

import { getState, setState } from '@persistence/db';
import { getModelConfig, setModelConfig } from '../config';

const mockDb = {} as never;

describe('LLM config registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes DeepSeek and Kimi in availableModels', async () => {
    vi.mocked(getState).mockResolvedValue(null);

    const config = await getModelConfig(mockDb, 'summarize');

    expect(config.availableModels.deepseek).toBeDefined();
    expect(config.availableModels.deepseek['deepseek-chat']).toBe('deepseek-chat');
    expect(config.availableModels.kimi).toBeDefined();
    expect(config.availableModels.kimi['kimi-k2.6']).toBe('kimi-k2.6');
  });

  it('accepts DeepSeek model config writes through shared validation', async () => {
    const result = await setModelConfig(
      mockDb,
      'summarize',
      'deepseek',
      'deepseek-v4-flash',
    );

    expect(result).toEqual({
      success: true,
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
    });
    expect(setState).toHaveBeenCalledWith(
      mockDb,
      'summarize_provider',
      'deepseek',
    );
    expect(setState).toHaveBeenCalledWith(
      mockDb,
      'summarize_model',
      'deepseek-v4-flash',
    );
  });

  it('accepts Kimi model config writes through shared validation', async () => {
    const result = await setModelConfig(mockDb, 'summarize', 'kimi', 'kimi-k2.7-code');

    expect(result).toEqual({
      success: true,
      provider: 'kimi',
      model: 'kimi-k2.7-code',
    });
  });
});
