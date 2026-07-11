/**
 * SIM row-casing contract tests
 *
 * @module @persistence/memory/sim/casing-contract.test
 * @description Pins the sim boundary mappers (Drizzle camelCase rows ->
 * snake_case *Row contracts). Before these mappers, `as unknown as` casts
 * forced the wrong type over camelCase rows: axis examples loaded empty,
 * the AxisManager edit form rendered blank, and Save wrote [] back over
 * real training examples (G-001, RUN-20260711-1939). Anomaly export lost
 * target_table/target_id the same way (G-002).
 *
 * Tests: packages/memory/src/sim/index.ts toConceptAxisRow,
 * toBasinMetricsRow, toAnomalyFlagRow
 */

import { describe, it, expect } from 'vitest';
import {
  toConceptAxisRow,
  toBasinMetricsRow,
  toAnomalyFlagRow,
} from './index';

describe('toConceptAxisRow — the AxisManager wipe bug (G-001)', () => {
  const drizzleRow = {
    id: 3,
    personaId: 1,
    name: 'groundedness',
    description: 'staying with the real',
    positiveExamples: '["a","b"]',
    negativeExamples: '["c"]',
    conceptVector: new ArrayBuffer(16),
    vectorModel: 'bge-base-en-v1.5',
    isActive: 1,
    createdAt: '2026-07-01 10:00:00',
    updatedAt: null,
  };

  it('maps examples so they survive the load->edit->save round trip', () => {
    const row = toConceptAxisRow(drizzleRow);
    expect(row.positive_examples).toBe('["a","b"]');
    expect(row.negative_examples).toBe('["c"]');
    expect(row.concept_vector).not.toBeNull();
    expect(row.persona_id).toBe(1);
    expect(row.is_active).toBe(1);
    expect(row.created_at).toBe('2026-07-01 10:00:00');
  });
});

describe('toBasinMetricsRow (G-003)', () => {
  it('maps distribution stats to the snake_case contract', () => {
    const row = toBasinMetricsRow({
      id: 1,
      personaId: 1,
      metricType: 'global',
      centroid: new ArrayBuffer(8),
      meanDistance: 0.42,
      stdDistance: 0.1,
      outlierThreshold: 0.72,
      sampleCount: 900,
      metadata: '{"k":1}',
      computedAt: '2026-07-11 12:00:00',
    });
    expect(row.mean_distance).toBe(0.42);
    expect(row.sample_count).toBe(900);
    expect(row.metric_type).toBe('global');
    expect(row.computed_at).toBe('2026-07-11 12:00:00');
  });
});

describe('toAnomalyFlagRow (G-002)', () => {
  it('maps target identity and flagged axes for export/review', () => {
    const row = toAnomalyFlagRow({
      id: 7,
      personaId: 1,
      targetTable: 'history',
      targetId: 12345,
      basinDistance: 0.9,
      zScore: 3.1,
      flaggedAxes: '[2,5]',
      detectionMethod: 'zscore',
      inspected: 0,
      verdict: null,
      notes: null,
      createdAt: '2026-07-11 12:00:00',
      resolvedAt: null,
    });
    expect(row.target_table).toBe('history');
    expect(row.target_id).toBe(12345);
    expect(row.flagged_axes).toBe('[2,5]');
    expect(row.z_score).toBe(3.1);
  });

  it('defaults flagged_axes to an empty JSON array when null', () => {
    const row = toAnomalyFlagRow({
      id: 8,
      personaId: 1,
      targetTable: 'summaries',
      targetId: 1,
      basinDistance: null,
      zScore: null,
      flaggedAxes: null,
      detectionMethod: null,
      inspected: 0,
      verdict: null,
      notes: null,
      createdAt: '2026-07-11 12:00:00',
      resolvedAt: null,
    });
    expect(row.flagged_axes).toBe('[]');
  });
});
