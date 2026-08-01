/**
 * Efficiencies page tests — route, content contract, interactives, entry points
 *
 * @module components/efficiencies/__tests__/efficienciesPage.test
 * @description Executable spec for the /efficiencies reading page: the route
 * bypasses the cover gate; the diagram front door and all five lever sections
 * render; every module path the prose cites EXISTS in the repo (the page's
 * mechanism-anchored claims cannot silently drift from the code — same
 * pattern as the About page); the cadence explorer reacts to slider input
 * with regime changes driven by the real selectCacheTtl; the boundary lab
 * steps the real algorithm from the UI; and the quiet entry points (cover
 * footer, About footer) are present.
 *
 * Targets: `apps/web/components/efficiencies/EfficienciesPage.tsx`,
 *   `apps/web/components/efficiencies/efficienciesContent.ts`,
 *   `apps/web/components/efficiencies/CadenceCostExplorer.tsx`,
 *   `apps/web/components/efficiencies/BoundaryShiftLab.tsx`,
 *   `apps/web/components/cover/coverGate.ts` (efficiencies-route bypass)
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { EfficienciesPage } from '../EfficienciesPage';
import {
  EFFICIENCY_LEVERS,
  EFFICIENCIES_PROVENANCE,
  citedPaths,
} from '../efficienciesContent';
import { CadenceCostExplorer } from '../CadenceCostExplorer';
import { BoundaryShiftLab } from '../BoundaryShiftLab';
import { CoverPage } from '../../cover/CoverPage';
import { AboutPage } from '../../about/AboutPage';
import { shouldShowCover } from '../../cover/coverGate';

describe('/efficiencies route gate', () => {
  it('bypasses the cover even on a first demo visit', () => {
    expect(
      shouldShowCover({ pathname: '/efficiencies', search: '', demoMode: true, seen: false }),
    ).toBe(false);
  });
});

describe('EfficienciesPage content', () => {
  it('renders the diagram front door, both interactives, and the tier flow', () => {
    render(<EfficienciesPage />);
    expect(screen.getByTestId('context-anatomy-diagram')).toBeTruthy();
    expect(screen.getByTestId('cadence-cost-explorer')).toBeTruthy();
    expect(screen.getByTestId('boundary-shift-lab')).toBeTruthy();
    expect(screen.getByTestId('tier-flow-diagram')).toBeTruthy();
  });

  it('renders all five levers, each with an apparatus line', () => {
    render(<EfficienciesPage />);
    expect(EFFICIENCY_LEVERS).toHaveLength(5);
    for (const lever of EFFICIENCY_LEVERS) {
      expect(screen.getByText(lever.title)).toBeTruthy();
      expect(lever.apparatus.length).toBeGreaterThan(0);
    }
  });

  it('cites only module paths that actually exist in this repo', () => {
    // The page's whole posture is "mechanism-anchored": a cited path that
    // stops existing is prose drifting from code — fail loudly here.
    const repoRoot = process.cwd();
    const paths = citedPaths();
    expect(paths.length).toBeGreaterThanOrEqual(8);
    for (const citedPath of paths) {
      expect(
        fs.existsSync(path.resolve(repoRoot, citedPath)),
        `cited path missing from repo: ${citedPath}`,
      ).toBe(true);
    }
  });

  it('states no dollar figures anywhere (ratios, not prices — binding ruling)', () => {
    const { container } = render(<EfficienciesPage />);
    expect(container.textContent).not.toMatch(/\$\s?\d/);
  });
});

describe('cadence explorer — slider drives the real TTL policy', () => {
  it('moving the interval slider updates cadence, regime, and the readout', () => {
    render(<CadenceCostExplorer />);
    const slider = screen.getByTestId('eff-interval-slider');

    // Fast cadence → 5-minute entries (selectCacheTtl < 270s)
    fireEvent.change(slider, { target: { value: '120' } });
    expect(screen.getByTestId('eff-interval-label').textContent).toContain('every 2 min');
    expect(screen.getByTestId('eff-regime').textContent).toContain('5-minute cache entries');
    expect(screen.getByTestId('eff-regime').textContent).toContain('720 wakes/day');

    // Mid cadence → 1-hour entries
    fireEvent.change(slider, { target: { value: '900' } });
    expect(screen.getByTestId('eff-regime').textContent).toContain('1-hour cache entries');

    // Slow cadence → volatile caching off (selectCacheTtl returns null)
    fireEvent.change(slider, { target: { value: '2400' } });
    expect(screen.getByTestId('eff-regime').textContent).toContain(
      'stops caching the volatile block',
    );
  });

  it('the cached-fraction slider moves the headline ratio', () => {
    render(<CadenceCostExplorer />);
    const cachedSlider = screen.getByTestId('eff-cached-slider');

    fireEvent.change(cachedSlider, { target: { value: '0' } });
    const uncachedReadout = screen.getByTestId('eff-cost-readout').textContent;
    expect(uncachedReadout).toContain('≈100%');

    fireEvent.change(cachedSlider, { target: { value: '0.9' } });
    const cachedReadout = screen.getByTestId('eff-cost-readout').textContent;
    expect(cachedReadout).not.toBe(uncachedReadout);
    expect(cachedReadout).not.toContain('≈100%');
  });

  it('the batch toggle halves the readout', () => {
    render(<CadenceCostExplorer />);
    fireEvent.change(screen.getByTestId('eff-cached-slider'), { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('eff-batch-toggle'));
    expect(screen.getByTestId('eff-cost-readout').textContent).toContain('≈50%');
  });
});

describe('boundary lab — the real algorithm from the UI', () => {
  it('waking appends entries and the shipped function speaks in the log line', () => {
    render(<BoundaryShiftLab />);
    fireEvent.click(screen.getByTestId('lab-wake-1'));
    expect(screen.getByTestId('lab-log').textContent).toContain('[Cache]');
    fireEvent.click(screen.getByTestId('lab-wake-10'));
    expect(screen.getByTestId('lab-counters').textContent).toContain('cache hits since last shift');
  });
});

describe('the five-lever summary strip (at-a-glance)', () => {
  it('renders one stat tile per lever, anchor-linked to that lever section', () => {
    const { container } = render(<EfficienciesPage />);
    expect(screen.getByTestId('eff-lever-strip')).toBeTruthy();
    for (const lever of EFFICIENCY_LEVERS) {
      const card = screen.getByTestId(`eff-strip-${lever.id}`);
      expect(card.getAttribute('href')).toBe(`#${lever.id}`);
      expect(card.textContent).toContain(lever.stat);
      expect(card.textContent).toContain(lever.statLabel);
      // The anchor target must actually exist — a tile pointing at nothing
      // is a dead link, not a summary.
      const target = container.querySelector(`#${CSS.escape(lever.id)}`);
      expect(target, `missing section anchor #${lever.id}`).toBeTruthy();
      expect(target?.getAttribute('data-lever-id')).toBe(lever.id);
    }
  });

  it('restates only values the page prose already carries (no invented numbers)', () => {
    // Every numeric token in a stat must appear in the lever's own body/
    // apparatus text or the page's provenance note (which test-pins the same
    // thresholds) — the strip is a summary, never a second source.
    for (const lever of EFFICIENCY_LEVERS) {
      const prose = [
        ...lever.body,
        lever.apparatus,
        lever.statLabel,
        ...EFFICIENCIES_PROVENANCE,
      ].join(' ');
      const numericTokens = lever.stat.match(/\d[\d,.]*/g) ?? [];
      expect(numericTokens.length).toBeGreaterThan(0);
      for (const token of numericTokens) {
        expect(
          prose.includes(token) || prose.includes(token.replace(',', '')),
          `stat token "${token}" (lever ${lever.id}) not found on the page`,
        ).toBe(true);
      }
      expect(lever.stat).not.toMatch(/\$/);
      expect(lever.short.length).toBeLessThan(25);
    }
  });

  it('tells the skimmer the two interactive explorers exist further down', () => {
    render(<EfficienciesPage />);
    const note = screen.getByTestId('eff-strip-explorers-note').textContent ?? '';
    expect(note).toContain('boundary-shift lab');
    expect(note).toContain('cadence/cost explorer');
  });
});

describe('the tour', () => {
  it('the bottom of the page hands the reader back to the observatory, with an /about backlink', () => {
    render(<EfficienciesPage />);
    expect(screen.getByTestId('eff-back-observatory').getAttribute('href')).toBe(
      '/observatory',
    );
    expect(screen.getByTestId('eff-back-about').getAttribute('href')).toBe('/about');
  });
});

describe('entry points', () => {
  it('the cover footer links to /efficiencies', () => {
    render(<CoverPage onEnter={() => {}} />);
    expect(screen.getByTestId('cover-efficiencies-link').getAttribute('href')).toBe(
      '/efficiencies',
    );
  });

  it('the About footer cross-links to /efficiencies', () => {
    render(<AboutPage />);
    expect(screen.getByTestId('about-efficiencies-link').getAttribute('href')).toBe(
      '/efficiencies',
    );
  });

  it('the efficiencies footer links back to the observatory and About', () => {
    render(<EfficienciesPage />);
    expect(screen.getByTestId('efficiencies-to-observatory').getAttribute('href')).toBe(
      '/observatory',
    );
    expect(screen.getByTestId('efficiencies-to-about').getAttribute('href')).toBe('/about');
  });
});
