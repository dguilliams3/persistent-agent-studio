/**
 * Knowledge handler honesty tests — C4 (RUN-20260712-2013)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  updateLearnedMock,
  resolveQuestionMock,
  dissolveQuestionMock,
  addQuestionNoteMock,
} = vi.hoisted(() => ({
  updateLearnedMock: vi.fn(),
  resolveQuestionMock: vi.fn(),
  dissolveQuestionMock: vi.fn(),
  addQuestionNoteMock: vi.fn(),
}));

vi.mock('../index', async () => {
  const actual = await vi.importActual<typeof import('../index')>('../index');
  return {
    ...actual,
    updateLearned: updateLearnedMock,
    resolveQuestion: resolveQuestionMock,
    dissolveQuestion: dissolveQuestionMock,
    addNote: addQuestionNoteMock,
  };
});

import { handlePostLearned, handlePostQuestion } from './knowledge';

describe('knowledge handlers report row-truth', () => {
  beforeEach(() => {
    updateLearnedMock.mockReset();
    resolveQuestionMock.mockReset();
    dissolveQuestionMock.mockReset();
    addQuestionNoteMock.mockReset();
  });

  it('handlePostLearned returns 404 when updateLearned reports no matching row', async () => {
    updateLearnedMock.mockResolvedValue(false);

    const result = await handlePostLearned({} as never, { id: 99, content: 'x' });

    expect(result).toEqual({
      success: false,
      error: 'Learned fact 99 not found',
      status: 404,
    });
  });

  it('handlePostQuestion resolve returns 404 when the helper reports no row', async () => {
    resolveQuestionMock.mockResolvedValue(false);

    const result = await handlePostQuestion({} as never, {
      op: 'resolve',
      id: 7,
      resolved_into: 'insight',
    });

    expect(result).toEqual({
      success: false,
      error: 'Question 7 not found',
      status: 404,
    });
  });

  it('handlePostQuestion dissolve returns 404 when the helper reports no row', async () => {
    dissolveQuestionMock.mockResolvedValue(false);

    const result = await handlePostQuestion({} as never, {
      op: 'dissolve',
      id: 8,
      reason: 'stopped mattering',
    });

    expect(result).toEqual({
      success: false,
      error: 'Question 8 not found',
      status: 404,
    });
  });

  it('handlePostQuestion note returns 404 when addQuestionNote reports no row', async () => {
    addQuestionNoteMock.mockResolvedValue({ success: false, noteCount: 0, status: 'open' });

    const result = await handlePostQuestion({} as never, {
      op: 'note',
      id: 12,
      note: 'still wondering',
    });

    expect(result).toEqual({
      success: false,
      error: 'question not found',
      status: 404,
    });
  });
});
