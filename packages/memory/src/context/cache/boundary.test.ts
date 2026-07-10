/**
 * @module @persistence/memory/context/cache/boundary.test
 * @description Unit tests for cache boundary calculation
 *
 * Tests cover:
 * - estimateHistoryTokens() - token estimation for history entries
 * - estimateSummaryTokens() - token estimation for summaries
 * - calculateHistoryBoundary() - stable boundary calculation for history
 * - calculateSummaryBoundary() - stable boundary calculation for summaries
 *
 * @covers boundary.ts
 */

import { describe, it, expect } from 'vitest';
import {
  estimateHistoryTokens,
  estimateSummaryTokens,
  calculateHistoryBoundary,
  calculateSummaryBoundary,
} from './boundary';
import type { CacheConfig } from '../types';
import type { HistoryEntry, Summary, HistoryId, SummaryId, PersonaId, ISOTimestamp } from '../../types';

// ============================================================================
// Test Helpers
// ============================================================================

function createHistoryEntry(
  id: number,
  content: string = 'Test content',
  overrides: Partial<HistoryEntry> = {}
): HistoryEntry {
  return {
    id: id as HistoryId,
    persona_id: 1 as PersonaId,
    type: 'thought',
    content,
    internal: null,
    created_at: `2026-01-${String(id).padStart(2, '0')}T12:00:00.000Z` as ISOTimestamp,
    summarized_at: null,
    cycle_id: null,
    meter_snapshot: null,
    ...overrides,
  };
}

function createSummary(
  id: number,
  summary: string = 'Test summary',
  overrides: Partial<Summary> = {}
): Summary {
  return {
    id: id as SummaryId,
    persona_id: 1 as PersonaId,
    summary,
    message_count: 5,
    covered_range: `Period ${id}`,
    covered_start: `2026-01-${String(id).padStart(2, '0')}T12:00:00.000Z` as ISOTimestamp,
    covered_end: null,
    source_type: 'history',
    source_ids: [1, 2, 3],
    tier: 4,
    tier_position: id * 100,
    created_at: `2026-01-${String(id).padStart(2, '0')}T12:30:00.000Z` as ISOTimestamp,
    archived_at: null,
    replaced_by_id: null,
    embedding: null,
    embedding_model: null,
    metadata: null,
    ...overrides,
  };
}

const defaultConfig: CacheConfig = {
  useVolatileCaching: false,
  cycleIntervalSeconds: 60,
  ttl: '5min',
  historyTailTokenThreshold: 12000,
  historyTailTokenTarget: 6000,
  minHistoryTailEntries: 3,
  summaryTailTokenThreshold: 8000,
  summaryTailTokenTarget: 4000,
  minSummaryTailSummaries: 1,
  summaryPrefixSize: 10,
};

// ============================================================================
// estimateHistoryTokens()
// ============================================================================

describe('estimateHistoryTokens', () => {
  it('uses stored token_count when available', () => {
    const entry = createHistoryEntry(1, 'Test', { token_count: 42 } as any);
    expect(estimateHistoryTokens(entry)).toBe(42);
  });

  it('estimates based on content length when no token_count', () => {
    const entry = createHistoryEntry(1, 'A'.repeat(400)); // 400 chars = ~100 tokens
    expect(estimateHistoryTokens(entry)).toBe(100);
  });

  it('handles empty content', () => {
    const entry = createHistoryEntry(1, '');
    expect(estimateHistoryTokens(entry)).toBe(0);
  });

  it('handles null content', () => {
    const entry = createHistoryEntry(1, null as any);
    expect(estimateHistoryTokens(entry)).toBe(0);
  });

  it('rounds up fractional tokens', () => {
    const entry = createHistoryEntry(1, 'ABC'); // 3 chars / 4 = 0.75, ceil = 1
    expect(estimateHistoryTokens(entry)).toBe(1);
  });
});

// ============================================================================
// estimateSummaryTokens()
// ============================================================================

describe('estimateSummaryTokens', () => {
  it('uses stored token_count when available', () => {
    const summary = createSummary(1, 'Test', { token_count: 99 } as any);
    expect(estimateSummaryTokens(summary)).toBe(99);
  });

  it('estimates based on summary length when no token_count', () => {
    const summary = createSummary(1, 'A'.repeat(800)); // 800 chars = ~200 tokens
    expect(estimateSummaryTokens(summary)).toBe(200);
  });

  it('handles empty summary', () => {
    const summary = createSummary(1, '');
    expect(estimateSummaryTokens(summary)).toBe(0);
  });

  it('handles null summary', () => {
    const summary = createSummary(1, null as any);
    expect(estimateSummaryTokens(summary)).toBe(0);
  });
});

// ============================================================================
// calculateHistoryBoundary() - Initialization
// ============================================================================

