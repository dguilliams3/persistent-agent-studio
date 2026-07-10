/**
 * @module @persistence/memory/rag/scoring/importance.test
 * @description Unit tests for importance score calculation
 *
 * Tests cover:
 * - calculateImportanceScore() - log-scaled scoring
 * - calculateImportanceScoreWithConfig() - config-based API
 * - messagesForScore() - inverse calculation
 *
 * @covers importance.ts
 */

import { describe, it, expect } from 'vitest';
import {
  calculateImportanceScore,
  calculateImportanceScoreWithConfig,
  messagesForScore,
} from './importance';
import { DEFAULT_IMPORTANCE_CONFIG } from '../types';

// ============================================================================
// calculateImportanceScore()
// ============================================================================

describe('calculateImportanceScore', () => {
  describe('log scaling behavior', () => {
    it('returns minimum score for 0 messages', () => {
      const score = calculateImportanceScore(0);
      expect(score).toBe(DEFAULT_IMPORTANCE_CONFIG.minimumScore);
      expect(score).toBe(0.1);
    });

    it('returns minimum score for negative messages', () => {
      const score = calculateImportanceScore(-5);
      expect(score).toBe(DEFAULT_IMPORTANCE_CONFIG.minimumScore);
    });

    it('returns ~1.0 for maxExpectedCount (100)', () => {
      const score = calculateImportanceScore(100);
      expect(score).toBeCloseTo(1.0, 2);
    });

    it('returns score > 1 for counts above maxExpectedCount', () => {
      const score = calculateImportanceScore(200);
      expect(score).toBeGreaterThan(1.0);
    });

    it('follows logarithmic curve', () => {
      const score10 = calculateImportanceScore(10);
      const score50 = calculateImportanceScore(50);
      const score100 = calculateImportanceScore(100);

      // Each doubling should add less than the previous
      const gain1to10 = score10 - 0.1;
      const gain10to50 = score50 - score10;
      const gain50to100 = score100 - score50;

      // Logarithmic: diminishing returns
      expect(gain1to10).toBeGreaterThan(gain10to50);
      // Not strictly true due to log curve shape, but trend should flatten
    });
  });

  describe('expected values', () => {
    it('calculates expected scores for key message counts', () => {
      // Based on formula: log(1 + count) / log(1 + max)
      // For max = 100: log(101) ≈ 4.615

      // 1 message: log(2) / log(101) ≈ 0.693 / 4.615 ≈ 0.15
      expect(calculateImportanceScore(1)).toBeCloseTo(0.15, 1);

      // 10 messages: log(11) / log(101) ≈ 2.398 / 4.615 ≈ 0.52
      expect(calculateImportanceScore(10)).toBeCloseTo(0.52, 1);

      // 50 messages: log(51) / log(101) ≈ 3.932 / 4.615 ≈ 0.85
      expect(calculateImportanceScore(50)).toBeCloseTo(0.85, 1);
    });
  });

  describe('custom maxExpectedCount', () => {
    it('scales score based on custom max', () => {
      // With max = 50, 50 messages should give ~1.0
      const score = calculateImportanceScore(50, 50);
      expect(score).toBeCloseTo(1.0, 2);
    });

    it('gives higher scores with lower max', () => {
      const scoreMax100 = calculateImportanceScore(25, 100);
      const scoreMax50 = calculateImportanceScore(25, 50);

      expect(scoreMax50).toBeGreaterThan(scoreMax100);
    });

    it('handles very small max', () => {
      const score = calculateImportanceScore(1, 1);
      expect(score).toBeCloseTo(1.0, 2);
    });

    it('handles very large max', () => {
      const score = calculateImportanceScore(100, 10000);
      expect(score).toBeLessThan(0.6);
    });
  });

  describe('edge cases', () => {
    it('handles null/undefined as 0', () => {
      expect(calculateImportanceScore(null as any)).toBe(0.1);
      expect(calculateImportanceScore(undefined as any)).toBe(0.1);
    });

    it('handles very large message counts', () => {
      const score = calculateImportanceScore(10000);
      expect(score).toBeGreaterThan(1.5);
      expect(Number.isFinite(score)).toBe(true);
    });

    it('handles floating point counts', () => {
      const score = calculateImportanceScore(50.5);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(2);
    });
  });
});

