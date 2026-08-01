/**
 * Action Group — the chat "drip-down"
 *
 * @module components/chat/ActionGroup
 * @description Collapsible accordion for a run of consecutive non-message
 * history entries between chat bubbles. Collapsed by default: an icon, a
 * summary ("Thought · 2:45 PM" / "3 actions · 2:45 PM"), and a one-line muted
 * preview of the first entry — texture without drowning the conversation.
 * Expanding reveals full HistoryEntryRow renderings.
 *
 * The accordion header is the ONLY tap target — bubbles and entry text stay
 * fully selectable (deliberate: whole-row tap targets make copy-paste futile).
 *
 * `attract` adds a soft breathing glow that teaches the affordance (used by
 * the demo for the first group only, until first interaction).
 *
 * @upstream Called by: ChatView (per 'actions' segment)
 * @downstream Calls: Accordion, HistoryEntryRow, Icon (ui)
 */

import { useState } from 'react';
import type { HistoryEntry } from '@persistence/db';
import { Accordion, Icon, HistoryEntryRow } from '../ui';
import { TYPE_LABELS, formatTime } from '../ui/historyUtils';

/** Icon per type — priority order picks the group's face. */
const GROUP_ICON_PRIORITY: Array<[string, string]> = [
  ['thought', 'Brain'],
  ['curiosity', 'Telescope'],
  ['question_add', 'HelpCircle'],
  ['question_resolve', 'CheckCircle'],
  ['remember', 'Bookmark'],
  ['search_query', 'Search'],
  ['search_result', 'Search'],
  ['art_request', 'Image'],
  ['art_result', 'Image'],
  ['learned_add', 'BookOpen'],
  ['note_saved', 'StickyNote'],
  ['summarize', 'Layers'],
  ['sleep', 'Moon'],
  ['exist', 'Sparkles'],
  ['status_update', 'Activity'],
];

function groupIcon(entries: HistoryEntry[]): string {
  const types = new Set(entries.map((e) => e.type));
  for (const [type, icon] of GROUP_ICON_PRIORITY) {
    if (types.has(type)) return icon;
  }
  return 'Activity';
}

function groupSummary(entries: HistoryEntry[]): string {
  const time = formatTime(entries[0].created_at);
  if (entries.length === 1) {
    const label =
      TYPE_LABELS[entries[0].type] || entries[0].type.replace(/_/g, ' ');
    return `${label} · ${time}`;
  }
  return `${entries.length} actions · ${time}`;
}

/** One-line muted preview of the first entry's content. */
function groupPreview(entries: HistoryEntry[]): string {
  const first = entries[0]?.content || '';
  return first.length > 110 ? `${first.slice(0, 110)}…` : first;
}

const ATTRACT_KEYFRAMES = `
@keyframes actionGroupAttract {
  0%, 100% { box-shadow: 0 0 0 0 transparent; }
  50% { box-shadow: 0 0 14px 1px color-mix(in srgb, var(--accent) 45%, transparent); }
}
@media (prefers-reduced-motion: reduce) {
  .action-group-attract { animation: none !important; }
}
`;

export interface ActionGroupProps {
  entries: HistoryEntry[];
  /** Soft breathing glow hinting "this opens" — demo affordance teaching. */
  attract?: boolean;
  /** Called on first expand (used to retire the attract glow). */
  onFirstOpen?: () => void;
  /** Enables inline rewrite pencils for every collapsed history row. */
  editMode?: boolean;
  /** Opens the inline rewrite editor for a specific history row. */
  onEditEntry?: (entryId: number) => void;
}

export function ActionGroup({
  entries,
  attract = false,
  onFirstOpen,
  editMode = false,
  onEditEntry,
}: ActionGroupProps) {
  const [opened, setOpened] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const showAttract = attract && !opened;

  return (
    <div
      className={showAttract ? 'action-group-attract' : undefined}
      style={{
        maxWidth: '640px',
        margin: '0 auto',
        width: '100%',
        borderRadius: 'var(--radius-md, 12px)',
        ...(showAttract
          ? { animation: 'actionGroupAttract 2.6s ease-in-out infinite' }
          : {}),
      }}
    >
      {showAttract && <style>{ATTRACT_KEYFRAMES}</style>}
      <Accordion
        variant="card"
        icon={<Icon name={groupIcon(entries)} size={14} />}
        count={entries.length > 1 ? entries.length : undefined}
        title={
          <span
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              minWidth: 0,
              textAlign: 'left',
            }}
          >
            <span
              style={{
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
              }}
            >
              {groupSummary(entries)}
            </span>
            {!isOpen && (
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {groupPreview(entries)}
              </span>
            )}
          </span>
        }
        onToggle={(nowOpen) => {
          setIsOpen(nowOpen);
          if (nowOpen && !opened) {
            setOpened(true);
            onFirstOpen?.();
          }
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-sm)',
          }}
        >
          {entries.map((entry) => (
            <HistoryEntryRow
              key={entry.id}
              entry={entry as unknown as Record<string, unknown>}
              editMode={editMode}
              onEditEntry={onEditEntry}
            />
          ))}
        </div>
      </Accordion>
    </div>
  );
}

export default ActionGroup;
