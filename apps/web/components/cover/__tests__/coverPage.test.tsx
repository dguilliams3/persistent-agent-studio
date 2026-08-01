/**
 * Tests: `apps/web/components/cover/CoverPage.tsx::CoverPage`
 *
 * Keyboard entry contract: Enter and Escape both enter the observatory from
 * anywhere on the page (the prior review walk found Enter did nothing unless
 * the CTA button happened to hold focus), while Enter on a focused
 * interactive element is left to the browser's native activation so nothing
 * double-fires. The remembered-skip logic itself lives in coverGate.ts and
 * keeps its own tests — CoverPage only calls onEnter.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CoverPage } from '../CoverPage';

describe('CoverPage keyboard entry', () => {
  it('enters on Enter pressed anywhere on the page', () => {
    const onEnter = vi.fn();
    render(<CoverPage onEnter={onEnter} />);

    fireEvent.keyDown(document.body, { key: 'Enter' });

    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onEnter).toHaveBeenCalledWith();
  });

  it('still enters on Escape', () => {
    const onEnter = vi.fn();
    render(<CoverPage onEnter={onEnter} />);

    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('defers Enter to native activation when an interactive element has focus', () => {
    const onEnter = vi.fn();
    render(<CoverPage onEnter={onEnter} />);

    const aboutLink = screen.getByTestId('cover-about-link');
    aboutLink.focus();
    fireEvent.keyDown(aboutLink, { key: 'Enter' });

    expect(onEnter).not.toHaveBeenCalled();
  });

  it('ignores modified Enter (browser shortcuts stay browser shortcuts)', () => {
    const onEnter = vi.fn();
    render(<CoverPage onEnter={onEnter} />);

    fireEvent.keyDown(document.body, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'Enter', metaKey: true });
    fireEvent.keyDown(document.body, { key: 'Enter', altKey: true });

    expect(onEnter).not.toHaveBeenCalled();
  });

  it('removes the key listener on unmount', () => {
    const onEnter = vi.fn();
    const { unmount } = render(<CoverPage onEnter={onEnter} />);

    unmount();
    fireEvent.keyDown(document.body, { key: 'Enter' });

    expect(onEnter).not.toHaveBeenCalled();
  });
});
