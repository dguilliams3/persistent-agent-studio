/**
 * Root Application Component
 *
 * @module App
 * @description Top-level component wrapping the entire application with
 * error boundary, the demo's first-visit cover page, and authentication
 * gating. Renders AppShell which provides the icon rail navigation and
 * responsive view system.
 *
 * Cover routing (demo exhibit only — see coverGate.ts for the contract):
 * `/` shows the cover on the FIRST visit; entering is remembered in
 * localStorage so returning visitors land straight in the observatory.
 * `/observatory` is always the app. `?tab=<view>` deep-links a view (the
 * cover's itinerary uses this; the links are shareable). Real deployments
 * (VITE_WORKER_URL set) never render the cover on any path.
 *
 * @upstream Called by: main.tsx
 * @downstream Calls: ErrorBoundary, CoverPage, ProtectedRoute, AppShell,
 *   coverGate, store (setActiveTab for deep links), usePersonaDocumentTitle
 */

import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { usePersonaDocumentTitle } from './hooks/usePersonaName';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { CoverPage } from './components/cover/CoverPage';
import { DEMO_MODE } from './api/client';
import { useAppStore } from './store';
import {
  shouldShowCover,
  hasSeenCover,
  markCoverSeen,
  getDeepLinkTab,
  getDeepLinkEntryId,
  setPendingEntryScroll,
} from './components/cover/coverGate';

/** Lazy: reading pages nobody hits on the hot path pay no bundle tax. */
const AboutPage = lazy(() => import('./components/about/AboutPage'));
const EfficienciesPage = lazy(() => import('./components/efficiencies/EfficienciesPage'));

/**
 * @description Apply a `?tab=` deep link to the store. Must run BEFORE
 * AppShell mounts: on laptop, AppShell seeds its split-view panel from the
 * store's activeTab in a useState initializer, so a tab set after mount
 * would move the rail highlight but never open the panel.
 */
function applyDeepLink(search: string): void {
  const tab = getDeepLinkTab(search);
  if (tab) useAppStore.getState().setActiveTab(tab);
  // `?entry=` rides alongside `?tab=chat`: stash the target for ChatView to
  // consume after the first history load (the About page's exhibit links).
  setPendingEntryScroll(getDeepLinkEntryId(search));
}

/**
 * @description Root application component.
 *
 * Flow: ErrorBoundary > (first demo visit: CoverPage) > ProtectedRoute
 * (login gate) > AppShell. AppShell handles all navigation, polling, and
 * view rendering.
 *
 * @returns {React.ReactElement} The wrapped application
 */
export default function App() {
  /**
   * The tab strip says who lives here. index.html ships the neutral title;
   * this upgrades it to "<persona> - Neural Observatory" once the active
   * persona hydrates. Mounted at the root so it covers every route.
   */
  usePersonaDocumentTitle();

  /**
   * `/about` and `/efficiencies` are plain routed reading pages — the open
   * questions behind the project, and the cache/summarization story. Both
   * render in demo mode AND real deployments (the content is the system's,
   * not the specimen's), bypass the cover gate (coverGate agrees), and never
   * mark the cover seen: reading about the instrument shouldn't spend a
   * first-timer's front door.
   */
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const isAboutRoute = pathname === '/about';
  const isEfficienciesRoute = pathname === '/efficiencies';

  const [showCover, setShowCover] = useState(() => {
    if (typeof window === 'undefined') return false;
    const show = shouldShowCover({
      pathname: window.location.pathname,
      search: window.location.search,
      demoMode: DEMO_MODE,
      seen: hasSeenCover(),
    });
    // Straight into the app (returning visitor, /observatory link, ?skip=1):
    // honor any shared deep link before the shell mounts.
    if (!show) applyDeepLink(window.location.search);
    return show;
  });

  /**
   * Enter the observatory: remember the skip (the anti-gate promise — this
   * browser never sees the cover again), apply the chosen or shared deep
   * link before the shell mounts, and normalize the URL to /observatory.
   *
   * `entryId` is the cover's own version of the `?entry=` landing /about uses:
   * a card that quotes the transcript hands over the entry it quoted, and
   * ChatView scrolls there once history loads. Cards without a quote pass
   * nothing and the reader lands at the latest entry as before.
   */
  const handleEnter = useCallback((view?: string, entryId?: number) => {
    markCoverSeen();
    const target = view ?? getDeepLinkTab(window.location.search);
    if (target) useAppStore.getState().setActiveTab(target);
    setPendingEntryScroll(
      entryId ?? getDeepLinkEntryId(window.location.search),
    );
    try {
      window.history.replaceState(null, '', '/observatory');
    } catch {
      /* history API unavailable (sandboxed iframe) — state still advances */
    }
    setShowCover(false);
  }, []);

  /**
   * Anyone already inside the demo observatory has implicitly seen the
   * cover — remember it so no future visit gets gated (e.g. first arrival
   * via a direct /observatory or ?skip=1 link).
   */
  useEffect(() => {
    if (!showCover && DEMO_MODE && !isAboutRoute && !isEfficienciesRoute) markCoverSeen();
  }, [showCover, isAboutRoute, isEfficienciesRoute]);

  if (isAboutRoute) {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <AboutPage />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (isEfficienciesRoute) {
    return (
      <ErrorBoundary>
        <Suspense fallback={null}>
          <EfficienciesPage />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (showCover) {
    return (
      <ErrorBoundary>
        <CoverPage onEnter={handleEnter} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    </ErrorBoundary>
  );
}
