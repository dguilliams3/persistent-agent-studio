import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatBubble } from '../ChatBubble';

const baseEntry = {
  id: 1,
  persona_id: 1,
  type: 'user_message',
  content: 'hello',
  internal: null,
  cycle_id: null,
  meter_snapshot: null,
  metadata: null,
  created_at: '2026-07-13 10:00:00',
  summarized_at: null,
  blurred: 0,
  vaulted: 0,
};

function renderBubble(metadata: unknown) {
  return render(
    React.createElement(ChatBubble, {
      entry: { ...baseEntry, metadata } as any,
      isUser: true,
      expanded: false,
      onToggleExpand: vi.fn(),
    }),
  );
}

function renderPersonaBubble(content: string) {
  return render(
    React.createElement(ChatBubble, {
      entry: { ...baseEntry, type: 'message_to_user', content } as any,
      isUser: false,
      expanded: false,
      onToggleExpand: vi.fn(),
    }),
  );
}

describe('ChatBubble', () => {
  it('shows the sender label for non-Dan user metadata', () => {
    renderBubble({ from: 'Delphi' });
    expect(screen.getByText('⟡ Delphi')).toBeInTheDocument();
  });

  it('hides the sender label for Dan metadata', () => {
    renderBubble('{"from":"Dan"}');
    expect(screen.queryByText('⟡ Dan')).toBeNull();
  });

  it('renders internal markdown links same-tab (no target, no rel)', () => {
    renderPersonaBubble('read [the open questions](/about)');
    const link = screen.getByRole('link', { name: 'the open questions' });
    expect(link.getAttribute('href')).toBe('/about');
    expect(link.getAttribute('target')).toBeNull();
    expect(link.getAttribute('rel')).toBeNull();
  });

  it('renders external markdown links in a new tab with noopener', () => {
    renderPersonaBubble('see [the source](https://github.com/example/repo)');
    const link = screen.getByRole('link', { name: 'the source' });
    expect(link.getAttribute('href')).toBe('https://github.com/example/repo');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
