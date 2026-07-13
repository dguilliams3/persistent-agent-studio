import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OverridesPanel } from '../OverridesPanel';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiDelete: vi.fn(),
  getAdminPassword: vi.fn(),
}));

vi.mock('../../../api/client', () => ({
  default: {
    get: mocks.apiGet,
    delete: mocks.apiDelete,
  },
  api: {
    get: mocks.apiGet,
    delete: mocks.apiDelete,
  },
  getAdminPassword: mocks.getAdminPassword,
}));

describe('OverridesPanel', () => {
  beforeEach(() => {
    mocks.apiGet.mockReset();
    mocks.apiDelete.mockReset();
    mocks.getAdminPassword.mockReset();
  });

  it('loads overrides and undoes a row with a branch refresh event', async () => {
    mocks.getAdminPassword.mockReturnValue('admin-password');
    mocks.apiGet
      .mockResolvedValueOnce({
        branchName: 'edits',
        overrides: [
          {
            id: 7,
            target_table: 'history',
            target_id: 42,
            override_type: 'edit',
            override_data: JSON.stringify({ content: 'Edited content' }),
          },
        ],
      })
      .mockResolvedValueOnce({
        branchName: 'edits',
        overrides: [],
      });

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(<OverridesPanel activeBranch="edits" />);

    expect(
      await screen.findByRole('button', { name: 'Undo override 7' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Edited branch copy of a history row/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo override 7' }));

    await waitFor(() => {
      expect(mocks.apiDelete).toHaveBeenCalledWith('/memory/override/7', {
        password: 'admin-password',
      });
    });
    expect(dispatchSpy).toHaveBeenCalledWith(expect.any(Event));
    await screen.findByText(/No overrides yet/i);

    dispatchSpy.mockRestore();
  });

  it('does not undo when the admin password is cancelled', async () => {
    mocks.getAdminPassword.mockReturnValue(null);
    mocks.apiGet.mockResolvedValueOnce({
      branchName: 'main',
      overrides: [
        {
          id: 11,
          target_table: 'history',
          target_id: 100,
          override_type: 'exclude',
          override_data: null,
        },
      ],
    });

    render(<OverridesPanel activeBranch="main" />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Undo override 11' }),
    );

    expect(mocks.apiDelete).not.toHaveBeenCalled();
  });
});
