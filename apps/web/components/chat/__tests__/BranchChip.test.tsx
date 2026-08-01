/**
 * Tests: `apps/web/components/chat/BranchChip.tsx::BranchChip`
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BranchChip } from '../BranchChip';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  addLog: vi.fn(),
  switchBranch: vi.fn(),
}));

vi.mock('../../../api/client', () => ({
  default: {
    get: mocks.apiGet,
  },
}));

vi.mock('../../../store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      addLog: mocks.addLog,
      switchBranch: mocks.switchBranch,
    }),
}));

describe('BranchChip', () => {
  beforeEach(() => {
    mocks.apiGet.mockReset();
    mocks.addLog.mockReset();
    mocks.switchBranch.mockReset();
    mocks.switchBranch.mockResolvedValue(undefined);
  });

  it('routes branch swaps through the store switch action', async () => {
    mocks.apiGet
      .mockResolvedValueOnce({
        branches: [{ name: 'main' }, { name: 'edits' }],
      })
      .mockResolvedValueOnce({
        branches: [{ name: 'main' }, { name: 'edits' }],
      });

    const onBranchChanged = vi.fn();

    render(
      <BranchChip
        activeBranch="main"
        syntheticCount={1}
        editMode={false}
        onToggleEditMode={vi.fn()}
        onBranchChanged={onBranchChanged}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Memory branch: main' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /edits/i }));

    await waitFor(() => {
      expect(mocks.switchBranch).toHaveBeenCalledWith('edits');
    });
    expect(onBranchChanged).toHaveBeenCalled();
  });
});
