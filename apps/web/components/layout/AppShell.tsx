/**
 * App Shell — Responsive Layout Container
 *
 * @module components/layout/AppShell
 * @description Wraps the entire authenticated app. Manages the icon rail,
 * active view rendering, and responsive breakpoints.
 *
 * - Mobile (< 768px): Rail hidden behind hamburger. Views are full-screen. No SplitView.
 * - Tablet (768-1024px): Rail visible on left. Views are full-screen (replace chat). No SplitView.
 * - Laptop (> 1024px): Rail visible. SplitView wraps chat + panel.
 *
 * @antipattern Do NOT fetch data here — stores fetch, components read.
 * @antipattern Do NOT define domain types locally.
 * @antipattern Do NOT use raw hex colors.
 *
 * @upstream Called by: App.tsx
 * @downstream Calls: IconRail, SplitView, ChatView, MemoryView, MediaView, EditorView, VoiceTab, store
 */

import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { Menu } from 'lucide-react';
import { IconRail } from './IconRail';
import { SplitView } from './SplitView';
import { ChatView } from '../../views/ChatView';
import { useAppStore } from '../../store';
import type { ActiveView } from '../../types';
import { Lightbox } from './Lightbox';
import { LogToastStack } from '../common/LogToastStack';
import { GradientMesh, LoadingSkeleton } from '../ui';
import ErrorBoundary from '../common/ErrorBoundary';
import { DEMO_MODE } from '../../api/client';
import { DemoBanner } from './DemoBanner';

/** Lazy-loaded views — only ChatView loads eagerly. */
const MemoryView = lazy(() => import('../../views/MemoryView'));
const MediaView = lazy(() => import('../../views/MediaView'));
const EditorView = lazy(() => import('../../views/EditorView'));
const VoiceTab = lazy(() => import('../tabs/VoiceTab'));
const SettingsTab = lazy(() => import('../tabs/SettingsTab'));
const SemanticMonitorTab = lazy(() => import('../tabs/SemanticMonitorTab'));

/** Suspense fallback spinner. */
function ViewSpinner() {
  return <LoadingSkeleton variant="spinner" className="h-full flex-1" />;
}

function SettingsPanelWithBuildFooter() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <SettingsTab />
      </div>
      <div
        style={{
          flexShrink: 0,
          padding: 'var(--spacing-sm) var(--spacing-md)',
          borderTop: '1px solid var(--border-subtle)',
          color: 'var(--text-muted)',
          fontSize: '0.6875rem',
          backgroundColor: 'var(--background)',
        }}
      >
        build {__BUILD_ID__}
      </div>
    </div>
  );
}

/** Hook for responsive breakpoint detection. */
function useBreakpoint() {
  const [width, setWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024,
  );

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width <= 1024,
    isLaptop: width > 1024,
  };
}

/** Non-chat views that can appear as a panel on laptop. */
const PANEL_VIEWS = new Set<ActiveView>(['memory', 'media', 'editor', 'voice', 'settings', 'sim']);

/** All valid ActiveView values (for defense-in-depth guard against legacy persisted garbage). */
const VALID_VIEWS = new Set<ActiveView>(['chat', 'memory', 'media', 'editor', 'voice', 'settings', 'sim']);

/**
 * Renders the tool panel content for a given view.
 * Wraps lazy views in Suspense for code splitting.
 */
