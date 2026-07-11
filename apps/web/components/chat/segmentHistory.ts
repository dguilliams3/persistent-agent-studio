/**
 * Chat history segmentation
 *
 * @module components/chat/segmentHistory
 * @description Groups a chronological history into chat segments: message
 * entries become individual bubbles; runs of consecutive non-message entries
 * (thoughts, searches, questions, notes…) collapse into a single action
 * group. Restores the interleaved "drip-down" behavior of the original chat
 * view — without it, everything the persona does between messages is
 * invisible in the thread.
 *
 * Pure function — no store, no React.
 *
 * @upstream Called by: ChatView
 * @tests apps/web/components/chat/__tests__/segmentHistory.test.js
 */

import type { HistoryEntry } from '@persistence/db';

/** Entry types that render as chat bubbles. */
export const BUBBLE_TYPES = new Set([
  'dan_message',
  'user_message',
  'message_to_dan',
  'message_to_user',
]);

/** Inbound (user-authored) subset of BUBBLE_TYPES. */
export const USER_BUBBLE_TYPES = new Set(['dan_message', 'user_message']);

/** Noise types that add nothing to the thread — dropped from chat view. */
const OMIT_TYPES = new Set(['state_update']);

export type ChatSegment =
  | { kind: 'message'; entry: HistoryEntry }
  | { kind: 'actions'; entries: HistoryEntry[]; key: string };

/**
 * Walk history chronologically; messages become bubble segments, consecutive
 * non-messages accumulate into one actions segment.
 */
export function segmentHistory(history: HistoryEntry[]): ChatSegment[] {
  const segments: ChatSegment[] = [];
  let pendingActions: HistoryEntry[] = [];

  const flush = () => {
    if (pendingActions.length > 0) {
      segments.push({
        kind: 'actions',
        entries: pendingActions,
        key: `actions-${pendingActions[0].id}`,
      });
      pendingActions = [];
    }
  };

  for (const entry of history) {
    if (BUBBLE_TYPES.has(entry.type)) {
      flush();
      segments.push({ kind: 'message', entry });
    } else if (!OMIT_TYPES.has(entry.type)) {
      pendingActions.push(entry);
    }
  }
  flush();

  return segments;
}
