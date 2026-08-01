/**
 * Tests: `apps/web/components/ui/HistoryEntryRow.tsx::HistoryEntryRow`,
 * `apps/web/components/ui/EntryContent.tsx::EntryContent`
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HistoryEntryRow } from '../HistoryEntryRow';

describe('HistoryEntryRow', () => {
  it('shows a rewrite pencil for action rows with internal notes', () => {
    const onEditEntry = vi.fn();

    render(
      <HistoryEntryRow
        entry={{
          id: 7,
          type: 'thought',
          created_at: '2026-07-13T18:00:00.000Z',
          content: 'Thinking through the branch swap',
          internal: 'drafting a note',
        }}
        mode="display"
        editMode
        onEditEntry={onEditEntry}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Rewrite this memory' }));

    expect(onEditEntry).toHaveBeenCalledWith(7);
    expect(screen.getByText(/drafting a note/i)).toBeTruthy();
  });
});