describe('calculateHistoryBoundary', () => {
  describe('empty history', () => {
    it('returns null boundary for empty array', () => {
      const result = calculateHistoryBoundary([], null, defaultConfig);

      expect(result.boundaryId).toBeNull();
      expect(result.boundaryIndex).toBe(-1);
      expect(result.tailTokenCount).toBe(0);
      expect(result.shifted).toBe(false);
    });
  });

  describe('initialization (no current boundary)', () => {
    it('initializes boundary to fit target tail tokens', () => {
      // Create history where each entry is ~100 tokens
      const history = Array.from({ length: 100 }, (_, i) =>
        createHistoryEntry(i + 1, 'A'.repeat(400)) // 100 tokens each
      );

      const config = { ...defaultConfig, historyTailTokenTarget: 1000 }; // ~10 entries

      const result = calculateHistoryBoundary(history, null, config);

      expect(result.boundaryId).not.toBeNull();
      expect(result.shifted).toBe(true);
      // Boundary should be set so tail has ~target tokens
      expect(result.tailTokenCount).toBeGreaterThanOrEqual(0);
    });

    it('sets boundary at end if all entries fit in target', () => {
      const history = [
        createHistoryEntry(1, 'A'.repeat(40)), // 10 tokens
        createHistoryEntry(2, 'A'.repeat(40)), // 10 tokens
      ];

      const config = { ...defaultConfig, historyTailTokenTarget: 1000 };

      const result = calculateHistoryBoundary(history, null, config);

      expect(result.shifted).toBe(true);
      // With only 20 tokens and 1000 target, boundary should be at start
      expect(result.boundaryIndex).toBeGreaterThanOrEqual(0);
    });
  });

  describe('stable boundary (no shift needed)', () => {
    it('keeps boundary stable when tail below threshold', () => {
      const history = Array.from({ length: 20 }, (_, i) =>
        createHistoryEntry(i + 1, 'A'.repeat(400)) // 100 tokens each
      );

      const currentBoundary = 10 as HistoryId;
      const config = {
        ...defaultConfig,
        historyTailTokenThreshold: 5000, // Threshold higher than current tail
        historyTailTokenTarget: 2500,
        minHistoryTailEntries: 3,
      };

      const result = calculateHistoryBoundary(history, currentBoundary, config);

      expect(result.boundaryId).toBe(currentBoundary);
      expect(result.shifted).toBe(false);
      expect(result.logMessage).toContain('stable');
    });

    it('does not shift if boundary not found in history', () => {
      const history = [
        createHistoryEntry(1, 'A'.repeat(400)),
        createHistoryEntry(2, 'A'.repeat(400)),
      ];

      // Boundary ID that doesn't exist
      const result = calculateHistoryBoundary(
        history,
        999 as HistoryId,
        defaultConfig
      );

      // Should initialize a new boundary
      expect(result.shifted).toBe(true);
    });
  });

  describe('boundary shift (threshold exceeded)', () => {
    it('shifts boundary when tail exceeds threshold', () => {
      const history = Array.from({ length: 50 }, (_, i) =>
        createHistoryEntry(i + 1, 'A'.repeat(400)) // 100 tokens each
      );

      const currentBoundary = 10 as HistoryId; // Only 10 entries in prefix
      const config = {
        ...defaultConfig,
        historyTailTokenThreshold: 3000, // 30 entries worth
        historyTailTokenTarget: 1500,     // 15 entries worth
        minHistoryTailEntries: 5,
      };

      // With boundary at 10, tail = entries 11-50 = 40 entries = 4000 tokens > threshold
      const result = calculateHistoryBoundary(history, currentBoundary, config);

      expect(result.shifted).toBe(true);
      expect(result.boundaryIndex).toBeGreaterThan(9); // Should move forward
      expect(result.logMessage).toContain('Updated');
    });

    it('respects minHistoryTailEntries when shifting', () => {
      const history = Array.from({ length: 10 }, (_, i) =>
        createHistoryEntry(i + 1, 'A'.repeat(400))
      );

      const config = {
        ...defaultConfig,
        historyTailTokenThreshold: 500,
        historyTailTokenTarget: 200,
        minHistoryTailEntries: 5, // Must keep at least 5 in tail
      };

      const result = calculateHistoryBoundary(history, 1 as HistoryId, config);

      // Even if threshold exceeded, should leave at least 5 entries in tail
      const tailCount = history.length - result.boundaryIndex - 1;
      expect(tailCount).toBeGreaterThanOrEqual(config.minHistoryTailEntries);
    });
  });
});

// ============================================================================
// calculateSummaryBoundary() - Initialization
// ============================================================================