// ============================================================================
// calculateImportanceScoreWithConfig()
// ============================================================================

describe('calculateImportanceScoreWithConfig', () => {
  it('uses default config when not provided', () => {
    const score1 = calculateImportanceScore(50);
    const score2 = calculateImportanceScoreWithConfig(50);
    expect(score1).toBeCloseTo(score2, 10);
  });

  it('uses custom minimumScore', () => {
    const customConfig = { maxExpectedCount: 100, minimumScore: 0.05 };
    const score = calculateImportanceScoreWithConfig(0, customConfig);
    expect(score).toBe(0.05);
  });

  it('uses custom maxExpectedCount', () => {
    const customConfig = { maxExpectedCount: 50, minimumScore: 0.1 };
    const score = calculateImportanceScoreWithConfig(50, customConfig);
    expect(score).toBeCloseTo(1.0, 2);
  });

  it('handles negative message count with custom config', () => {
    const customConfig = { maxExpectedCount: 100, minimumScore: 0.2 };
    const score = calculateImportanceScoreWithConfig(-10, customConfig);
    expect(score).toBe(0.2);
  });
});

// ============================================================================
// messagesForScore()
// ============================================================================

describe('messagesForScore', () => {
  describe('inverse calculation', () => {
    it('returns ~0 messages for score ~0', () => {
      const messages = messagesForScore(0);
      expect(messages).toBe(0);
    });

    it('returns approximately maxExpectedCount for score 1.0', () => {
      const messages = messagesForScore(1.0);
      // Due to floating-point precision, Math.ceil may round up by 1
      expect(messages).toBeGreaterThanOrEqual(100);
      expect(messages).toBeLessThanOrEqual(101);
    });

    it('calculates correctly for score 0.5', () => {
      // Score 0.5 means log(1 + count) = 0.5 * log(101)
      // 1 + count = 101^0.5 ≈ 10.05
      // count ≈ 9.05, Math.ceil gives 10
      const messages = messagesForScore(0.5);
      expect(messages).toBe(10);
    });

    it('is inverse of calculateImportanceScore (round-trip)', () => {
      const testCounts = [1, 5, 10, 25, 50, 75, 100];

      for (const count of testCounts) {
        const score = calculateImportanceScore(count);
        const recovered = messagesForScore(score);
        // Allow for rounding up by 1 (messagesForScore uses Math.ceil)
        expect(recovered).toBeGreaterThanOrEqual(count);
        expect(recovered).toBeLessThanOrEqual(count + 1);
      }
    });
  });

  describe('custom maxExpectedCount', () => {
    it('scales with custom max', () => {
      const messages = messagesForScore(1.0, 50);
      expect(messages).toBe(50);
    });

    it('is inverse with custom max', () => {
      const customMax = 200;
      const score = calculateImportanceScore(100, customMax);
      const recovered = messagesForScore(score, customMax);
      // Allow for rounding up by 1 (messagesForScore uses Math.ceil)
      expect(recovered).toBeGreaterThanOrEqual(100);
      expect(recovered).toBeLessThanOrEqual(101);
    });
  });

  describe('edge cases', () => {
    it('returns > maxExpectedCount for score > 1', () => {
      const messages = messagesForScore(1.5);
      expect(messages).toBeGreaterThan(100);
    });

    it('handles score of exactly 0', () => {
      const messages = messagesForScore(0);
      // e^0 - 1 = 0
      expect(messages).toBe(0);
    });

    it('handles very high scores', () => {
      const messages = messagesForScore(2.0);
      expect(Number.isFinite(messages)).toBe(true);
      expect(messages).toBeGreaterThan(1000);
    });
  });
});
