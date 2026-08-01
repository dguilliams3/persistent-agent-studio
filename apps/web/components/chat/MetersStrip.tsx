/**
 * Meters Strip — current internal state, always visible
 *
 * @module components/chat/MetersStrip
 * @description Slim strip showing the persona's live meters (MeterPills)
 * above the chat thread. Tapping the strip toggles the full MetersDisplay
 * (bars + trend histories) inline. This restores the state display whose
 * mount was lost when the original ChatTab was deleted — the meters endpoint
 * and components survived; nothing rendered them.
 *
 * @upstream Called by: ChatView
 * @downstream Calls: api.getMeters, MeterPills, MetersDisplay
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../../api/client';
import { MeterPills, MetersDisplay } from '../ui';

/** Shape MeterPills/MetersDisplay consume (subset of GET /meters). */
interface MetersPayload {
  values: Record<string, number>;
  histories?: Record<string, number[]>;
}

const REFRESH_MS = 60_000; // meters move on cycle cadence; gentle refresh

export function MetersStrip() {
  const [meters, setMeters] = useState<MetersPayload | null>(null);
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = (await api.getMeters()) as Partial<MetersPayload>;
      if (data && data.values) {
        setMeters({ values: data.values, histories: data.histories });
      }
    } catch {
      /* meters are decorative — never break the chat over them */
    }
  }, []);

  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  // Close the trends popover on outside click.
  useEffect(() => {
    if (!expanded) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [expanded]);

  if (!meters?.values) return null;

  // Inline trigger + absolute popover: the meters sit on the header's single
  // control row (not a stacked block), and tapping opens the trend bars as a
  // dropdown instead of reflowing the header.
  return (
    <div ref={rootRef} style={{ position: 'relative', minWidth: 0 }}>
      <button
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} state meters`}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          maxWidth: '100%',
        }}
        title="Current internal state — tap for trends"
      >
        <MeterPills meters={meters} />
      </button>
      {expanded && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 40,
            width: 'min(320px, 80vw)',
            padding: 'var(--spacing-sm)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-raised)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <MetersDisplay meters={meters} />
        </div>
      )}
    </div>
  );
}

export default MetersStrip;
