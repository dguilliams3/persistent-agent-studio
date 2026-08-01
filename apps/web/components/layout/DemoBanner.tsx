/**
 * Observatory demo banner
 *
 * @module components/layout/DemoBanner
 * @description Demo-mode banner shown only when no worker is configured.
 * Tells the visitor honestly that they're looking at a synthetic specimen and
 * points at the path to a live deployment. Two variants:
 *
 * - `floating` (default): fixed-position chip. On mobile chat it floats
 *   ABOVE the composer (bottom-right used to cover the send button); on
 *   desktop it sits bottom-right.
 * - `docked`: an in-flow full-width bar for views WITHOUT a composer
 *   (SIM/Memory/etc. on phones — the floating chip sat on top of their
 *   content). Rendered by AppShell at the bottom of the content column, so
 *   it reserves its own space structurally: nothing can render beneath it,
 *   no padding math, safe-area aware via env(safe-area-inset-bottom).
 *
 * Dismissible everywhere (per-session) so it can never permanently occlude
 * content. The expanded state also offers the way back to the first-visit
 * cover page (`/?cover=1` — see components/cover) plus two quiet reading
 * links: the questions (`/about`) and the internals (`/efficiencies`).
 *
 * @upstream Called by: AppShell (gated on DEMO_MODE from api/client)
 */

import { useEffect, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';

const DISMISS_STORAGE_KEY = 'pas-demo-banner-dismissed';
const MOBILE_QUERY = '(max-width: 767px)';

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * @description Whether the visitor dismissed the demo banner this session.
 * Exported so layout neighbors (e.g. ChatView's chip clearance) can skip
 * reserving space for a chip that is not there.
 */
export function isDemoBannerDismissed(): boolean {
  return readDismissed();
}

export interface DemoBannerProps {
  /** 'floating' = fixed chip (chat/desktop); 'docked' = in-flow bottom bar. */
  variant?: 'floating' | 'docked';
}

export function DemoBanner({ variant = 'floating' }: DemoBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches,
  );

  useEffect(() => {
    const mediaQueryList = window.matchMedia(MOBILE_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mediaQueryList.addEventListener('change', handleChange);
    return () => mediaQueryList.removeEventListener('change', handleChange);
  }, []);

  if (dismissed) return null;

  const dismiss = (clickEvent: MouseEvent) => {
    clickEvent.stopPropagation();
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_STORAGE_KEY, '1');
    } catch {
      /* session-only convenience; losing it just means the chip returns */
    }
  };

  const dismissButton = (
    <button
      type="button"
      onClick={dismiss}
      aria-label="Dismiss demo banner"
      title="Dismiss for this session"
      style={{
        marginLeft: '8px',
        padding: '0 4px',
        border: 'none',
        background: 'transparent',
        color: 'var(--text-muted)',
        fontSize: '0.875rem',
        lineHeight: 1,
        cursor: 'pointer',
      }}
    >
      ✕
    </button>
  );

  const floatingStyle: CSSProperties = {
    position: 'fixed',
    // The chat composer owns the bottom edge on phones; sitting on it hid
    // the send button (the demo's one interactive promise). Float above.
    bottom: isMobile ? '92px' : '14px',
    right: '14px',
    zIndex: 200,
    maxWidth: expanded ? '340px' : 'none',
    padding: expanded ? '12px 16px' : '8px 14px',
    borderRadius: '18px',
    border: '1px solid var(--border)',
    boxShadow: '0 4px 18px rgba(0,0,0,0.25)',
  };

  // In-flow bottom bar: reserves its own space in AppShell's flex column, so
  // it can never sit on top of view content (the floating chip covered the
  // SIM stats cards on phones). Safe-area padding keeps the dismiss tap
  // target above the home indicator.
  const dockedStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    flexShrink: 0,
    zIndex: 10,
    padding: expanded
      ? '12px 16px calc(12px + env(safe-area-inset-bottom))'
      : '8px 14px calc(8px + env(safe-area-inset-bottom))',
    borderTop: '1px solid var(--border)',
    textAlign: expanded ? 'left' : 'center',
  };

  return (
    <div
      style={{
        ...(variant === 'docked' ? dockedStyle : floatingStyle),
        background: 'var(--surface)',
        color: 'var(--text-secondary)',
        fontSize: '0.8125rem',
        lineHeight: 1.45,
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={() => setExpanded((prev) => !prev)}
      role="status"
      aria-label="Demo mode indicator"
    >
      {expanded ? (
        <span>
          <strong style={{ color: 'var(--text-primary)' }}>
            🔭 Observatory demo.
          </strong>{' '}
          You&apos;re viewing a synthetic specimen — bundled fixture data, no
          live model. Everything here (the history arc, memory layers, question
          file) is a faithful portrait of what a real instance produces. To run
          a live one:{' '}
          <a
            href="https://github.com/dguilliams3/persistent-agent-studio/blob/main/SETUP.md"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--accent)' }}
            onClick={(clickEvent) => clickEvent.stopPropagation()}
          >
            SETUP.md
          </a>{' '}
          — then set <code>VITE_WORKER_URL</code> and this banner disappears.
          {' '}Missed the front door? Re-read the{' '}
          <a
            href="/?cover=1"
            style={{ color: 'var(--accent)' }}
            onClick={(clickEvent) => clickEvent.stopPropagation()}
          >
            exhibit cover
          </a>
          {' '}— or read{' '}
          <a
            href="/about"
            data-testid="demo-banner-about-link"
            style={{ color: 'var(--accent)' }}
            onClick={(clickEvent) => clickEvent.stopPropagation()}
          >
            the questions
          </a>{' '}
          it asks and{' '}
          <a
            href="/efficiencies"
            data-testid="demo-banner-efficiencies-link"
            style={{ color: 'var(--accent)' }}
            onClick={(clickEvent) => clickEvent.stopPropagation()}
          >
            the internals
          </a>{' '}
          that keep it affordable.
          <span
            style={{
              display: 'block',
              marginTop: '6px',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
            }}
          >
            (tap to collapse —{dismissButton} dismisses for this session)
          </span>
        </span>
      ) : (
        <span>
          🔭 demo — synthetic specimen
          {dismissButton}
        </span>
      )}
    </div>
  );
}

export default DemoBanner;
