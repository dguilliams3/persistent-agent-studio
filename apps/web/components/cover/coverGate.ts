/**
 * Cover gate — first-visit decision logic for the observatory cover page
 *
 * @module components/cover/coverGate
 * @description Decides whether the demo's cover page ("this is what you're
 * about to open") should render, and remembers the skip so a returning
 * visitor is NEVER blocked by it again (localStorage). Pure decision
 * function + storage helpers, split from CoverPage so the remembered-skip
 * contract is directly testable.
 *
 * Routing contract (works in demo mode and real deployments alike):
 * - `/`            → cover on FIRST demo visit only; the app afterwards
 * - `/observatory` → always the app (a direct link is an implicit skip)
 * - `/about`       → always the About page (App.tsx routes it before the
 *   gate; the gate also answers false so the two never disagree)
 * - `/efficiencies` → always the Efficiencies page (same contract as /about)
 * - `?skip=1`      → bypass for this load (shareable "straight in" link)
 * - `?cover=1`     → re-open the cover on purpose (DemoBanner offers this)
 * - `?entry=N`     → after `?tab=chat`, land the reader on entry N (the
 *   About page's exhibit links; consumed once by ChatView)
 * - real deployment (worker configured) → never; the cover describes the
 *   fixture exhibit and would be false copy in front of a live persona
 *
 * @upstream Called by: App.tsx (gate + enter + deep links), CoverPage (via
 *   App), DemoBanner (re-entry link `/?cover=1`), ChatView (consumes the
 *   `?entry=` stash after history loads)
 * @downstream Calls: localStorage (guarded), store/slices/ui normalizeActiveTab
 * Tested by: `apps/web/components/cover/__tests__/coverGate.test.ts` (gate +
 *   tab links); `apps/web/components/about/__tests__/aboutPage.test.tsx`
 *   (about-route bypass, `?entry=` parsing, pending-scroll hand-off)
 */

import { normalizeActiveTab } from '../../store/slices/ui';

/** localStorage key remembering that this browser has seen the cover. */
export const COVER_SEEN_KEY = 'pas-cover-seen';

/** True when this browser has already seen (or deliberately skipped) the cover. */
export function hasSeenCover(): boolean {
  try {
    return localStorage.getItem(COVER_SEEN_KEY) === '1';
  } catch {
    // Storage unavailable (private mode, sandboxed iframe): treat as unseen —
    // the visitor sees the cover once per load, never a broken app.
    return false;
  }
}

/** Remember the skip. Failure degrades to once-per-load, never to a block. */
export function markCoverSeen(): void {
  try {
    localStorage.setItem(COVER_SEEN_KEY, '1');
  } catch {
    /* remembered-skip degrades to per-load; the app still renders */
  }
}

export interface CoverGateInput {
  /** window.location.pathname */
  pathname: string;
  /** window.location.search (leading '?' ok) */
  search: string;
  /** DEMO_MODE from api/client — the cover only exists for the exhibit. */
  demoMode: boolean;
  /** hasSeenCover() — injected so the decision stays pure. */
  seen: boolean;
}

/**
 * @description The anti-gate ruling, as one pure function: first visit shows
 * the cover, everything else goes straight to the observatory. Precedence:
 * real deployment › explicit `?cover=1` re-entry › `?skip=1` › direct
 * `/observatory` link › remembered skip › first visit.
 *
 * @upstream App.tsx useState initializer; DemoBanner re-entry navigation
 * @downstream Boolean only — no side effects, no storage writes
 */
export function shouldShowCover({ pathname, search, demoMode, seen }: CoverGateInput): boolean {
  if (!demoMode) return false;
  if (pathname === '/about' || pathname === '/efficiencies') return false;
  const params = new URLSearchParams(search);
  if (params.get('cover') === '1') return true;
  if (params.get('skip') === '1') return false;
  if (pathname === '/observatory') return false;
  return !seen;
}

/**
 * @description Read a deep-link view from `?tab=` (cover itinerary links,
 * shareable URLs like `/observatory?tab=sim`). Absent → null (leave the
 * persisted tab alone). Present → normalized through the store's own
 * normalizeActiveTab, so legacy ids map ('gallery'→'media') and garbage
 * falls back to 'chat' exactly like every other tab write.
 */
export function getDeepLinkTab(search: string): string | null {
  const raw = new URLSearchParams(search).get('tab');
  if (!raw) return null;
  return normalizeActiveTab(raw);
}

/**
 * @description Read a deep-linked history-entry id from `?entry=` (the About
 * page's observer-effect question links straight to the specimen's
 * exhibit-consent exchange). Absent or non-positive-integer → null.
 */
export function getDeepLinkEntryId(search: string): number | null {
  const raw = new URLSearchParams(search).get('entry');
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 && String(id) === raw ? id : null;
}

/**
 * One-shot hand-off of the `?entry=` deep link from App boot to ChatView.
 * Module-scoped (not the store): it is consumed exactly once, right after the
 * first history load, and must never survive into later renders or persist.
 */
let pendingEntryScroll: number | null = null;

/** Stash a deep-linked entry id for ChatView to consume after history loads. */
export function setPendingEntryScroll(id: number | null): void {
  pendingEntryScroll = id;
}

/** Take the stashed entry id (clears it — a deep link lands at most once). */
export function consumePendingEntryScroll(): number | null {
  const id = pendingEntryScroll;
  pendingEntryScroll = null;
  return id;
}
