/**
 * Log Toast Stack
 *
 * @module components/common/LogToastStack
 * @description Lightweight viewport-bottom stack for error-flavored log entries.
 * Renders only failure entries (messages prefixed with "❌"), keeps at most
 * three visible, auto-dismisses after a short delay, and lets the user tap to
 * dismiss immediately.
 *
 * @upstream Called by: AppShell
 * @downstream Calls: none
 */

import { useEffect, useMemo, useRef, useState } from 'react';

export interface LogToastEntry {
  msg: string;
  time: number;
}

export interface LogToastStackProps {
  entries: LogToastEntry[];
}

const AUTO_DISMISS_MS = 6_000;
const MAX_VISIBLE_TOASTS = 3;

function getToastId(entry: LogToastEntry): string {
  return `${entry.time}:${entry.msg}`;
}

function isErrorEntry(entry: LogToastEntry): boolean {
  return entry.msg.trimStart().startsWith('❌');
}

export function LogToastStack({ entries }: LogToastStackProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const visibleEntries = useMemo(() => {
    const errorEntries = entries.filter(isErrorEntry);
    const latestEntries = errorEntries.slice(-MAX_VISIBLE_TOASTS);
    return latestEntries.filter((entry) => !dismissedIds.has(getToastId(entry)));
  }, [dismissedIds, entries]);

  useEffect(() => {
    const visibleIds = new Set(visibleEntries.map(getToastId));

    for (const entry of visibleEntries) {
      const id = getToastId(entry);
      if (timersRef.current.has(id)) continue;

      const timer = setTimeout(() => {
        setDismissedIds((current) => {
          const next = new Set(current);
          next.add(id);
          return next;
        });
        timersRef.current.delete(id);
      }, AUTO_DISMISS_MS);

      timersRef.current.set(id, timer);
    }

    for (const [id, timer] of timersRef.current) {
      if (visibleIds.has(id)) continue;
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, [visibleEntries]);

  useEffect(
    () => () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
      timersRef.current.clear();
    },
    [],
  );

  const dismissToast = (toastId: string) => {
    setDismissedIds((current) => {
      const next = new Set(current);
      next.add(toastId);
      return next;
    });
    const timer = timersRef.current.get(toastId);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(toastId);
    }
  };

  if (visibleEntries.length === 0) return null;

  return (
    <div
      aria-live="assertive"
      style={{
        position: 'fixed',
        right: 'var(--spacing-md)',
        bottom: 'var(--spacing-md)',
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 'var(--spacing-sm)',
        alignItems: 'flex-end',
        zIndex: 70,
        pointerEvents: 'none',
        width: 'min(92vw, 28rem)',
      }}
    >
      {visibleEntries.map((entry) => {
        const toastId = getToastId(entry);
        return (
          <button
            key={toastId}
            type="button"
            onClick={() => dismissToast(toastId)}
            style={{
              pointerEvents: 'auto',
              width: '100%',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              borderRadius: '14px',
              border: '1px solid rgb(var(--danger) / 0.35)',
              borderLeftWidth: '4px',
              borderLeftColor: 'rgb(var(--danger))',
              background: 'var(--surface-raised)',
              color: 'var(--text-primary)',
              boxShadow: '0 14px 32px rgba(0, 0, 0, 0.18)',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--spacing-sm)',
            }}
            aria-label={entry.msg}
          >
            <span aria-hidden="true" style={{ color: 'rgb(var(--danger))' }}>
              ❌
            </span>
            <span
              style={{
                fontSize: '0.875rem',
                lineHeight: 1.45,
                whiteSpace: 'pre-wrap',
              }}
            >
              {entry.msg}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default LogToastStack;
