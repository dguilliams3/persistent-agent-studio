/**
 * Cost ceiling handler tests — Phase 2 (RUN-20260712-2013)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getStateMock, setStateMock } = vi.hoisted(() => ({
  getStateMock: vi.fn(),
  setStateMock: vi.fn(),
}));

vi.mock('../../index', async () => {
  const actual = await vi.importActual<typeof import('../../index')>('../../index');
  return {
    ...actual,
    getState: getStateMock,
    setState: setStateMock,
  };
});

import { handleGetCostCeiling, handleSetCostCeiling } from './status';

describe('cost ceiling handlers', () => {
  beforeEach(() => {
    getStateMock.mockReset();
    setStateMock.mockReset();
  });

  it('returns null when no ceiling is set', async () => {
    getStateMock.mockResolvedValue(undefined);

    await expect(handleGetCostCeiling({} as never)).resolves.toEqual({
      costCeilingCents: null,
    });
  });

  it('returns the parsed ceiling when present', async () => {
    getStateMock.mockResolvedValue('60000');

    await expect(handleGetCostCeiling({} as never)).resolves.toEqual({
      costCeilingCents: 60000,
    });
  });

  it('sets a numeric ceiling', async () => {
    const result = await handleSetCostCeiling({} as never, { cents: 1234.5 });

    expect(setStateMock).toHaveBeenCalledWith(
      {} as never,
      'cost_ceiling_cents',
      '1234.5',
    );
    expect(result).toEqual({ success: true, costCeilingCents: 1234.5 });
  });

  it('clears the ceiling when cents is null', async () => {
    const result = await handleSetCostCeiling({} as never, { cents: null });

    expect(setStateMock).toHaveBeenCalledWith(
      {} as never,
      'cost_ceiling_cents',
      null,
    );
    expect(result).toEqual({ success: true, costCeilingCents: null });
  });

  it('rejects a negative ceiling', async () => {
    await expect(handleSetCostCeiling({} as never, { cents: -1 })).resolves.toEqual({
      error: 'cents must be a number >= 0, or null to clear the ceiling',
      status: 400,
    });
  });
});
