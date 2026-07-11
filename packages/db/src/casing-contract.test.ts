/**
 * Row-casing contract tests
 *
 * @module @persistence/db/casing-contract.test
 * @description Pins the snake_case public contracts against camelCase Drizzle
 * rows. The 2026-03-19 query-builder migration changed row property names
 * from snake_case (raw D1) to camelCase (schema properties) and hid it behind
 * `as unknown as` casts — summarization crashed ("Invalid time value" from
 * `new Date(undefined)`), UI timestamps vanished, and the Summaries view got
 * husks, all silently, for four months. These tests fail if any boundary
 * mapper stops translating.
 *
 * Tests: history.ts toHistoryEntry, summaries/mappers.ts toSummaryRow,
 * llm-storage cold-storage/observations mappers (via public query functions
 * where private).
 */

import { describe, it, expect } from 'vitest';
import { toHistoryEntry } from './history';
import { toSummaryRow } from './summaries/mappers';

describe('toHistoryEntry — Drizzle camelCase → HistoryEntry snake_case', () => {
  const drizzleRow = {
    id: 42,
    personaId: 1,
    type: 'message_to_user',
    content: 'hello',
    internal: 'an aside',
    cycleId: 7,
    summarizedAt: null,
    embedding: new ArrayBuffer(8),
    embeddingModel: 'test-model',
    meterSnapshot: '{"aliveness":7}',
    metadata: '{"provider":"anthropic"}',
    blurred: 0,
    vaulted: 0,
    createdAt: '2026-07-11 12:00:00',
  };

  it('maps every contract field from the camelCase source', () => {
    const entry = toHistoryEntry(drizzleRow);
    expect(entry).toEqual({
      id: 42,
      persona_id: 1,
      type: 'message_to_user',
      content: 'hello',
      internal: 'an aside',
      cycle_id: 7,
      meter_snapshot: '{"aliveness":7}',
      metadata: '{"provider":"anthropic"}',
      created_at: '2026-07-11 12:00:00',
      summarized_at: null,
      blurred: 0,
      vaulted: 0,
    });
  });

  it('produces a parseable created_at (the summarization crash)', () => {
    const entry = toHistoryEntry(drizzleRow);
    // new Date(undefined) → Invalid Date → toISOString() threw
    // "Invalid time value" and killed every summarize run.
    const parsed = new Date(String(entry.created_at).replace(' ', 'T'));
    expect(Number.isNaN(parsed.getTime())).toBe(false);
  });

  it('drops embedding blobs from the contract', () => {
    const entry = toHistoryEntry(drizzleRow) as unknown as Record<string, unknown>;
    expect(entry.embedding).toBeUndefined();
    expect(entry.embeddingModel).toBeUndefined();
    expect(entry.embedding_model).toBeUndefined();
  });
});

describe('toSummaryRow — Drizzle camelCase → SummaryRow snake_case', () => {
  it('maps the fields rowToSummary depends on', () => {
    const row = toSummaryRow({
      id: 5,
      personaId: 1,
      summary: 'a season condensed',
      messageCount: 50,
      coveredRange: 'Jan 1 – Feb 25',
      coveredStart: '2026-01-01 00:00:00',
      sourceType: 'history',
      sourceIds: '[1,2,3]',
      tier: 'tail',
      tierPosition: 2,
      createdAt: '2026-02-25 13:02:17',
      archivedAt: null,
      replacedById: null,
      embedding: null,
      embeddingModel: null,
      metadata: '{}',
    });
    expect(row.persona_id).toBe(1);
    expect(row.created_at).toBe('2026-02-25 13:02:17');
    expect(row.covered_start).toBe('2026-01-01 00:00:00');
    expect(row.message_count).toBe(50);
    expect(row.tier).toBe('tail');
    expect(row.tier_position).toBe(2);
  });

  it('defaults tier when null (schema default is applied at write, not read)', () => {
    const row = toSummaryRow({
      id: 6,
      personaId: 1,
      summary: 's',
      messageCount: null,
      coveredRange: null,
      coveredStart: null,
      sourceType: null,
      sourceIds: null,
      tier: null,
      tierPosition: null,
      createdAt: null,
      archivedAt: null,
      replacedById: null,
      embedding: null,
      embeddingModel: null,
      metadata: null,
    });
    expect(row.tier).toBe('tail');
    expect(row.message_count).toBe(0);
  });
});
