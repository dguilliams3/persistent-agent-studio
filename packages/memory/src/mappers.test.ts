/**
 * @module @persistence/memory/mappers.test
 * @description Unit tests for database row to domain type mappers
 *
 * Tests cover:
 * - stringifySourceIds() - JSON array serialization
 * - stringifyMetadata() - JSON object serialization
 * - rowToHistory() - History row conversion
 * - historyToRow() - History entry serialization
 * - summaryToRow() - Summary entry serialization
 *
 * NOTE: parseSourceIds(), parseMetadata(), rowToSummary() tests live in
 * @persistence/db/src/summaries/mappers.test.ts (canonical location).
 *
 * @covers mappers.ts
 */

import { describe, it, expect } from 'vitest';
import {
  stringifySourceIds,
  stringifyMetadata,
  rowToHistory,
  historyToRow,
  summaryToRow,
  type HistoryRow,
} from './mappers';
import type { HistoryEntry, Summary, SummaryMetadata } from './types';

// ============================================================================
// stringifySourceIds()
// ============================================================================

describe('stringifySourceIds', () => {
  it('stringifies array of numbers', () => {
    const result = stringifySourceIds([1, 2, 3]);
    expect(result).toBe('[1,2,3]');
  });

  it('stringifies empty array', () => {
    const result = stringifySourceIds([]);
    expect(result).toBe('[]');
  });

  it('stringifies single element', () => {
    const result = stringifySourceIds([42]);
    expect(result).toBe('[42]');
  });
});

// ============================================================================
// stringifyMetadata()
// ============================================================================

describe('stringifyMetadata', () => {
  it('returns null for null input', () => {
    const result = stringifyMetadata(null);
    expect(result).toBeNull();
  });

  it('returns null for empty metadata', () => {
    const metadata: SummaryMetadata = {
      entity_tags: [],
      key_facts: [],
      themes: [],
      emotional_tone: null,
      time_period_label: null,
    };
    const result = stringifyMetadata(metadata);
    expect(result).toBeNull();
  });

  it('stringifies metadata with content', () => {
    const metadata: SummaryMetadata = {
      entity_tags: ['User'],
      key_facts: [],
      themes: [],
      emotional_tone: null,
      time_period_label: null,
    };
    const result = stringifyMetadata(metadata);
    expect(result).not.toBeNull();

    const parsed = JSON.parse(result!);
    expect(parsed.entity_tags).toEqual(['User']);
  });

  it('includes all non-empty fields', () => {
    const metadata: SummaryMetadata = {
      entity_tags: ['User', 'Clio'],
      key_facts: ['fact1'],
      themes: ['theme1'],
      emotional_tone: 'happy',
      time_period_label: 'Morning',
    };
    const result = stringifyMetadata(metadata);
    const parsed = JSON.parse(result!);

    expect(parsed.entity_tags).toEqual(['User', 'Clio']);
    expect(parsed.emotional_tone).toBe('happy');
  });
});

// ============================================================================
// rowToHistory() / historyToRow()
// ============================================================================

describe('rowToHistory', () => {
  it('converts database row to HistoryEntry', () => {
    const row: HistoryRow = {
      id: 1,
      persona_id: 1,
      type: 'thought',
      content: 'Test content',
      internal: 'Internal note',
      created_at: '2026-01-15T12:00:00.000Z',
      summarized_at: null,
      cycle_id: 5,
      meter_snapshot: 'A7 C6 N10',
    };

    const entry = rowToHistory(row);

    expect(entry.id).toBe(1);
    expect(entry.persona_id).toBe(1);
    expect(entry.type).toBe('thought');
    expect(entry.content).toBe('Test content');
    expect(entry.internal).toBe('Internal note');
    expect(entry.created_at).toBe('2026-01-15T12:00:00.000Z');
    expect(entry.summarized_at).toBeNull();
    expect(entry.cycle_id).toBe(5);
    expect(entry.meter_snapshot).toBe('A7 C6 N10');
  });

  it('preserves null values', () => {
    const row: HistoryRow = {
      id: 1,
      persona_id: 1,
      type: 'thought',
      content: 'Test',
      internal: null,
      created_at: '2026-01-15T12:00:00.000Z',
      summarized_at: null,
      cycle_id: null,
      meter_snapshot: null,
    };

    const entry = rowToHistory(row);

    expect(entry.internal).toBeNull();
    expect(entry.summarized_at).toBeNull();
    expect(entry.cycle_id).toBeNull();
    expect(entry.meter_snapshot).toBeNull();
  });
});

describe('historyToRow', () => {
  it('converts HistoryEntry to database row', () => {
    const entry: HistoryEntry = {
      id: 1 as any,
      persona_id: 1 as any,
      type: 'thought',
      content: 'Test content',
      internal: 'Internal note',
      created_at: '2026-01-15T12:00:00.000Z' as any,
      summarized_at: null,
      cycle_id: 5 as any,
      meter_snapshot: 'A7 C6 N10',
    };

    const row = historyToRow(entry);

    expect(row.id).toBe(1);
    expect(row.persona_id).toBe(1);
    expect(row.type).toBe('thought');
    expect(row.content).toBe('Test content');
    expect(row.internal).toBe('Internal note');
    expect(row.cycle_id).toBe(5);
  });

  it('coalesces undefined to null', () => {
    const entry: HistoryEntry = {
      id: 1 as any,
      persona_id: 1 as any,
      type: 'thought',
      content: 'Test',
      internal: undefined as any,
      created_at: '2026-01-15T12:00:00.000Z' as any,
      summarized_at: undefined as any,
      cycle_id: undefined as any,
      meter_snapshot: undefined as any,
    };

    const row = historyToRow(entry);

    expect(row.internal).toBeNull();
    expect(row.summarized_at).toBeNull();
    expect(row.cycle_id).toBeNull();
    expect(row.meter_snapshot).toBeNull();
  });
});

