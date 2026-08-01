/**
 * Tests: `apps/web/components/chat/ThinkTrigger.tsx::ThinkTrigger`
 *
 * The chat's one pending affordance. Two things must hold, and they are the
 * two things a reviewer will actually check:
 *
 * 1. Pending is VISIBLY distinct from idle — a visitor who just sent a message
 *    can tell the difference between "waiting" and "nothing happened".
 * 2. Pending does not claim more than the build behind it does. The caller
 *    supplies the copy AND the accessible name, so a scripted fixture reply
 *    is never announced as deliberation.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThinkTrigger } from '../ThinkTrigger';

describe('ThinkTrigger', () => {
  it('renders the think affordance when idle', () => {
    render(<ThinkTrigger state="idle" onThink={vi.fn()} />);

    expect(screen.getAllByLabelText('Trigger think cycle').length).toBeGreaterThan(0);
    expect(screen.queryByRole('status', { name: 'Thinking...' })).toBeNull();
  });

  it('renders nothing when hidden', () => {
    const { container } = render(<ThinkTrigger state="hidden" onThink={vi.fn()} />);

    expect(container.firstChild).toBeNull();
  });

  it('replaces the trigger with a pending affordance while pending', () => {
    render(
      <ThinkTrigger
        state="thinking"
        onThink={vi.fn()}
        statusText="Persona has your message — replying on its next cycle"
      />,
    );

    // Distinct from "nothing is happening": the dots are present, the tap
    // target is gone, and there is copy saying what is being waited on.
    expect(screen.getByRole('status', { name: 'Thinking...' })).toBeTruthy();
    expect(
      screen.getByText('Persona has your message — replying on its next cycle'),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Trigger think cycle')).toBeNull();
  });

  it('lets the caller name the wait so a scripted reply is not called thinking', () => {
    render(
      <ThinkTrigger
        state="thinking"
        onThink={vi.fn()}
        statusText="Fetching a scripted reply — no model is thinking about this"
        pendingLabel="Fetching a scripted reply"
      />,
    );

    expect(screen.getByRole('status', { name: 'Fetching a scripted reply' })).toBeTruthy();
    expect(screen.queryByRole('status', { name: 'Thinking...' })).toBeNull();
  });

  it('clears back to the trigger when the wait ends', () => {
    const { rerender } = render(
      <ThinkTrigger state="thinking" onThink={vi.fn()} statusText="Waiting" />,
    );
    expect(screen.getByText('Waiting')).toBeTruthy();

    rerender(<ThinkTrigger state="idle" onThink={vi.fn()} statusText="Waiting" />);

    expect(screen.queryByText('Waiting')).toBeNull();
    expect(screen.getAllByLabelText('Trigger think cycle').length).toBeGreaterThan(0);
  });
});
