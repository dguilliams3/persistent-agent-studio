/**
 * Chat Bubble View Component
 *
 * @module packages/ui/renderers/ChatBubbleView
 * @description Renders a list of history entries as chat bubbles.
 * Messages are displayed chronologically (oldest at top, newest at bottom).
 *
 * Determines user vs persona messages by comparing entry type against
 * known user message types ('user_message').
 *
 * @antipattern Do NOT import Zustand or any store — this is a pure renderer.
 * @antipattern Do NOT group non-message entries into accordions — that was the old pattern.
 *   Non-message entries are filtered out; cycle details appear via ExpandedThinking.
 *
 * @upstream Called by: ChatView
 * @downstream Calls: ChatBubble
 */

import { useMemo } from 'react';
import type { HistoryEntry } from '@persistence/db';
import { ChatBubble } from './ChatBubble.js';

/** Entry types that should render as chat bubbles. */
const MESSAGE_TYPES = new Set(['user_message', 'message_to_user']);

/** Props for the ChatBubbleView list renderer. */
export interface ChatBubbleViewProps {
  /** All history entries to display (chronological order expected) */
  entries: HistoryEntry[];
  /** Name of the current persona (used to label persona messages) */
  currentPersonaName: string;
  /** Set of cycle IDs whose thinking panels are currently expanded */
  expandedCycles: Set<number>;
  /** Callback to toggle expansion of a cycle's thinking panel */
  onToggleCycle: (cycleId: number) => void;
}

/**
 * Renders a vertical list of chat bubbles from history entries.
 *
 * Only entries with message types are rendered as bubbles.
 * Each persona bubble gets an expand indicator for its cycle details.
 */
export function ChatBubbleView({
  entries,
  currentPersonaName,
  expandedCycles,
  onToggleCycle,
}: ChatBubbleViewProps) {
  /** Filter to only message-type entries for the bubble view. */
  const messageEntries = useMemo(
    () => entries.filter((entry) => MESSAGE_TYPES.has(entry.type)),
    [entries],
  );

  if (messageEntries.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md)',
        padding: 'var(--spacing-lg)',
      }}
    >
      {messageEntries.map((entry) => {
        const isUser = entry.type === 'user_message';
        const cycleId = entry.cycle_id ?? undefined;
        const isExpanded = cycleId != null && expandedCycles.has(cycleId);

        return (
          <ChatBubble
            key={entry.id}
            entry={entry}
            isUser={isUser}
            expanded={isExpanded}
            onToggleExpand={() => {
              if (cycleId != null) {
                onToggleCycle(cycleId);
              }
            }}
          />
        );
      })}
    </div>
  );
}

export default ChatBubbleView;
