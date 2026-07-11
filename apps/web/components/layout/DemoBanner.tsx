/**
 * Observatory demo banner
 *
 * @module components/layout/DemoBanner
 * @description Floating chip shown only in demo mode (no worker configured).
 * Tells the visitor honestly that they're looking at a synthetic specimen and
 * points at the path to a live deployment. Fixed-position so it never
 * disturbs the AppShell's dvh layout math.
 *
 * @upstream Called by: AppShell (gated on DEMO_MODE from api/client)
 */

import { useState } from 'react';

export function DemoBanner() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '14px',
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
          <span
            style={{
              display: 'block',
              marginTop: '6px',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
            }}
          >
            (tap to collapse)
          </span>
        </span>
      ) : (
        <span>🔭 demo — synthetic specimen</span>
      )}
    </div>
  );
}

export default DemoBanner;