// ============================================================================
// summaryToRow()
// ============================================================================

describe('summaryToRow', () => {
  const createBasicSummary = (): Summary => ({
    id: 100 as any,
    persona_id: 1 as any,
    summary: 'Test summary',
    message_count: 5,
    covered_range: 'Jan 15 10:00 to Jan 15 12:00 EST',
    covered_start: '2026-01-15T15:00:00.000Z' as any,
    covered_end: '2026-01-15T17:00:00.000Z' as any,
    source_type: 'history',
    source_ids: [1, 2, 3, 4, 5],
    tier: 4,
    tier_position: 100,
    created_at: '2026-01-15T17:30:00.000Z' as any,
    archived_at: null,
    replaced_by_id: null,
    embedding: null,
    embedding_model: null,
    metadata: null,
  });

  it('converts Summary to database row', () => {
    const summary = createBasicSummary();
    const row = summaryToRow(summary);

    expect(row.id).toBe(100);
    expect(row.summary).toBe('Test summary');
    expect(row.source_ids).toBe('[1,2,3,4,5]');
    expect(row.tier).toBe('4');
  });

  it('serializes numeric tier to string', () => {
    const summary = createBasicSummary();
    summary.tier = 2;
    expect(summaryToRow(summary).tier).toBe('2');

    summary.tier = 3;
    expect(summaryToRow(summary).tier).toBe('3');

    summary.tier = 4;
    expect(summaryToRow(summary).tier).toBe('4');
  });

  it('preserves "archived" tier as string', () => {
    const summary = createBasicSummary();
    summary.tier = 'archived';
    expect(summaryToRow(summary).tier).toBe('archived');
  });

  it('stringifies metadata', () => {
    const summary = createBasicSummary();
    summary.metadata = {
      entity_tags: ['User'],
      key_facts: [],
      themes: [],
      emotional_tone: 'happy',
      time_period_label: null,
    };

    const row = summaryToRow(summary);

    expect(row.metadata).not.toBeNull();
    const parsed = JSON.parse(row.metadata!);
    expect(parsed.entity_tags).toEqual(['User']);
    expect(parsed.emotional_tone).toBe('happy');
  });

  it('coalesces undefined to null', () => {
    const summary = createBasicSummary();
    summary.covered_end = undefined as any;
    summary.archived_at = undefined as any;
    summary.embedding = undefined as any;

    const row = summaryToRow(summary);

    expect(row.covered_end).toBeNull();
    expect(row.archived_at).toBeNull();
    expect(row.embedding).toBeNull();
  });
});

// ============================================================================
// Round-trip tests
// ============================================================================

describe('round-trip conversions', () => {
  it('history: row -> entry -> row preserves data', () => {
    const originalRow: HistoryRow = {
      id: 42,
      persona_id: 1,
      type: 'user_message',
      content: 'Hello world!',
      internal: 'thinking...',
      created_at: '2026-01-15T12:00:00.000Z',
      summarized_at: '2026-01-16T12:00:00.000Z',
      cycle_id: 10,
      meter_snapshot: 'A5 C5 N5',
    };

    const entry = rowToHistory(originalRow);
    const newRow = historyToRow(entry);

    expect(newRow.id).toBe(originalRow.id);
    expect(newRow.type).toBe(originalRow.type);
    expect(newRow.content).toBe(originalRow.content);
    expect(newRow.internal).toBe(originalRow.internal);
    expect(newRow.cycle_id).toBe(originalRow.cycle_id);
  });

  it('summary: summaryToRow produces valid row', () => {
    const summary: Summary = {
      id: 100 as any,
      persona_id: 1 as any,
      summary: 'Test summary',
      message_count: 5,
      covered_range: 'Jan 15 10:00 to Jan 15 12:00 EST',
      covered_start: '2026-01-15T15:00:00.000Z' as any,
      covered_end: '2026-01-15T17:00:00.000Z' as any,
      source_type: 'history',
      source_ids: [1, 2, 3],
      tier: 3,
      tier_position: 50,
      created_at: '2026-01-15T17:30:00.000Z' as any,
      archived_at: null,
      replaced_by_id: 200 as any,
      embedding: null,
      embedding_model: 'bge-base-en-v1.5',
      metadata: { entity_tags: ['User'], key_facts: [], themes: [], emotional_tone: null, time_period_label: null },
    };

    const row = summaryToRow(summary);

    expect(row.id).toBe(100);
    expect(row.summary).toBe('Test summary');
    expect(row.tier).toBe('3');
    expect(row.source_type).toBe('history');
    expect(row.replaced_by_id).toBe(200);
    expect(row.embedding_model).toBe('bge-base-en-v1.5');
    expect(JSON.parse(row.source_ids)).toEqual([1, 2, 3]);
  });
});
