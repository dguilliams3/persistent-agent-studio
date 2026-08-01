/**
 * Meters Strip — current internal state, always visible
 *
 * @module components/chat/MetersStrip
 * @description Slim strip showing the persona's live meters (MeterPills)
 * above the chat thread. Tapping the strip opens the full MetersDisplay
 * (meter names + bars + trend histories) as a popover — the answer to "what
 * do A7 C8 N8 E8 D7 mean". The popover renders through a React portal into
 * document.body with fixed positioning: it used to render inline inside
 * `.chat-header-meters`, whose overflow:hidden (the edge-fade mask) clipped
 * it entirely — tapping the pills appeared to do nothing. This restores the
 * state display whose mount was lost when the original ChatTab was deleted —
 * the meters endpoint and components survived; nothing rendered them.
 *
 * @upstream Called by: ChatView
 * @downstream Calls: api.getMeters, MeterPills, MetersDisplay
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import api from '../../api/client';
import { MeterPills, MetersDisplay } from '../ui';

/** Shape MeterPills/MetersDisplay consume (subset of GET /meters). */
interface MetersPayload {
  values: Record<string, number>;
  histories?: Record<string, number[]>;
}

const REFRESH_MS = 60_000; // meters move on cycle cadence; gentle refresh

/** Fixed-position anchor for the portaled popover, from the trigger's rect. */
interface PopoverPosition {
  top: number;
  left: number;
  width: number;
}

export function MetersStrip() {
  const [meters, setMeters] = useState<MetersPayload | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  // Close the meters popover on outside click. The popover lives in a
  // portal, so "outside" must check both the trigger strip AND the popover.
  useEffect(() => {
    if (!expanded) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [expanded]);

  /**
   * Anchor the popover under the pills, clamped inside the viewport (at
   * 390px the pills sit mid-header; an unclamped 320px dropdown would run
   * off the right edge).
   */
  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      if (next && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const width = Math.min(320, window.innerWidth - 16);
        const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
        setPopoverPosition({ top: rect.bottom + 6, left, width });
      }
      return next;
    });
  }, []);

  if (!meters?.values) return null;

  // Inline trigger + portaled popover: the meters sit on the header's single
  // control row (not a stacked block), and tapping opens the named meter
  // bars as a dropdown instead of reflowing the header. The portal escapes
  // .chat-header-meters' overflow:hidden edge-fade mask, which used to clip
  // the popover into invisibility.
  return (
    <div ref={rootRef} style={{ position: 'relative', minWidth: 0 }}>
      <button
        ref={triggerRef}
        onClick={toggleExpanded}
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
        title="Current internal state — tap for meter names and trends"
      >
        <MeterPills meters={meters} />
      </button>
      {expanded &&
        popoverPosition &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: popoverPosition.top,
              left: popoverPosition.left,
              width: popoverPosition.width,
              maxHeight: `calc(100vh - ${popoverPosition.top + 12}px)`,
              overflowY: 'auto',
              zIndex: 300,
              padding: 'var(--spacing-sm)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-raised)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <MetersDisplay meters={meters} />
          </div>,
          document.body,
        )}
    </div>
  );
}

export default MetersStrip;
