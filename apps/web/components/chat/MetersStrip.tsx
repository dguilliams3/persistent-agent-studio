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

import { useEffect, useState, useCallback } from 'react';
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

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  if (!meters?.values) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-xs)',
        padding: 'var(--spacing-xs) var(--spacing-lg)',
      }}
    >
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
          justifyContent: 'center',
        }}
        title="Current internal state — tap for trends"
      >
        <MeterPills meters={meters} />
      </button>
      {expanded && (
        <div style={{ maxWidth: '640px', margin: '0 auto', width: '100%' }}>
          <MetersDisplay meters={meters} />
        </div>
      )}
    </div>
  );
}

export default MetersStrip;
