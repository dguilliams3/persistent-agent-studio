/**
 * Visitor attribution in context formatting — F-B2 (RUN-20260712-2013)
 */

import { describe, it, expect } from 'vitest';
import { parseSenderFrom, formatHistoryEntry } from './history';
import type { HistoryEntry } from '../../types/HistoryEntry';

function entry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: 1 as HistoryEntry['id'],
    persona_id: 1 as HistoryEntry['persona_id'],
    type: 'user_message' as HistoryEntry['type'],
    content: 'Hello there',
    internal: null,
    created_at: '2026-07-13 12:00:00' as HistoryEntry['created_at'],
    summarized_at: null,
    cycle_id: null,
    meter_snapshot: null,
    ...overrides,
  };
}

describe('parseSenderFrom', () => {
  it('parses a JSON-string metadata blob', () => {
    expect(parseSenderFrom('{"from":"Delphi"}')).toBe('Delphi');
  });

  it('parses an already-parsed object', () => {
    expect(parseSenderFrom({ from: 'Virgil' })).toBe('Virgil');
  });

  it('never throws on malformed input — returns null', () => {
    expect(parseSenderFrom(null)).toBeNull();
    expect(parseSenderFrom(undefined)).toBeNull();
    expect(parseSenderFrom('not json at all')).toBeNull();
    expect(parseSenderFrom('[1,2,3]')).toBeNull();
    expect(parseSenderFrom('{"from":42}')).toBeNull();
    expect(parseSenderFrom('{"from":"   "}')).toBeNull();
    expect(parseSenderFrom(7)).toBeNull();
  });
});

describe('formatHistoryEntry — user_message visitor attribution', () => {
  it('renders FROM <NAME> for a signed message', () => {
    const line = formatHistoryEntry(
      entry({ metadata: '{"from":"Delphi"}' }),
      [],
      [],
      false,
    );
    expect(line).toContain('FROM DELPHI: "Hello there"');
    expect(line).not.toContain('USER:');
  });

  it('renders the legacy USER form unchanged when metadata is absent', () => {
    const line = formatHistoryEntry(entry(), [], [], false);
    expect(line).toMatch(/USER: "Hello there"$/);
    expect(line).not.toContain('FROM');
  });

  it('renders legacy USER form when metadata is malformed (defensive)', () => {
    const line = formatHistoryEntry(entry({ metadata: '{broken' }), [], [], false);
    expect(line).toMatch(/USER: "Hello there"$/);
  });
});
