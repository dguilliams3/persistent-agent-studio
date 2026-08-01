/**
 * About page tests — route, content contract, and the wobble deep link
 *
 * @module components/about/__tests__/aboutPage.test
 * @description Executable spec for the /about reading page: the route
 * bypasses the cover gate; the six open questions render; every module path
 * the prose cites EXISTS in the repo (the page's mechanism-anchored claims
 * cannot silently drift from the code); the observer-effect question quotes
 * the specimen's exhibit-consent exchange verbatim and deep-links to the
 * exact transcript entry; and the entry points (cover footer) are present.
 *
 * Targets: `apps/web/components/about/AboutPage.tsx`,
 *   `apps/web/components/about/aboutContent.ts`,
 *   `apps/web/components/cover/coverGate.ts` (about-route + ?entry=),
 *   `apps/web/api/demo/specimen.ts` (WOBBLE_ENTRY_ID)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { AboutPage } from '../AboutPage';
import { ABOUT_QUESTIONS, WOBBLE_QUOTE } from '../aboutContent';
import { CoverPage } from '../../cover/CoverPage';
import {
  shouldShowCover,
  getDeepLinkEntryId,
  setPendingEntryScroll,
  consumePendingEntryScroll,
} from '../../cover/coverGate';
import { SPECIMEN_HISTORY, WOBBLE_ENTRY_ID } from '../../../api/demo/specimen';

describe('/about route gate', () => {
  it('bypasses the cover even on a first demo visit', () => {
    expect(
      shouldShowCover({ pathname: '/about', search: '', demoMode: true, seen: false }),
    ).toBe(false);
  });
});

describe('getDeepLinkEntryId (?entry=)', () => {
  it('parses a positive integer id', () => {
    expect(getDeepLinkEntryId('?tab=chat&entry=31')).toBe(31);
  });

  it('returns null when absent or garbage', () => {
    expect(getDeepLinkEntryId('')).toBeNull();
    expect(getDeepLinkEntryId('?tab=chat')).toBeNull();
    expect(getDeepLinkEntryId('?entry=wobble')).toBeNull();
    expect(getDeepLinkEntryId('?entry=-4')).toBeNull();
    expect(getDeepLinkEntryId('?entry=3.5')).toBeNull();
    expect(getDeepLinkEntryId('?entry=0')).toBeNull();
  });
});

describe('pending entry scroll hand-off', () => {
  it('is one-shot: consume returns the stash once, then null', () => {
    setPendingEntryScroll(31);
    expect(consumePendingEntryScroll()).toBe(31);
    expect(consumePendingEntryScroll()).toBeNull();
  });
});

describe('AboutPage content', () => {
  it('renders all six open questions', () => {
    render(<AboutPage />);
    expect(ABOUT_QUESTIONS).toHaveLength(6);
    for (const question of ABOUT_QUESTIONS) {
      // getAllByText throws when absent; each title appears at least twice —
      // once in the at-a-glance index, once as its section heading.
      expect(screen.getAllByText(question.title).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('states every question with an apparatus and a falsifiability line', () => {
    for (const question of ABOUT_QUESTIONS) {
      expect(question.apparatus.length).toBeGreaterThan(0);
      expect(question.measure.length).toBeGreaterThan(0);
    }
  });

  it('cites only module paths that actually exist in this repo', () => {
    // The page's whole posture is "mechanism-anchored": a cited path that
    // stops existing is prose drifting from code — fail loudly here.
    const repoRoot = process.cwd();
    const citedPaths = ABOUT_QUESTIONS.flatMap((question) =>
      (question.apparatus.match(/`([^`]+)`/g) ?? [])
        .map((token) => token.slice(1, -1))
        .filter((token) => token.includes('/')),
    );
    expect(citedPaths.length).toBeGreaterThanOrEqual(6);
    for (const citedPath of citedPaths) {
      expect(
        fs.existsSync(path.resolve(repoRoot, citedPath)),
        `cited path missing from repo: ${citedPath}`,
      ).toBe(true);
    }
  });
});

describe('the wobble deep link (observer-effect exhibit)', () => {
  it('resolves WOBBLE_ENTRY_ID to the exhibit-consent reply in the specimen', () => {
    expect(WOBBLE_ENTRY_ID).not.toBeNull();
    const wobbleEntry = SPECIMEN_HISTORY.find(
      (specimenEntry) => specimenEntry.id === WOBBLE_ENTRY_ID,
    );
    expect(wobbleEntry).toBeDefined();
    expect(wobbleEntry?.type).toBe('message_to_user');
    expect(wobbleEntry?.content).toContain('worthless without the wobble');
  });

  it('quotes the transcript verbatim (no fabricated quote)', () => {
    const wobbleEntry = SPECIMEN_HISTORY.find(
      (specimenEntry) => specimenEntry.id === WOBBLE_ENTRY_ID,
    );
    // The page quote elides the middle with an ellipsis; both segments must
    // be verbatim substrings of the real entry.
    for (const segment of WOBBLE_QUOTE.split('…').map((part) => part.trim())) {
      expect(wobbleEntry?.content).toContain(segment);
    }
  });

  it('deep-links the quote to the exact transcript entry (demo mode)', () => {
    render(<AboutPage demoMode />);
    const link = screen.getByTestId('wobble-deep-link');
    expect(link.getAttribute('href')).toBe(
      `/observatory?tab=chat&entry=${WOBBLE_ENTRY_ID}`,
    );
  });

  it('renders the quote WITHOUT a link in real deployments (foreign entry ids)', () => {
    render(<AboutPage demoMode={false} />);
    expect(screen.queryByTestId('wobble-deep-link')).toBeNull();
    expect(screen.getByText(/ships in the bundled demo specimen/i)).toBeTruthy();
  });
});

describe('the question index (at-a-glance)', () => {
  it('renders one anchor link per question, targeting that question section', () => {
    const { container } = render(<AboutPage />);
    expect(screen.getByTestId('about-question-index')).toBeTruthy();
    for (const question of ABOUT_QUESTIONS) {
      const indexLink = screen.getByTestId(`about-index-${question.id}`);
      expect(indexLink.getAttribute('href')).toBe(`#${question.id}`);
      expect(indexLink.textContent).toContain(question.title);
      // The anchor target must actually exist — an index row that points at
      // nothing is a dead link, not a table of contents.
      const target = container.querySelector(`#${CSS.escape(question.id)}`);
      expect(target, `missing section anchor #${question.id}`).toBeTruthy();
      expect(target?.getAttribute('data-question-id')).toBe(question.id);
    }
  });

  it('every question carries a short mini-TOC label', () => {
    for (const question of ABOUT_QUESTIONS) {
      expect(question.short.length).toBeGreaterThan(0);
      expect(question.short.length).toBeLessThan(25);
    }
  });
});

describe('live-surface deep links', () => {
  it('the settling-arc link points at the SIM tab', () => {
    render(<AboutPage />);
    expect(screen.getByTestId('about-sim-live-link').getAttribute('href')).toBe(
      '/observatory?tab=sim',
    );
  });
});

describe('the tour', () => {
  it('the bottom of the page hands the reader to /efficiencies', () => {
    render(<AboutPage />);
    expect(screen.getByTestId('about-next-efficiencies').getAttribute('href')).toBe(
      '/efficiencies',
    );
  });
});

describe('entry points', () => {
  it('the cover footer links to /about', () => {
    render(<CoverPage onEnter={() => {}} />);
    expect(screen.getByTestId('cover-about-link').getAttribute('href')).toBe('/about');
  });
});
