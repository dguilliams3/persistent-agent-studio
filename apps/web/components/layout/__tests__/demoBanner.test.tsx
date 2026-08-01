/**
 * Demo banner tests — the quiet reading links and the dismiss affordance
 *
 * @module components/layout/__tests__/demoBanner.test
 * @description The expanded demo chip must offer the way back to the cover
 * (`/?cover=1`) AND both quiet reading links — "the questions" (/about) and
 * "the internals" (/efficiencies) — and stay dismissible. jsdom has no
 * matchMedia, so a minimal stub stands in (desktop, non-matching).
 *
 * Targets: `apps/web/components/layout/DemoBanner.tsx`
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DemoBanner } from '../DemoBanner';

beforeEach(() => {
  sessionStorage.clear();
  // jsdom ships no matchMedia; the banner only reads `.matches` and
  // (un)subscribes to change events.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

describe('DemoBanner reading links', () => {
  it('expanded chip links to the questions and the internals, same tab', () => {
    render(<DemoBanner />);
    fireEvent.click(screen.getByRole('status'));

    const aboutLink = screen.getByTestId('demo-banner-about-link');
    expect(aboutLink.getAttribute('href')).toBe('/about');
    expect(aboutLink.textContent).toBe('the questions');
    expect(aboutLink.getAttribute('target')).toBeNull();

    const efficienciesLink = screen.getByTestId('demo-banner-efficiencies-link');
    expect(efficienciesLink.getAttribute('href')).toBe('/efficiencies');
    expect(efficienciesLink.textContent).toBe('the internals');
    expect(efficienciesLink.getAttribute('target')).toBeNull();
  });

  it('stays dismissible with the links present', () => {
    render(<DemoBanner />);
    fireEvent.click(screen.getByRole('status'));
    fireEvent.click(screen.getAllByLabelText('Dismiss demo banner')[0]);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
