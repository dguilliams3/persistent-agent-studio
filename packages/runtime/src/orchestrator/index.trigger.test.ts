/**
 * Honest trigger tests — F-B10 (RUN-20260712-2013)
 *
 * A queued user-message followup must stamp cycles.trigger = "user_message",
 * not generic cron/think-now vocabulary.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createCycleMock,
  getStateMock,
  setStateMock,
  recordAdaptiveCadenceAfterWakeAdmissionMock,
  runGuardsMock,
  checkQuickFollowupMock,
  resolveProviderConfigMock,
  runNonAnthropicCycleMock,
} = vi.hoisted(() => ({
  createCycleMock: vi.fn(),
  getStateMock: vi.fn(),
  setStateMock: vi.fn(),
  recordAdaptiveCadenceAfterWakeAdmissionMock: vi.fn(),
  runGuardsMock: vi.fn(),
  checkQuickFollowupMock: vi.fn(),
  resolveProviderConfigMock: vi.fn(),
  runNonAnthropicCycleMock: vi.fn(),
}));

vi.mock('@persistence/db', () => ({
  getState: getStateMock,
  setState: setStateMock,
  createCycle: createCycleMock,
}));

vi.mock('./prechecks', () => ({
  runGuards: runGuardsMock,
  checkQuickFollowup: checkQuickFollowupMock,
  resolveProviderConfig: resolveProviderConfigMock,
}));

vi.mock('../loop/guards', () => ({
  recordAdaptiveCadenceAfterWakeAdmission: recordAdaptiveCadenceAfterWakeAdmissionMock,
}));

vi.mock('./providers', () => ({
  runNonAnthropicCycle: runNonAnthropicCycleMock,
  runAnthropicCycle: vi.fn(),
}));

import { runThinkingCycle } from './index';

describe('runThinkingCycle trigger honesty', () => {
  beforeEach(() => {
    createCycleMock.mockReset();
    getStateMock.mockReset();
    setStateMock.mockReset();
    recordAdaptiveCadenceAfterWakeAdmissionMock.mockReset();
    runGuardsMock.mockReset();
    checkQuickFollowupMock.mockReset();
    resolveProviderConfigMock.mockReset();
    runNonAnthropicCycleMock.mockReset();

    getStateMock.mockImplementation(async (_db: unknown, key: string) => {
      if (key === 'quick_followup_at') return new Date(Date.now() - 1_000).toISOString();
      if (key === 'quick_followup_reason') return 'user_message';
      if (key === 'loop_count') return '0';
      return undefined;
    });
    runGuardsMock.mockResolvedValue(null);
    checkQuickFollowupMock.mockResolvedValue('user_message');
    resolveProviderConfigMock.mockResolvedValue({
      model: 'test-model',
      provider: 'openai',
      maxOutputTokens: 1000,
    });
    createCycleMock.mockResolvedValue(42);
    runNonAnthropicCycleMock.mockResolvedValue({ success: true, cycleId: 42 });
  });

  it('records user_message when a queued inbound followup caused the wake', async () => {
    const result = await runThinkingCycle(
      {
        db: {} as never,
        llm: {} as never,
        callbacks: {
          buildSystemPrompt: vi.fn().mockResolvedValue({
            cacheStrategy: {
              cycleInterval: 300,
              ttl: 60,
              useVolatileCaching: false,
              historyPrefixSize: 0,
              actualTailSize: 0,
            },
          }),
          buildUserContent: vi.fn().mockResolvedValue([]),
        },
      } as never,
      { fromCron: true },
    );

    expect(createCycleMock).toHaveBeenCalledWith(
      {} as never,
      expect.objectContaining({ trigger: 'user_message' }),
    );
    expect(result).toEqual({ success: true, cycleId: 42 });
  });
});
