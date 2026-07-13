/**
 * Cost rollup tests — Phase 2 (RUN-20260712-2013)
 *
 * Verifies that completed cycles contribute their fractional estimated cost to
 * personas.total_cost_cents through the db helper, making the schema invariant
 * true instead of aspirational.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getStateMock,
  setStateMock,
  logHistoryMock,
  updateCycleMetricsMock,
  calculateCostCentsMock,
  incrementPersonaCostCentsMock,
} = vi.hoisted(() => ({
  getStateMock: vi.fn(),
  setStateMock: vi.fn(),
  logHistoryMock: vi.fn(),
  updateCycleMetricsMock: vi.fn(),
  calculateCostCentsMock: vi.fn(),
  incrementPersonaCostCentsMock: vi.fn(),
}));

vi.mock('@persistence/db', () => ({
  getState: getStateMock,
  setState: setStateMock,
  logHistory: logHistoryMock,
  updateCycleMetrics: updateCycleMetricsMock,
  calculateCostCents: calculateCostCentsMock,
  incrementPersonaCostCents: incrementPersonaCostCentsMock,
}));

vi.mock('@persistence/llm', () => ({
  parseClaudeResponse: vi.fn(),
}));

import { parseClaudeResponse } from '@persistence/llm';
import { processResponse } from './response';

describe('processResponse cost rollup', () => {
  beforeEach(() => {
    getStateMock.mockReset();
    setStateMock.mockReset();
    logHistoryMock.mockReset();
    updateCycleMetricsMock.mockReset();
    calculateCostCentsMock.mockReset();
    incrementPersonaCostCentsMock.mockReset();
    vi.mocked(parseClaudeResponse).mockReset();
  });

  it('adds the computed cost into personas.total_cost_cents on successful usage-bearing cycles', async () => {
    vi.mocked(parseClaudeResponse).mockReturnValue({
      success: true,
      actions: [{ action: 'MESSAGE_USER' }],
      meters: null,
      note: null,
    } as never);
    calculateCostCentsMock.mockReturnValue(12.345);
    getStateMock.mockResolvedValue('false');

    const result = await processResponse(
      {} as never,
      {
        callbacks: {
          executeActions: vi.fn().mockResolvedValue({
            executed: [{ action: 'MESSAGE_USER' }],
            failed: [],
          }),
        },
      } as never,
      {
        cycleId: 41,
        loopCount: 2,
        provider: 'anthropic',
        model: 'claude-opus-4-6',
      } as never,
      'ok',
      {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    );

    expect(updateCycleMetricsMock).toHaveBeenCalledWith(
      {} as never,
      41,
      expect.objectContaining({ estimatedCostCents: 12.345 }),
    );
    expect(incrementPersonaCostCentsMock).toHaveBeenCalledWith({} as never, 12.345);
    expect(result).toMatchObject({ success: true, cycleId: 41 });
  });
});