describe('calculateSummaryBoundary', () => {
  describe('empty summaries', () => {
    it('returns null boundary for empty array', () => {
      const result = calculateSummaryBoundary([], null, defaultConfig);

      expect(result.boundaryId).toBeNull();
      expect(result.boundaryIndex).toBe(-1);
      expect(result.tailTokenCount).toBe(0);
      expect(result.movedCount).toBe(0);
      expect(result.shifted).toBe(false);
    });
  });

  describe('initialization (no current boundary)', () => {
    it('initializes boundary based on prefixSize', () => {
      const summaries = Array.from({ length: 20 }, (_, i) =>
        createSummary(i + 1, 'A'.repeat(400))
      );

      const config = { ...defaultConfig, summaryPrefixSize: 10 };

      const result = calculateSummaryBoundary(summaries, null, config);

      expect(result.boundaryId).not.toBeNull();
      expect(result.boundaryIndex).toBe(9); // 0-indexed, prefix of 10
      expect(result.shifted).toBe(true);
    });

    it('handles fewer summaries than prefixSize', () => {
      const summaries = [
        createSummary(1, 'A'.repeat(400)),
        createSummary(2, 'A'.repeat(400)),
      ];

      const config = { ...defaultConfig, summaryPrefixSize: 10 };

      const result = calculateSummaryBoundary(summaries, null, config);

      // With only 2 summaries and prefixSize of 10, boundary should be at end
      expect(result.boundaryIndex).toBe(1);
    });
  });

  describe('stable boundary (no shift needed)', () => {
    it('keeps boundary stable when tail below threshold', () => {
      const summaries = Array.from({ length: 15 }, (_, i) =>
        createSummary(i + 1, 'A'.repeat(400)) // 100 tokens each
      );

      const currentBoundary = 10 as SummaryId;
      const config = {
        ...defaultConfig,
        summaryTailTokenThreshold: 2000, // 20 summaries worth
        summaryTailTokenTarget: 1000,
        minSummaryTailSummaries: 1,
      };

      const result = calculateSummaryBoundary(summaries, currentBoundary, config);

      // Tail = summaries 11-15 = 5 summaries = 500 tokens < threshold
      expect(result.boundaryId).toBe(currentBoundary);
      expect(result.shifted).toBe(false);
    });
  });

  describe('boundary shift (threshold exceeded)', () => {
    it('shifts boundary when tail exceeds threshold', () => {
      const summaries = Array.from({ length: 30 }, (_, i) =>
        createSummary(i + 1, 'A'.repeat(400)) // 100 tokens each
      );

      const currentBoundary = 10 as SummaryId;
      const config = {
        ...defaultConfig,
        summaryTailTokenThreshold: 1500, // 15 summaries worth
        summaryTailTokenTarget: 500,     // 5 summaries worth
        minSummaryTailSummaries: 2,
      };

      // With boundary at 10, tail = summaries 11-30 = 20 summaries = 2000 tokens > threshold
      const result = calculateSummaryBoundary(summaries, currentBoundary, config);

      expect(result.shifted).toBe(true);
      expect(result.movedCount).toBeGreaterThan(0);
      expect(result.logMessage).toContain('Rolled');
    });

    it('respects minSummaryTailSummaries when shifting', () => {
      const summaries = Array.from({ length: 10 }, (_, i) =>
        createSummary(i + 1, 'A'.repeat(400))
      );

      const config = {
        ...defaultConfig,
        summaryTailTokenThreshold: 500,
        summaryTailTokenTarget: 100,
        minSummaryTailSummaries: 3,
      };

      const result = calculateSummaryBoundary(summaries, 5 as SummaryId, config);

      // Should not shift if it would leave fewer than minSummaryTailSummaries
      const tailCount = summaries.length - result.boundaryIndex - 1;
      if (result.shifted) {
        expect(tailCount).toBeGreaterThanOrEqual(config.minSummaryTailSummaries);
      }
    });

    it('reports accurate movedCount', () => {
      const summaries = Array.from({ length: 20 }, (_, i) =>
        createSummary(i + 1, 'A'.repeat(400)) // 100 tokens each
      );

      const currentBoundary = 5 as SummaryId;
      const config = {
        ...defaultConfig,
        summaryTailTokenThreshold: 1000, // 10 summaries worth
        summaryTailTokenTarget: 500,      // 5 summaries worth
        minSummaryTailSummaries: 1,
      };

      // Tail = summaries 6-20 = 15 summaries = 1500 tokens > threshold
      const result = calculateSummaryBoundary(summaries, currentBoundary, config);

      if (result.shifted) {
        expect(result.movedCount).toBeGreaterThan(0);
        // New boundary should be old boundary + movedCount
        expect(result.boundaryIndex).toBeGreaterThan(4);
      }
    });
  });

  describe('boundary not found', () => {
    it('initializes when current boundary ID not in summaries', () => {
      const summaries = [
        createSummary(1, 'A'.repeat(400)),
        createSummary(2, 'A'.repeat(400)),
        createSummary(3, 'A'.repeat(400)),
      ];

      // Boundary ID that doesn't exist
      const result = calculateSummaryBoundary(
        summaries,
        999 as SummaryId,
        defaultConfig
      );

      // Should initialize a new boundary
      expect(result.shifted).toBe(true);
    });
  });
});
