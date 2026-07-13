/**
 * Quick-followup scheduling tests — F-B1 (RUN-20260712-2013)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getStateMock, setStateMock } = vi.hoisted(() => ({
  getStateMock: vi.fn(),
  setStateMock: vi.fn(),
}));

vi.mock('./state', () => ({
  getState: getStateMock,
  setState: setStateMock,
}));

import { queueQuickFollowup } from './quick-followup';

describe('queueQuickFollowup', () => {
  beforeEach(() => {
    getStateMock.mockReset();
    setStateMock.mockReset();
  });

  it('queues a user_message followup when nothing is pending and the last wake is old', async () => {
    getStateMock.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);

    const result = await queueQuickFollowup({} as never, { reason: 'user_message' });

    expect(result.scheduled).toBe(true);
    expect(result.reason).toBe('scheduled');
    expect(setStateMock).toHaveBeenCalledWith(
      {} as never,
      'quick_followup_reason',
      'user_message',
      {},
    );
  });

  it('does not thrash when a quick followup is already pending', async () => {
    getStateMock.mockResolvedValueOnce(new Date().toISOString());

    const result = await queueQuickFollowup({} as never, { reason: 'user_message' });

    expect(result).toEqual({ scheduled: false, reason: 'already_scheduled' });
    expect(setStateMock).not.toHaveBeenCalled();
  });

  it('does not queue when the loop already woke in the last 30 seconds', async () => {
    getStateMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(new Date(Date.now() - 10_000).toISOString());

    const result = await queueQuickFollowup({} as never, { reason: 'user_message' });

    expect(result).toEqual({ scheduled: false, reason: 'recent_wake' });
    expect(setStateMock).not.toHaveBeenCalled();
  });
});
