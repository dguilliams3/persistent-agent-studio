/**
 * Tests: `apps/web/components/chat/MemoryEditTools.tsx::InlineMemoryEditor`
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InlineMemoryEditor } from '../MemoryEditTools';

const mocks = vi.hoisted(() => ({
  apiPost: vi.fn(),
  addLog: vi.fn(),
}));

vi.mock('../../../api/client', () => ({
  default: {
    post: mocks.apiPost,
  },
}));

vi.mock('../../../store', () => ({
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      addLog: mocks.addLog,
    }),
}));

describe('InlineMemoryEditor', () => {
  beforeEach(() => {
    mocks.apiPost.mockReset();
    mocks.addLog.mockReset();
    mocks.apiPost.mockResolvedValue({});
  });

  it('requires an explicit branch confirmation before saving from main', async () => {
    const onSaved = vi.fn();
    const onCancel = vi.fn();

    render(
      <InlineMemoryEditor
        entryId={42}
        initialContent="original text"
        isUser={false}
        activeBranch="main"
        onSaved={onSaved}
        onCancel={onCancel}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('original text'), {
      target: { value: 'rewritten text' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save rewrite' }));

    expect(mocks.addLog).toHaveBeenCalledWith(
      'Confirm the branch name before saving this edit.',
    );
    expect(mocks.apiPost).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Branch name'), {
      target: { value: 'edit-cider' },
    });
    fireEvent.click(
      screen.getByRole('checkbox', { name: /confirm branch creation on/i }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save rewrite' }));

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith('/memory/edit', {
        table: 'history',
        id: 42,
        content: 'rewritten text',
        branchName: 'edit-cider',
      });
    });
    expect(onSaved).toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
