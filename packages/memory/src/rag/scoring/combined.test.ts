/**
 * @module @persistence/memory/rag/scoring/combined.test
 * @description Unit tests for combined weighted scoring
 *
 * Tests cover:
 * - calculateCombinedScore() - weighted score combination
 * - createScoreBreakdown() - full breakdown creation
 * - validateWeights() - weight validation
 * - normalizeWeights() - weight normalization
 * - sortByScore() - score-based sorting
 * - filterByMinScore() - threshold filtering
 *
 * @covers combined.ts
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCombinedScore,
  createScoreBreakdown,
  validateWeights,
  normalizeWeights,
  sortByScore,
  filterByMinScore,
} from './combined';
import { DEFAULT_SCORING_WEIGHTS } from '../types';

// ============================================================================
// calculateCombinedScore()
// ============================================================================

describe('calculateCombinedScore', () => {
  describe('default weights', () => {
    it('calculates with default weights (0.6, 0.25, 0.15)', () => {
      // similarity: 0.8, recency: 0.6, importance: 0.4
      // Combined: 0.8*0.6 + 0.6*0.25 + 0.4*0.15 = 0.48 + 0.15 + 0.06 = 0.69
      const score = calculateCombinedScore(0.8, 0.6, 0.4);
      expect(score).toBeCloseTo(0.69, 2);
    });

    it('returns similarity when recency and importance are 0', () => {
      const score = calculateCombinedScore(1.0, 0, 0);
      expect(score).toBeCloseTo(0.6, 10); // 1.0 * 0.6
    });

    it('returns 0 when all inputs are 0', () => {
      const score = calculateCombinedScore(0, 0, 0);
      expect(score).toBe(0);
    });

    it('returns 1 when all inputs are 1 (assuming weights sum to 1)', () => {
      const score = calculateCombinedScore(1, 1, 1);
      expect(score).toBeCloseTo(1.0, 10);
    });
  });

  describe('custom weights', () => {
    it('uses custom weights correctly', () => {
      const weights = { similarity: 0.5, recency: 0.3, importance: 0.2 };
      // 0.8*0.5 + 0.6*0.3 + 0.4*0.2 = 0.4 + 0.18 + 0.08 = 0.66
      const score = calculateCombinedScore(0.8, 0.6, 0.4, weights);
      expect(score).toBeCloseTo(0.66, 2);
    });

    it('handles similarity-only weights', () => {
      const weights = { similarity: 1.0, recency: 0, importance: 0 };
      const score = calculateCombinedScore(0.75, 0.5, 0.5, weights);
      expect(score).toBeCloseTo(0.75, 10);
    });

    it('handles equal weights', () => {
      const weights = { similarity: 1/3, recency: 1/3, importance: 1/3 };
      const score = calculateCombinedScore(0.6, 0.6, 0.6, weights);
      expect(score).toBeCloseTo(0.6, 5);
    });
  });

  describe('edge cases', () => {
    it('handles negative similarity', () => {
      const score = calculateCombinedScore(-0.5, 0.5, 0.5);
      expect(score).toBeLessThan(0.5);
    });

    it('handles importance > 1', () => {
      const score = calculateCombinedScore(0.5, 0.5, 1.5);
      expect(score).toBeGreaterThan(0.5);
    });

    it('handles all maximum values', () => {
      const score = calculateCombinedScore(1, 1, 1.5);
      expect(score).toBeGreaterThan(1);
    });
  });
});

// ============================================================================
// createScoreBreakdown()
// ============================================================================

describe('createScoreBreakdown', () => {
  it('creates complete breakdown object', () => {
    const breakdown = createScoreBreakdown(0.8, 0.6, 0.4);

    expect(breakdown.similarity).toBe(0.8);
    expect(breakdown.recency).toBe(0.6);
    expect(breakdown.importance).toBe(0.4);
    expect(breakdown.combined).toBeCloseTo(0.69, 2);
  });

  it('calculates combined using default weights', () => {
    const breakdown = createScoreBreakdown(1, 1, 1);
    expect(breakdown.combined).toBeCloseTo(1.0, 10);
  });

  it('uses custom weights for combined calculation', () => {
    const weights = { similarity: 0.5, recency: 0.3, importance: 0.2 };
    const breakdown = createScoreBreakdown(0.8, 0.6, 0.4, weights);
    expect(breakdown.combined).toBeCloseTo(0.66, 2);
  });

  it('preserves original values in breakdown', () => {
    const breakdown = createScoreBreakdown(0.123, 0.456, 0.789);
    expect(breakdown.similarity).toBe(0.123);
    expect(breakdown.recency).toBe(0.456);
    expect(breakdown.importance).toBe(0.789);
  });
});

// ============================================================================
// validateWeights()
// ============================================================================

describe('validateWeights', () => {
  describe('valid weights', () => {
    it('returns true for default weights', () => {
      expect(validateWeights(DEFAULT_SCORING_WEIGHTS)).toBe(true);
    });

    it('returns true for weights summing to exactly 1', () => {
      const weights = { similarity: 0.5, recency: 0.3, importance: 0.2 };
      expect(validateWeights(weights)).toBe(true);
    });

    it('returns true for equal weights', () => {
      const weights = { similarity: 1/3, recency: 1/3, importance: 1/3 };
      expect(validateWeights(weights)).toBe(true);
    });

    it('returns true within epsilon tolerance', () => {
      const weights = { similarity: 0.6, recency: 0.25, importance: 0.1500001 };
      expect(validateWeights(weights)).toBe(true);
    });
  });

  describe('invalid weights', () => {
    it('returns false when sum < 1', () => {
      const weights = { similarity: 0.5, recency: 0.2, importance: 0.1 };
      expect(validateWeights(weights)).toBe(false);
    });

    it('returns false when sum > 1', () => {
      const weights = { similarity: 0.6, recency: 0.3, importance: 0.3 };
      expect(validateWeights(weights)).toBe(false);
    });

    it('returns false for all zeros', () => {
      const weights = { similarity: 0, recency: 0, importance: 0 };
      expect(validateWeights(weights)).toBe(false);
    });
  });

  describe('custom epsilon', () => {
    it('uses custom epsilon for validation', () => {
      const weights = { similarity: 0.5, recency: 0.3, importance: 0.15 }; // Sum = 0.95
      expect(validateWeights(weights, 0.001)).toBe(false);
      expect(validateWeights(weights, 0.1)).toBe(true);
    });
  });
});

// ============================================================================
// normalizeWeights()
// ============================================================================

describe('normalizeWeights', () => {
  describe('normalization', () => {
    it('normalizes weights to sum to 1', () => {
      const weights = { similarity: 2, recency: 1, importance: 1 };
      const normalized = normalizeWeights(weights);

      expect(normalized.similarity).toBeCloseTo(0.5, 10);
      expect(normalized.recency).toBeCloseTo(0.25, 10);
      expect(normalized.importance).toBeCloseTo(0.25, 10);
      expect(validateWeights(normalized)).toBe(true);
    });

    it('keeps already-normalized weights the same', () => {
      const weights = { similarity: 0.6, recency: 0.25, importance: 0.15 };
      const normalized = normalizeWeights(weights);

      expect(normalized.similarity).toBeCloseTo(0.6, 10);
      expect(normalized.recency).toBeCloseTo(0.25, 10);
      expect(normalized.importance).toBeCloseTo(0.15, 10);
    });

    it('handles very large weights', () => {
      const weights = { similarity: 100, recency: 50, importance: 50 };
      const normalized = normalizeWeights(weights);

      expect(normalized.similarity).toBeCloseTo(0.5, 10);
      expect(validateWeights(normalized)).toBe(true);
    });

    it('handles very small weights', () => {
      const weights = { similarity: 0.001, recency: 0.001, importance: 0.001 };
      const normalized = normalizeWeights(weights);

      expect(normalized.similarity).toBeCloseTo(1/3, 5);
      expect(validateWeights(normalized)).toBe(true);
    });
  });

  describe('zero handling', () => {
    it('returns equal weights when all are zero', () => {
      const weights = { similarity: 0, recency: 0, importance: 0 };
      const normalized = normalizeWeights(weights);

      expect(normalized.similarity).toBeCloseTo(1/3, 10);
      expect(normalized.recency).toBeCloseTo(1/3, 10);
      expect(normalized.importance).toBeCloseTo(1/3, 10);
      expect(validateWeights(normalized)).toBe(true);
    });
  });
});

// ============================================================================
// sortByScore()
// ============================================================================

describe('sortByScore', () => {
  it('sorts items by score descending', () => {
    const items = [
      { name: 'low', score: 0.3 },
      { name: 'high', score: 0.9 },
      { name: 'medium', score: 0.6 },
    ];

    const sorted = sortByScore(items, item => item.score);

    expect(sorted[0].name).toBe('high');
    expect(sorted[1].name).toBe('medium');
    expect(sorted[2].name).toBe('low');
  });

  it('does not mutate original array', () => {
    const items = [
      { name: 'a', score: 0.5 },
      { name: 'b', score: 0.8 },
    ];
    const original = [...items];

    sortByScore(items, item => item.score);

    expect(items[0].name).toBe(original[0].name);
    expect(items[1].name).toBe(original[1].name);
  });

  it('handles empty array', () => {
    const sorted = sortByScore([], () => 0);
    expect(sorted).toEqual([]);
  });

  it('handles single element', () => {
    const items = [{ score: 0.5 }];
    const sorted = sortByScore(items, item => item.score);
    expect(sorted.length).toBe(1);
    expect(sorted[0].score).toBe(0.5);
  });

  it('handles equal scores (stable-ish)', () => {
    const items = [
      { name: 'a', score: 0.5 },
      { name: 'b', score: 0.5 },
      { name: 'c', score: 0.5 },
    ];

    const sorted = sortByScore(items, item => item.score);
    expect(sorted.length).toBe(3);
    // All have same score, order may vary but all should be present
    expect(sorted.map(i => i.name).sort()).toEqual(['a', 'b', 'c']);
  });

  it('works with nested score access', () => {
    const items = [
      { data: { scores: { combined: 0.3 } } },
      { data: { scores: { combined: 0.9 } } },
    ];

    const sorted = sortByScore(items, item => item.data.scores.combined);
    expect(sorted[0].data.scores.combined).toBe(0.9);
    expect(sorted[1].data.scores.combined).toBe(0.3);
  });
});

// ============================================================================
// filterByMinScore()
// ============================================================================

describe('filterByMinScore', () => {
  it('filters items below threshold', () => {
    const items = [
      { name: 'a', score: 0.3 },
      { name: 'b', score: 0.7 },
      { name: 'c', score: 0.5 },
    ];

    const filtered = filterByMinScore(items, item => item.score, 0.5);

    expect(filtered.length).toBe(2);
    expect(filtered.map(i => i.name)).toContain('b');
    expect(filtered.map(i => i.name)).toContain('c');
    expect(filtered.map(i => i.name)).not.toContain('a');
  });

  it('includes items at exactly the threshold', () => {
    const items = [
      { score: 0.5 },
      { score: 0.4999 },
      { score: 0.5001 },
    ];

    const filtered = filterByMinScore(items, item => item.score, 0.5);

    expect(filtered.length).toBe(2);
  });

  it('returns empty array when all below threshold', () => {
    const items = [
      { score: 0.1 },
      { score: 0.2 },
      { score: 0.3 },
    ];

    const filtered = filterByMinScore(items, item => item.score, 0.5);
    expect(filtered).toEqual([]);
  });

  it('returns all items when all above threshold', () => {
    const items = [
      { score: 0.6 },
      { score: 0.7 },
      { score: 0.8 },
    ];

    const filtered = filterByMinScore(items, item => item.score, 0.5);
    expect(filtered.length).toBe(3);
  });

  it('handles empty array', () => {
    const filtered = filterByMinScore([], () => 0, 0.5);
    expect(filtered).toEqual([]);
  });

  it('handles threshold of 0', () => {
    const items = [
      { score: 0 },
      { score: -0.1 },
      { score: 0.1 },
    ];

    const filtered = filterByMinScore(items, item => item.score, 0);
    expect(filtered.length).toBe(2); // 0 and 0.1
  });
});