function PanelContent({
  view,
  isResearchMode,
}: {
  view: ActiveView;
  isResearchMode: boolean;
}) {
  return (
    <Suspense fallback={<ViewSpinner />}>
      <div style={{
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {view === 'memory' && <MemoryView isPanel={!isResearchMode} />}
        {view === 'media' && <MediaView />}
        {view === 'editor' && <EditorView />}
        {view === 'voice' && <VoiceTab isPanel />}
        {view === 'settings' && <SettingsPanelWithBuildFooter />}
        {view === 'sim' && <SemanticMonitorTab />}
      </div>
    </Suspense>
  );
}

/**
 * AppShell — the responsive rail + content area container.
 *
 * Manages `activeView` state through the Zustand store (persisted as activeTab).
 * Renders the icon rail and the currently active view.
 * On laptop, uses SplitView for chat + tool panel side by side.
 */
export function AppShell() {
  const { isMobile, isLaptop } = useBreakpoint();

  /** Rail visibility on mobile (toggled by hamburger). */
  const [railOpen, setRailOpen] = useState(false);

  /** Chat collapse state for laptop research mode. */
  const [chatCollapsed, setChatCollapsed] = useState(false);

  /** Read active view from store (persisted). */
  const activeTab = useAppStore((s) => s.activeTab) as string;
  const setActiveTab = useAppStore((s) => s.setActiveTab) as (tab: string) => void;
  const activePersona = useAppStore((s) => s.activePersona) as {
    name?: string;
    profilePicture?: string | null;
  } | null;
  const logEntries = useAppStore((s) => s.log) as Array<{ msg: string; time: number }>;

  /** Map store's activeTab to our typed ActiveView (with validation). */
  const activeView: ActiveView = VALID_VIEWS.has(activeTab as ActiveView)
    ? (activeTab as ActiveView)
    : 'chat';

  /**
   * On laptop, track which panel is open (null = no panel, chat full width).
   * On mobile/tablet, activeView directly controls what's shown.
   * Initialized from persisted activeTab so rail highlight syncs on load.
   * Uses same VALID_VIEWS guard as activeView for consistency.
   */
  const [laptopPanel, setLaptopPanel] = useState<ActiveView | null>(() => {
    const persisted = VALID_VIEWS.has(activeTab as ActiveView)
      ? (activeTab as ActiveView)
      : 'chat';
    return persisted && persisted !== 'chat' && PANEL_VIEWS.has(persisted)
      ? persisted
      : null;
  });

  /** Navigate to a view. Behavior depends on breakpoint. */
  const handleNavigate = useCallback(
    (view: ActiveView) => {
      if (isLaptop) {
        if (view === 'chat') {
          // Chat icon clicked — restore chat if collapsed, close panel
          setChatCollapsed(false);
          setLaptopPanel(null);
          setActiveTab('chat');
        } else if (PANEL_VIEWS.has(view)) {
          if (laptopPanel === view) {
            // Clicking active panel icon again closes the panel
            setChatCollapsed(false);
            setLaptopPanel(null);
            setActiveTab('chat');
          } else {
            // Open this panel alongside chat
            setLaptopPanel(view);
            setActiveTab(view);
          }
        }
      } else {
        // Mobile/tablet: full-screen navigation
        setActiveTab(view);
        if (isMobile) setRailOpen(false);
      }
    },
    [setActiveTab, isMobile, isLaptop, laptopPanel],
  );

  /** Toggle chat collapse (laptop research mode). */
  const handleToggleChatCollapse = useCallback(() => {
    setChatCollapsed((prev) => !prev);
  }, []);

  /** Toggle rail on mobile. */
  const toggleRail = useCallback(() => setRailOpen((prev) => !prev), []);
  const closeRail = useCallback(() => setRailOpen(false), []);

  /** Gallery actions needed by Lightbox. */
  const toggleImageBlur = useAppStore((s) => s.toggleImageBlur) as (id: number) => Promise<void>;
  const toggleImageVault = useAppStore((s) => s.toggleImageVault) as (id: number) => Promise<void>;
  // Un-narrowed: Lightbox delete path obtains password and passes full (id, password)
  const deleteGalleryImage = useAppStore((s) => s.deleteGalleryImage);

  /** Polling: keep store data fresh. */
  const storeFetchAll = useAppStore((s) => s.fetchAll) as () => Promise<void>;
  const fetchState = useAppStore((s) => s.fetchState) as () => Promise<void>;

  /** Initial data load + polling. */
  useEffect(() => {
    storeFetchAll();
    const interval = setInterval(() => {
      fetchState();
    }, 30000);
    return () => clearInterval(interval);
  }, [storeFetchAll, fetchState]);

  const personaName = activePersona?.name || 'Persona';
  const personaAvatar = activePersona?.profilePicture || null;

  /** Whether rail is visible (mobile: only when open, otherwise always). */
  const railVisible = isMobile ? railOpen : true;

  /**
   * On laptop, determine the effective active view for the rail highlight.
   * If a panel is open, highlight that panel icon. Otherwise highlight chat.
   */
  const railActiveView: ActiveView = isLaptop
    ? (laptopPanel || 'chat')
    : activeView;

  return (
    // Height comes from .app-shell-root (index.css): 100dvh with 100vh fallback.
    // Plain 100vh on mobile includes the area behind browser chrome, so the
    // header/hamburger sat above the visible viewport and the page panned
    // ("scroll up scrolls the whole app"). dvh tracks the real visible area.
    <div className="app-shell-root" style={{
      display: 'flex',
      width: '100%',
      overflow: 'hidden',
      backgroundColor: 'var(--background)',
      color: 'var(--text-primary)',
      position: 'relative',
    }}>
      <GradientMesh intensity="low" />

      {/* Observatory demo chip — only when no worker is configured */}
      {DEMO_MODE && <DemoBanner />}

      {/* Icon Rail */}
      <div style={{
        position: isMobile ? 'fixed' : 'relative',
        left: 0,
        top: 0,
        height: '100%',
        zIndex: isMobile ? 50 : 1,
        pointerEvents: isMobile && !railOpen ? 'none' : 'auto',
      }}>
        <IconRail
          activeView={railActiveView}
          onNavigate={handleNavigate}
          visible={railVisible}
          personaName={personaName}
          personaAvatar={personaAvatar}
          onClose={isMobile ? closeRail : undefined}
        />
      </div>

      {/* Main content area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Mobile header with hamburger */}
        {isMobile && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: 'var(--spacing-sm) var(--spacing-md)',
            borderBottom: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--background)',
            minHeight: '44px',
          }}>
            <button
              onClick={toggleRail}
              aria-label="Open navigation"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                minWidth: '44px',
                minHeight: '44px',
                padding: 0,
              }}
            >
              <Menu size={20} />
            </button>
            <span style={{
              flex: 1,
              textAlign: 'center',
              fontSize: '0.9375rem',
              fontWeight: 500,
              color: 'var(--text-primary)',
            }}>
              {personaName}
            </span>
            {/* Right spacer to center the name */}
            <div style={{ width: '44px' }} />
          </div>
        )}

        {/* View content */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {/* Laptop: SplitView with chat + panel */}
          {isLaptop && (
            <SplitView
              activePanel={laptopPanel}
              chatCollapsed={chatCollapsed}
              onToggleChatCollapse={handleToggleChatCollapse}
              chatContent={<ChatView />}
              panelContent={
                laptopPanel && PANEL_VIEWS.has(laptopPanel) ? (
                  /* Per-view boundary, keyed by view: a crashing panel must
                     never take down the shell — the rail stays alive and
                     navigating to another view remounts a fresh boundary. */
                  <ErrorBoundary key={`panel-${laptopPanel}`}>
                    <PanelContent
                      view={laptopPanel}
                      isResearchMode={chatCollapsed}
                    />
                  </ErrorBoundary>
                ) : null
              }
            />
          )}

          {/* Mobile + Tablet: full-screen views */}
          {!isLaptop && (
            <>
              {activeView === 'chat' && <ChatView />}
              {/* Per-view boundary, keyed by view: a crashing view must never
                  take down the shell — before this, a render error bubbled to
                  the ROOT boundary, killed the rail, and trapped the user on
                  the broken view (persisted activeTab re-trapped on reload). */}
              <ErrorBoundary key={`view-${activeView}`}>
                <Suspense fallback={<ViewSpinner />}>
                  {activeView === 'memory' && <MemoryView isPanel={false} />}
                  {activeView === 'media' && <MediaView />}
                  {activeView === 'editor' && <EditorView />}
                  {activeView === 'voice' && <VoiceTab isPanel={false} />}
                {activeView === 'settings' && <SettingsPanelWithBuildFooter />}
                  {activeView === 'sim' && <SemanticMonitorTab />}
                </Suspense>
              </ErrorBoundary>
            </>
          )}
        </div>
      </div>

      {/* Lightbox — rendered outside layout for proper overlay */}
      <Lightbox
        formatTime={(dateStr: string) => new Date(dateStr).toLocaleString()}
        toggleImageBlur={toggleImageBlur}
        toggleImageVault={toggleImageVault}
        deleteGalleryImage={deleteGalleryImage}
      />
      <LogToastStack entries={logEntries} />
    </div>
  );
}

export default AppShell;
