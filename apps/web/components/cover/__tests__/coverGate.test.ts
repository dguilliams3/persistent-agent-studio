/**
 * Cover gate tests — the remembered-skip contract
 *
 * @module components/cover/__tests__/coverGate.test
 * @description The anti-gate ruling as executable spec: first demo visit
 * shows the cover; entering is remembered (localStorage) so a returning
 * visitor is NEVER shown it again; direct `/observatory` links and `?skip=1`
 * bypass it; `?cover=1` re-opens it on purpose; real deployments never see
 * it. Storage failures degrade to per-load, never to a block.
 *
 * Targets: `apps/web/components/cover/coverGate.ts`
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  COVER_SEEN_KEY,
  hasSeenCover,
  markCoverSeen,
  shouldShowCover,
  getDeepLinkTab,
} from '../coverGate';

/** Baseline gate input: first demo visit at the root URL. */
const firstVisit = { pathname: '/', search: '', demoMode: true, seen: false };

beforeEach(() => {
  localStorage.removeItem(COVER_SEEN_KEY);
});

describe('shouldShowCover', () => {
  it('shows the cover on a first demo visit at /', () => {
    expect(shouldShowCover(firstVisit)).toBe(true);
  });

  it('NEVER shows the cover to a returning visitor (remembered skip)', () => {
    expect(shouldShowCover({ ...firstVisit, seen: true })).toBe(false);
  });

  it('treats a direct /observatory link as an implicit skip, even unseen', () => {
    expect(shouldShowCover({ ...firstVisit, pathname: '/observatory' })).toBe(false);
  });

  it('honors ?skip=1 as a per-load bypass', () => {
    expect(shouldShowCover({ ...firstVisit, search: '?skip=1' })).toBe(false);
  });

  it('re-opens on ?cover=1 even when already seen (deliberate re-entry)', () => {
    expect(shouldShowCover({ ...firstVisit, search: '?cover=1', seen: true })).toBe(true);
    expect(
      shouldShowCover({
        ...firstVisit,
        pathname: '/observatory',
        search: '?cover=1',
        seen: true,
      }),
    ).toBe(true);
  });

  it('never renders in a real deployment, even with ?cover=1', () => {
    expect(shouldShowCover({ ...firstVisit, demoMode: false })).toBe(false);
    expect(shouldShowCover({ ...firstVisit, demoMode: false, search: '?cover=1' })).toBe(false);
  });

  it('deep-link params alone do not suppress the first-visit cover', () => {
    expect(shouldShowCover({ ...firstVisit, search: '?tab=sim' })).toBe(true);
  });
});

describe('remembered skip storage', () => {
  it('round-trips: markCoverSeen → hasSeenCover → gate closed', () => {
    expect(hasSeenCover()).toBe(false);
    markCoverSeen();
    expect(hasSeenCover()).toBe(true);
    expect(shouldShowCover({ ...firstVisit, seen: hasSeenCover() })).toBe(false);
  });

  it('hasSeenCover degrades to false when storage throws (shows cover, never breaks)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage denied');
    });
    expect(hasSeenCover()).toBe(false);
  });

  it('markCoverSeen swallows storage failures (app still renders)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage denied');
    });
    expect(() => markCoverSeen()).not.toThrow();
  });
});

describe('getDeepLinkTab', () => {
  it('returns a valid view from ?tab=', () => {
    expect(getDeepLinkTab('?tab=sim')).toBe('sim');
    expect(getDeepLinkTab('?tab=chat')).toBe('chat');
  });

  it('returns null when absent (persisted tab is left alone)', () => {
    expect(getDeepLinkTab('')).toBeNull();
    expect(getDeepLinkTab('?skip=1')).toBeNull();
  });

  it('normalizes like every other tab write: legacy ids map, garbage → chat', () => {
    expect(getDeepLinkTab('?tab=gallery')).toBe('media');
    expect(getDeepLinkTab('?tab=definitely-not-a-view')).toBe('chat');
  });
});
