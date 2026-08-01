import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { LogToastStack } from '../LogToastStack';

describe('LogToastStack', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders only error logs and dismisses them on tap', () => {
    const entries = [
      { msg: '✅ ok', time: 1 },
      { msg: '❌ failed to save', time: 2 },
    ];

    render(<LogToastStack entries={entries} />);

    expect(screen.getByRole('button', { name: '❌ failed to save' })).toBeInTheDocument();
    expect(screen.queryByText('✅ ok')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '❌ failed to save' }));

    expect(screen.queryByText('❌ failed to save')).toBeNull();
  });

  it('auto-dismisses after the timeout', () => {
    render(<LogToastStack entries={[{ msg: '❌ network error', time: 3 }]} />);

    expect(screen.getByText('❌ network error')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    expect(screen.queryByText('❌ network error')).toBeNull();
  });

  it('caps the visible stack at three entries', () => {
    render(
      <LogToastStack
        entries={[
          { msg: '❌ one', time: 1 },
          { msg: '❌ two', time: 2 },
          { msg: '❌ three', time: 3 },
          { msg: '❌ four', time: 4 },
        ]}
      />,
    );

    expect(screen.queryByText('❌ one')).toBeNull();
    expect(screen.getByText('❌ two')).toBeInTheDocument();
    expect(screen.getByText('❌ three')).toBeInTheDocument();
    expect(screen.getByText('❌ four')).toBeInTheDocument();
  });
});
