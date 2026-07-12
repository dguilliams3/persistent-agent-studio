/**
 * mergeThread tests
 *
 * @module components/chat/__tests__/mergeThread.test
 * @description Verifies branch-aware thread merging: edit overrides replace
 * content, exclude overrides mark entries, synthetics interleave by
 * placement (after-id, timestamp, or append), and ids never collide.
 *
 * Tests: apps/web/components/chat/mergeThread.ts
 */

import { describe, it, expect } from 'vitest';
import { mergeThread, midpointTimestamp, syntheticEntryId } from '../mergeThread';

const entry = (id, time, type = 'message_to_user', content = `entry ${id}`) => ({
  id,
  persona_id: 1,
  type,
  content,
  internal: null,
  cycle_id: null,
  meter_snapshot: null,
  metadata: null,
  created_at: `2026-07-10 ${time}`,
  summarized_at: null,
  blurred: 0,
  vaulted: 0,
});

describe('mergeThread', () => {
  it('applies edit overrides and marks _edited', () => {
    const merged = mergeThread(
      [entry(1, '10:00:00'), entry(2, '11:00:00')],
      [],
      [{ id: 9, target_table: 'history', target_id: 2, override_type: 'edit', override_data: '{"content":"rewritten"}' }],
    );
    expect(merged[1].content).toBe('rewritten');
    expect(merged[1]._edited).toBe(true);
    expect(merged[0]._edited).toBeUndefined();
  });

  it('marks excluded entries without removing them', () => {
    const merged = mergeThread(
      [entry(1, '10:00:00')],
      [],
      [{ id: 9, target_table: 'history', target_id: 1, override_type: 'exclude', override_data: null }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]._excluded).toBe(true);
  });

  it('places synthetics by position_timestamp between neighbors', () => {
    const merged = mergeThread(
      [entry(1, '10:00:00'), entry(2, '12:00:00')],
      [{ id: 5, memory_type: 'user_message', content: 'injected', internal: null, position_timestamp: '2026-07-10 11:00:00', position_after_id: null, created_at: '2026-07-11 09:00:00' }],
      [],
    );
    expect(merged.map((e) => e.content)).toEqual(['entry 1', 'injected', 'entry 2']);
    expect(merged[1]._synthetic).toBe(true);
    expect(merged[1].id).toBe(syntheticEntryId(5));
  });

  it('places synthetics by position_after_id when set', () => {
    const merged = mergeThread(
      [entry(1, '10:00:00'), entry(2, '12:00:00')],
      [{ id: 6, memory_type: 'thought', content: 'after one', internal: null, position_timestamp: null, position_after_id: 1, created_at: '2026-07-11 09:00:00' }],
      [],
    );
    expect(merged.map((e) => e.content)).toEqual(['entry 1', 'after one', 'entry 2']);
  });

  it('appends unplaced synthetics at the end', () => {
    const merged = mergeThread(
      [entry(1, '10:00:00')],
      [{ id: 7, memory_type: 'user_message', content: 'tail', internal: null, position_timestamp: null, position_after_id: null, created_at: '2026-07-11 09:00:00' }],
      [],
    );
    expect(merged[merged.length - 1].content).toBe('tail');
  });

  it('does not mutate the input history', () => {
    const input = [entry(1, '10:00:00')];
    mergeThread(input, [], [{ id: 9, target_table: 'history', target_id: 1, override_type: 'edit', override_data: '{"content":"x"}' }]);
    expect(input[0].content).toBe('entry 1');
  });

  it('midpointTimestamp lands strictly between neighbors', () => {
    const mid = midpointTimestamp(entry(1, '10:00:00'), entry(2, '12:00:00'));
    const t = new Date(mid.replace(' ', 'T') + 'Z').getTime();
    const a = new Date('2026-07-10T10:00:00Z').getTime();
    const b = new Date('2026-07-10T12:00:00Z').getTime();
    expect(t).toBeGreaterThan(a);
    expect(t).toBeLessThan(b);
  });
});
