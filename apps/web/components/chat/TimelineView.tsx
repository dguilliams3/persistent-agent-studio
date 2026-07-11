/**
 * Timeline View — the full history feed
 *
 * @module components/chat/TimelineView
 * @description Every history entry, newest first, with type filtering.
 * Restores the "timeline" mode lost when the original ChatTab was deleted —
 * since then the raw feed had no home anywhere in the app, despite the
 * store's chatViewMode/historyTypeFilter surviving the whole time.
 *
 * @upstream Called by: ChatView (when chatViewMode === 'timeline')
 * @downstream Calls: HistoryEntryRow, TypeFilterDropdown (ui)
 */

import { useMemo } from 'react';
import type { HistoryEntry } from '@persistence/db';
import { HistoryEntryRow, TypeFilterDropdown } from '../ui';
import { FILTER_OPTIONS } from '../ui/historyUtils';
import { useAppStore } from '../../store';

export interface TimelineViewProps {
  history: HistoryEntry[];
}

export function TimelineView({ history }: TimelineViewProps) {
  const historyTypeFilter = useAppStore(
    (s) => s.historyTypeFilter,
  ) as string;
  const setHistoryTypeFilter = useAppStore(
    (s) => s.setHistoryTypeFilter,
  ) as (filter: string) => void;

  /** Types included by the active filter category ('all' → everything). */
  const activeTypes = useMemo(() => {
    if (historyTypeFilter === 'all') return null;
    const option = FILTER_OPTIONS.find((o) => o.value === historyTypeFilter);
    return option?.types ? new Set(option.types) : null;
  }, [historyTypeFilter]);

  /** Newest first — a feed, not a conversation. */
  const entries = useMemo(() => {
    const filtered = activeTypes
      ? history.filter((entry) => activeTypes.has(entry.type))
      : history;
    return [...filtered].reverse();
  }, [history, activeTypes]);

  /** Entry counts per filter category (for the dropdown badges). */
  const counts = useMemo(() => {
    const byCategory: Record<string, number> = { all: history.length };
    for (const option of FILTER_OPTIONS) {
      if (!option.types) continue;
      const types = new Set(option.types);
      byCategory[option.value] = history.filter((entry) =>
        types.has(entry.type),
      ).length;
    }
    return byCategory;
  }, [history]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-sm)',
        padding: 'var(--spacing-md) var(--spacing-lg)',
        maxWidth: '760px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <TypeFilterDropdown
          options={FILTER_OPTIONS.map(({ value, label, icon }) => ({
            value,
            label,
            icon,
          }))}
          selected={historyTypeFilter === 'all' ? null : [historyTypeFilter]}
          onChange={(selected) =>
            setHistoryTypeFilter(selected?.[0] ?? 'all')
          }
          counts={counts}
          placeholder="All entries"
        />
      </div>
      {entries.length === 0 ? (
        <p
          style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.875rem',
            padding: 'var(--spacing-xl) 0',
          }}
        >
          No entries match this filter yet.
        </p>
      ) : (
        entries.map((entry) => (
          <HistoryEntryRow
            key={entry.id}
            entry={entry as unknown as Record<string, unknown>}
          />
        ))
      )}
    </div>
  );
}

export default TimelineView;
