/**
 * Thread merging — synthetic memories + branch overrides onto canonical history
 *
 * @module components/chat/mergeThread
 * @description /history returns CANONICAL rows only; the persona's actual
 * context is branch-aware — synthetic memories are interleaved by placement
 * and edit/exclude overrides are applied. Without this merge the chat thread
 * lies about what the persona actually remembers: injected memories are
 * invisible and edited messages show their original text. This function
 * makes the display tell the same story as the context builder.
 *
 * Pure function — no store, no React.
 *
 * @upstream Called by: ChatView (before segmentHistory)
 * @tests apps/web/components/chat/__tests__/mergeThread.test.js
 */

import type { HistoryEntry } from '@persistence/db';
import { parseDbTimestamp } from '../ui/historyUtils';

export interface SyntheticMemoryRow {
  id: number;
  memory_type: string;
  content: string;
  internal: string | null;
  position_timestamp: string | null;
  position_after_id: number | null;
  created_at: string;
}

export interface MemoryOverrideRow {
  id: number;
  target_table: string;
  target_id: number;
  override_type: string; // 'exclude' | 'edit' | 'reorder'
  override_data: string | null; // JSON: { content?, type?, internal? } for edits
}

/** HistoryEntry plus the thread-merge annotations the renderer reads. */
export type ThreadEntry = HistoryEntry & {
  _synthetic?: boolean;
  _syntheticId?: number;
  _edited?: boolean;
  _excluded?: boolean;
};

/** Synthetic ids are negated so they can never collide with history ids. */
export function syntheticEntryId(syntheticId: number): number {
  return -syntheticId;
}

/**
 * Applies branch overrides and interleaves synthetic memories.
 *
 * - `edit` overrides replace content/type/internal and mark `_edited`.
 * - `exclude` overrides mark `_excluded` (renderer decides: hide in normal
 *   mode, show struck-through in edit-history mode).
 * - Synthetics become pseudo-entries placed by position_timestamp, or after
 *   `position_after_id` when set, else appended at the end.
 */
export function mergeThread(
  history: HistoryEntry[],
  synthetics: SyntheticMemoryRow[],
  overrides: MemoryOverrideRow[],
): ThreadEntry[] {
  const byId = new Map<number, ThreadEntry>();
  const merged: ThreadEntry[] = history.map((entry) => {
    const copy: ThreadEntry = { ...entry };
    byId.set(copy.id, copy);
    return copy;
  });

  for (const override of overrides) {
    if (override.target_table !== 'history') continue;
    const target = byId.get(override.target_id);
    if (!target) continue;
    if (override.override_type === 'exclude') {
      target._excluded = true;
    } else if (override.override_type === 'edit' && override.override_data) {
      try {
        const data = JSON.parse(override.override_data) as {
          content?: string;
          type?: string;
          internal?: string;
        };
        if (data.content !== undefined) target.content = data.content;
        if (data.type !== undefined) target.type = data.type;
        if (data.internal !== undefined) target.internal = data.internal;
        target._edited = true;
      } catch {
        /* malformed override_data — leave the entry canonical */
      }
    }
  }

  for (const synth of synthetics) {
    const entry: ThreadEntry = {
      id: syntheticEntryId(synth.id),
      persona_id: 0,
      type: synth.memory_type,
      content: synth.content,
      internal: synth.internal,
      cycle_id: null,
      meter_snapshot: null,
      metadata: null,
      created_at: synth.position_timestamp || synth.created_at,
      summarized_at: null,
      blurred: 0,
      vaulted: 0,
      _synthetic: true,
      _syntheticId: synth.id,
    };

    if (synth.position_after_id != null) {
      const index = merged.findIndex((e) => e.id === synth.position_after_id);
      if (index >= 0) {
        merged.splice(index + 1, 0, entry);
        continue;
      }
    }
    if (synth.position_timestamp) {
      const at = parseDbTimestamp(synth.position_timestamp).getTime();
      const index = merged.findIndex(
        (e) => parseDbTimestamp(e.created_at).getTime() > at,
      );
      merged.splice(index >= 0 ? index : merged.length, 0, entry);
      continue;
    }
    merged.push(entry);
  }

  return merged;
}

/**
 * Midpoint timestamp between two entries, for inserting a synthetic "between"
 * them. Falls back sensibly at thread edges.
 */
export function midpointTimestamp(
  before: HistoryEntry | undefined,
  after: HistoryEntry | undefined,
): string {
  const beforeMs = before ? parseDbTimestamp(before.created_at).getTime() : null;
  const afterMs = after ? parseDbTimestamp(after.created_at).getTime() : null;
  let ms: number;
  if (beforeMs != null && afterMs != null) ms = beforeMs + (afterMs - beforeMs) / 2;
  else if (beforeMs != null) ms = beforeMs + 1000;
  else if (afterMs != null) ms = afterMs - 1000;
  else ms = Date.now();
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}
