/**
 * @module @persistence/memory/context/stats/split-summaries.test
 * @description Unit tests for summary tier/boundary splitting
 *
 * Tests cover:
 * - splitSummariesByTierAndBoundary() - the SINGLE SOURCE OF TRUTH for summary categorization
 *
 * This is a CRITICAL function that determines which summaries appear in which context block.
 *
 * @covers split-summaries.ts
 */

import { describe, it, expect } from 'vitest';
import { splitSummariesByTierAndBoundary } from './split-summaries';
import type { Summary, SummaryId, PersonaId, ISOTimestamp, SummaryTier } from '../../types';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a test summary with minimal required fields.
 */
function createSummary(
  id: number,
  tier: SummaryTier = 4,
  overrides: Partial<Summary> = {}
): Summary {
  return {
    id: id as SummaryId,
    persona_id: 1 as PersonaId,
    summary: `Summary ${id}`,
    message_count: 5,
    covered_range: `Period ${id}`,
    covered_start: `2026-01-${String(id).padStart(2, '0')}T12:00:00.000Z` as ISOTimestamp,
    covered_end: null,
    source_type: 'history',
    source_ids: [1, 2, 3],
    tier,
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

// ============================================================================
// splitSummariesByTierAndBoundary()
// ============================================================================

describe('splitSummariesByTierAndBoundary', () => {
  describe('empty input', () => {
    it('handles empty array', () => {
      const result = splitSummariesByTierAndBoundary([]);

      expect(result.pinned).toEqual([]);
      expect(result.autoRolled).toEqual([]);
      expect(result.tail).toEqual([]);
      expect(result.prefix).toEqual([]);
      expect(result.stats.totalCount).toBe(0);
      expect(result.stats.totalTokens).toBe(0);
    });
  });

  describe('promoted exclusion (tier 2)', () => {
    it('excludes promoted summaries from all categories', () => {
      const summaries = [
        createSummary(1, 2), // promoted
        createSummary(2, 4), // fresh
        createSummary(3, 2), // promoted
      ];

      const result = splitSummariesByTierAndBoundary(summaries, {
        promotedIds: new Set([1, 3] as SummaryId[]),
      });

      // Should only have summary 2 (tier 4)
      expect(result.tail.length).toBe(1);
      expect(result.tail[0].id).toBe(2);
      expect(result.stats.totalCount).toBe(1);
    });

    it('handles case where all summaries are promoted', () => {
      const summaries = [
        createSummary(1, 2),
        createSummary(2, 2),
      ];

      const result = splitSummariesByTierAndBoundary(summaries, {
        promotedIds: new Set([1, 2] as SummaryId[]),
      });

      expect(result.pinned).toEqual([]);
      expect(result.autoRolled).toEqual([]);
      expect(result.tail).toEqual([]);
      expect(result.stats.totalCount).toBe(0);
    });

    it('excludes promoted summaries by ID set', () => {
      const summaries = [
        createSummary(1, 4), // tier 4 but ID is in promoted set
        createSummary(2, 4),
      ];

      const result = splitSummariesByTierAndBoundary(summaries, {
        promotedIds: new Set([1] as SummaryId[]),
      });

      expect(result.tail.length).toBe(1);
      expect(result.tail[0].id).toBe(2);
    });
  });

  describe('tier 3 (pinned) categorization', () => {
    it('puts tier 3 summaries in pinned regardless of boundary', () => {
      const summaries = [
        createSummary(1, 3), // pinned
        createSummary(2, 4), // fresh
        createSummary(3, 3), // pinned
      ];

      const result = splitSummariesByTierAndBoundary(summaries, {
        boundaryId: 1 as SummaryId, // boundary before summary 2
      });

      expect(result.pinned.length).toBe(2);
      expect(result.pinned.map(s => s.id)).toEqual([1, 3]);
    });

    it('tier 3 summaries always appear in prefix', () => {
      const summaries = [
        createSummary(1, 3),
        createSummary(10, 4), // high ID, tier 4
      ];

      const result = splitSummariesByTierAndBoundary(summaries, {
        boundaryId: 5 as SummaryId, // boundary is in the middle
      });

      // Summary 1 (tier 3) should be in prefix even though ID < boundary
      expect(result.prefix.some(s => s.id === 1)).toBe(true);
      // Summary 10 (tier 4) should be in tail because ID > boundary
      expect(result.tail.some(s => s.id === 10)).toBe(true);
    });
  });

  describe('tier 4 (fresh/dynamic) boundary splitting', () => {
    it('splits tier 4 summaries at boundary ID', () => {
      const summaries = [
        createSummary(1, 4),
        createSummary(2, 4),
        createSummary(3, 4),
        createSummary(4, 4),
        createSummary(5, 4),
      ];

      const result = splitSummariesByTierAndBoundary(summaries, {
        boundaryId: 3 as SummaryId,
      });

      // IDs 1, 2, 3 should be auto-rolled (at or before boundary)
      expect(result.autoRolled.length).toBe(3);
      expect(result.autoRolled.map(s => s.id)).toEqual([1, 2, 3]);

      // IDs 4, 5 should be tail (after boundary)
      expect(result.tail.length).toBe(2);
      expect(result.tail.map(s => s.id)).toEqual([4, 5]);
    });

    it('includes boundary ID in auto-rolled (not tail)', () => {
      const summaries = [
        createSummary(5, 4),
        createSummary(10, 4),
      ];

      const result = splitSummariesByTierAndBoundary(summaries, {
        boundaryId: 5 as SummaryId,
      });

      // Summary 5 (at boundary) should be in auto-rolled
      expect(result.autoRolled.map(s => s.id)).toContain(5);
      // Summary 10 should be in tail
      expect(result.tail.map(s => s.id)).toEqual([10]);
    });

    it('all tier 4 go to tail when no boundary set', () => {
      const summaries = [
        createSummary(1, 4),
        createSummary(2, 4),
        createSummary(3, 4),
      ];

      const result = splitSummariesByTierAndBoundary(summaries, {
        boundaryId: null,
      });

      expect(result.autoRolled).toEqual([]);
      expect(result.tail.length).toBe(3);
    });

    it('all tier 4 go to auto-rolled when boundary is at max ID', () => {
      const summaries = [
        createSummary(1, 4),
        createSummary(2, 4),
        createSummary(3, 4),
      ];

      const result = splitSummariesByTierAndBoundary(summaries, {
        boundaryId: 1000 as SummaryId, // Way beyond all IDs
      });

      expect(result.autoRolled.length).toBe(3);
      expect(result.tail).toEqual([]);
    });
  });

  describe('prefix composition', () => {
    it('prefix = pinned + autoRolled (in that order)', () => {
      const summaries = [
        createSummary(1, 3), // pinned
        createSummary(2, 4), // auto-rolled (ID <= boundary)
        createSummary(3, 3), // pinned
        createSummary(4, 4), // tail (ID > boundary)
      ];

      const result = splitSummariesByTierAndBoundary(summaries, {
        boundaryId: 2 as SummaryId,
      });

      expect(result.prefix.length).toBe(3);
      // First should be pinned summaries (tier 3)
      expect(result.prefix[0].tier).toBe(3);
      expect(result.prefix[1].tier).toBe(3);
      // Then auto-rolled (tier 4, ID <= boundary)
      expect(result.prefix[2].tier).toBe(4);
      expect(result.prefix[2].id).toBe(2);
    });

    it('prefix is empty when no tier 3 and no auto-rolled', () => {
      const summaries = [
        createSummary(5, 4),
        createSummary(6, 4),
      ];

      const result = splitSummariesByTierAndBoundary(summaries, {
        boundaryId: 4 as SummaryId, // Boundary before all IDs
      });

      expect(result.prefix).toEqual([]);
      expect(result.tail.length).toBe(2);
    });
  });

  describe('token estimation', () => {
    it('uses stored token_count when available', () => {
      const summaries = [
        createSummary(1, 3, { token_count: 100 } as any),
        createSummary(2, 4, { token_count: 200 } as any),
      ];

      const result = splitSummariesByTierAndBoundary(summaries, {
        boundaryId: 1 as SummaryId,
      });

      expect(result.stats.pinnedTokens).toBe(100);
      expect(result.stats.tailTokens).toBe(200);
    });

    it('estimates tokens from summary text when token_count not available', () => {
      const summaries = [
        createSummary(1, 3, { summary: 'A'.repeat(400) }), // ~100 tokens at 4 chars/token
      ];

      const result = splitSummariesByTierAndBoundary(summaries);

      expect(result.stats.pinnedTokens).toBe(100);
    });

    it('uses custom token estimator when provided', () => {
      const summaries = [
        createSummary(1, 3),
        createSummary(2, 4),
      ];

      const result = splitSummariesByTierAndBoundary(summaries, {
        boundaryId: null,
        estimateTokens: () => 50, // Fixed 50 tokens per summary
      });

      expect(result.stats.pinnedTokens).toBe(50);
      expect(result.stats.tailTokens).toBe(50);
    });

    it('calculates total tokens correctly', () => {
      const summaries = [
        createSummary(1, 3, { token_count: 100 } as any), // pinned
        createSummary(2, 4, { token_count: 150 } as any), // auto-rolled
        createSummary(3, 4, { token_count: 200 } as any), // tail
      ];

      const result = splitSummariesByTierAndBoundary(summaries, {
        boundaryId: 2 as SummaryId,
      });

      expect(result.stats.pinnedTokens).toBe(100);
      expect(result.stats.autoRolledTokens).toBe(150);
      expect(result.stats.tailTokens).toBe(200);
      expect(result.stats.totalTokens).toBe(450);
    });
  });

  describe('stats accuracy', () => {
    it('calculates counts correctly', () => {
      const summaries = [
        createSummary(1, 3),
        createSummary(2, 3),
        createSummary(3, 4),
        createSummary(4, 4),
        createSummary(5, 4),
      ];

      const result = splitSummariesByTierAndBoundary(summaries, {
        boundaryId: 3 as SummaryId,
      });

      expect(result.stats.pinnedCount).toBe(2);
      expect(result.stats.autoRolledCount).toBe(1); // Only ID 3 (tier 4, <= boundary)
      expect(result.stats.tailCount).toBe(2); // IDs 4, 5
      expect(result.stats.totalCount).toBe(5);
    });

    it('totalCount excludes promoted summaries', () => {
      const summaries = [
        createSummary(1, 2), // promoted
        createSummary(2, 3),
        createSummary(3, 4),
      ];

      const result = splitSummariesByTierAndBoundary(summaries, {
        promotedIds: new Set([1] as SummaryId[]),
      });

      expect(result.stats.totalCount).toBe(2); // Only 2 and 3
    });
  });

  describe('edge cases', () => {
    it('handles all summaries being tier 3 (pinned)', () => {
      const summaries = [
        createSummary(1, 3),
        createSummary(2, 3),
        createSummary(3, 3),
      ];

      const result = splitSummariesByTierAndBoundary(summaries);

      expect(result.pinned.length).toBe(3);
      expect(result.autoRolled).toEqual([]);
      expect(result.tail).toEqual([]);
      expect(result.prefix.length).toBe(3);
    });

    it('handles single summary', () => {
      const summaries = [createSummary(1, 4)];

      const result = splitSummariesByTierAndBoundary(summaries, {
        boundaryId: null,
      });

      expect(result.tail.length).toBe(1);
      expect(result.stats.totalCount).toBe(1);
    });

    it('handles archived tier summaries (should be filtered out before this function)', () => {
      // Note: Archived summaries shouldn't typically be passed to this function,
      // but if they are, they should be treated as tier 4 (dynamic)
      const summaries = [
        createSummary(1, 'archived'),
        createSummary(2, 4),
      ];

      const result = splitSummariesByTierAndBoundary(summaries, {
        boundaryId: 1 as SummaryId,
      });

      // Archived summaries don't have tier 3 or 4, so they won't be in pinned or dynamic split
      expect(result.pinned.length).toBe(0);
      expect(result.autoRolled.length).toBe(0);
      expect(result.tail.length).toBe(1); // Only summary 2 (tier 4, ID > boundary)
    });

    it('boundary ID can be higher than any actual summary ID', () => {
      const summaries = [
        createSummary(1, 4),
        createSummary(2, 4),
      ];

      const result = splitSummariesByTierAndBoundary(summaries, {
        boundaryId: 999 as SummaryId,
      });

      expect(result.autoRolled.length).toBe(2);
      expect(result.tail).toEqual([]);
    });

    it('boundary ID can be 0 (before all summaries)', () => {
      const summaries = [
        createSummary(1, 4),
        createSummary(2, 4),
      ];

      const result = splitSummariesByTierAndBoundary(summaries, {
        boundaryId: 0 as SummaryId,
      });

      expect(result.autoRolled).toEqual([]);
      expect(result.tail.length).toBe(2);
    });
  });

  describe('non-sequential IDs', () => {
    it('handles gaps in ID sequence', () => {
      const summaries = [
        createSummary(10, 4),
        createSummary(20, 4),
        createSummary(30, 4),
      ];

      const result = splitSummariesByTierAndBoundary(summaries, {
        boundaryId: 15 as SummaryId, // Between 10 and 20
      });

      expect(result.autoRolled.length).toBe(1);
      expect(result.autoRolled[0].id).toBe(10);
      expect(result.tail.length).toBe(2);
    });

    it('boundary on non-existent ID still works', () => {
      const summaries = [
        createSummary(5, 4),
        createSummary(15, 4),
        createSummary(25, 4),
      ];

      const result = splitSummariesByTierAndBoundary(summaries, {
        boundaryId: 20 as SummaryId, // ID 20 doesn't exist
      });

      // IDs <= 20: 5, 15
      expect(result.autoRolled.length).toBe(2);
      // IDs > 20: 25
      expect(result.tail.length).toBe(1);
    });
  });
});
