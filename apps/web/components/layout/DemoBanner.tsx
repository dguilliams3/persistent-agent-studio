/**
 * Observatory demo banner
 *
 * @module components/layout/DemoBanner
 * @description Floating chip shown only in demo mode (no worker configured).
 * Tells the visitor honestly that they're looking at a synthetic specimen and
 * points at the path to a live deployment. Fixed-position so it never
 * disturbs the AppShell's dvh layout math — and pointer-safe: on mobile it
 * floats ABOVE the chat composer (bottom-right used to cover the send
 * button), and it is dismissible everywhere (per-session) so it can never
 * permanently occlude content. The expanded chip also offers the way back
 * to the first-visit cover page (`/?cover=1` — see components/cover) plus
 * two quiet reading links: the questions (`/about`) and the internals
 * (`/efficiencies`).
 *
 * @upstream Called by: AppShell (gated on DEMO_MODE from api/client)
 */

import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';

const DISMISS_STORAGE_KEY = 'pas-demo-banner-dismissed';
const MOBILE_QUERY = '(max-width: 767px)';

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function DemoBanner() {
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

  return (
    <div
      style={{
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
        background: 'var(--surface)',
        color: 'var(--text-secondary)',
        fontSize: '0.8125rem',
        lineHeight: 1.45,
        boxShadow: '0 4px 18px rgba(0,0,0,0.25)',
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
