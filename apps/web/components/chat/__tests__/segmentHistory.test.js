/**
 * segmentHistory tests
 *
 * @module components/chat/__tests__/segmentHistory.test
 * @description Verifies the pure chat-segmentation function: bubbles for
 * message types, one actions group per run of consecutive non-messages,
 * day separators on calendar-date changes, noise types omitted.
 *
 * Tests: apps/web/components/chat/segmentHistory.ts
 */

import { describe, it, expect } from 'vitest';
import { segmentHistory, BUBBLE_TYPES } from '../segmentHistory';

/**
 * Bare UTC stamp (DB convention) representing a LOCAL instant N days ago —
 * matches how the worker writes rows and how parseDbTimestamp reads them.
 */
function stamp(daysAgo, time = '12:00:00') {
  const [h, m, sec] = time.split(':').map(Number);
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, sec, 0);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

let nextId = 1;
function entry(type, daysAgo, time) {
  return {
    id: nextId++,
    type,
    content: `${type} content`,
    created_at: stamp(daysAgo, time),
  };
}

describe('segmentHistory', () => {
  it('renders message types as individual bubbles', () => {
    const history = [
      entry('user_message', 0, '09:00:00'),
      entry('message_to_user', 0, '09:01:00'),
    ];
    const segments = segmentHistory(history);
    const messages = segments.filter((s) => s.kind === 'message');
    expect(messages).toHaveLength(2);
    expect(BUBBLE_TYPES.has(messages[0].entry.type)).toBe(true);
  });

  it('groups consecutive non-messages into a single actions segment', () => {
    const history = [
      entry('user_message', 0, '09:00:00'),
      entry('thought', 0, '09:02:00'),
      entry('search_query', 0, '09:03:00'),
      entry('search_result', 0, '09:03:30'),
      entry('message_to_user', 0, '09:04:00'),
    ];
    const segments = segmentHistory(history);
    const actions = segments.filter((s) => s.kind === 'actions');
    expect(actions).toHaveLength(1);
    expect(actions[0].entries).toHaveLength(3);
    // Actions flush BEFORE the following message
    const kinds = segments.map((s) => s.kind);
    expect(kinds.indexOf('actions')).toBeLessThan(kinds.lastIndexOf('message'));
  });

  it('omits noise types entirely', () => {
    const segments = segmentHistory([
      entry('state_update', 0, '09:00:00'),
      entry('message_to_user', 0, '09:01:00'),
    ]);
    expect(segments.filter((s) => s.kind === 'actions')).toHaveLength(0);
    expect(segments.filter((s) => s.kind === 'message')).toHaveLength(1);
  });

  it('emits one day separator per calendar date, labeled Today/Yesterday', () => {
    const history = [
      entry('message_to_user', 2, '10:00:00'),
      entry('thought', 2, '11:00:00'),
      entry('message_to_user', 1, '10:00:00'),
      entry('user_message', 0, '09:00:00'),
      entry('message_to_user', 0, '09:05:00'),
    ];
    const segments = segmentHistory(history);
    const days = segments.filter((s) => s.kind === 'day');
    expect(days).toHaveLength(3);
    expect(days[1].label).toBe('Yesterday');
    expect(days[2].label).toBe('Today');
    // Two-days-ago gets a real date label, not a relative word
    expect(days[0].label).not.toBe('Today');
    expect(days[0].label.length).toBeGreaterThan(0);
    // First segment overall is a day marker
    expect(segments[0].kind).toBe('day');
  });

  it('flushes a pending actions group before a day boundary', () => {
    const history = [
      entry('thought', 1, '23:50:00'),
      entry('thought', 0, '00:10:00'),
      entry('message_to_user', 0, '00:15:00'),
    ];
    const segments = segmentHistory(history);
    // thought(yesterday) | day(Today) | thought(today) → two actions groups
    const actions = segments.filter((s) => s.kind === 'actions');
    expect(actions).toHaveLength(2);
    expect(actions[0].entries).toHaveLength(1);
    expect(actions[1].entries).toHaveLength(1);
  });

  it('produces unique keys across all segments', () => {
    const history = [
      entry('thought', 1, '10:00:00'),
      entry('message_to_user', 1, '10:05:00'),
      entry('thought', 0, '10:00:00'),
      entry('message_to_user', 0, '10:05:00'),
    ];
    const segments = segmentHistory(history);
    const keys = segments.map((s) =>
      s.kind === 'message' ? `message-${s.entry.id}` : s.key,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});
