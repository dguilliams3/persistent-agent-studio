/**
 * @module @persistence/memory/rag/scoring/recency.test
 * @description Unit tests for recency score calculation
 *
 * Tests cover:
 * - calculateRecencyScore() - exponential decay scoring
 * - calculateRecencyScoreWithConfig() - config-based API
 * - daysUntilThreshold() - threshold calculation
 *
 * @covers recency.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateRecencyScore,
  calculateRecencyScoreWithConfig,
  daysUntilThreshold,
} from './recency';
import { DEFAULT_RECENCY_CONFIG } from '../types';

// ============================================================================
// Test Setup - Mock Date.now()
// ============================================================================

describe('recency scoring', () => {
  const NOW = new Date('2026-01-15T12:00:00.000Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // calculateRecencyScore()
  // ==========================================================================

  describe('calculateRecencyScore', () => {
    describe('decay behavior', () => {
      it('returns ~1.0 for current time', () => {
        const score = calculateRecencyScore('2026-01-15T12:00:00.000Z');
        expect(score).toBeCloseTo(1.0, 2);
      });

      it('returns 0.5 at one half-life (14 days by default)', () => {
        // 14 days ago
        const score = calculateRecencyScore('2026-01-01T12:00:00.000Z');
        expect(score).toBeCloseTo(0.5, 2);
      });

      it('returns 0.25 at two half-lives (28 days)', () => {
        // 28 days ago (Dec 18)
        const score = calculateRecencyScore('2025-12-18T12:00:00.000Z');
        expect(score).toBeCloseTo(0.25, 2);
      });

      it('returns ~0.125 at three half-lives (42 days)', () => {
        // 42 days ago (Dec 4)
        const score = calculateRecencyScore('2025-12-04T12:00:00.000Z');
        expect(score).toBeCloseTo(0.125, 2);
      });

      it('approaches 0 for very old dates', () => {
        // 1 year ago
        const score = calculateRecencyScore('2025-01-15T12:00:00.000Z');
        expect(score).toBeLessThan(0.001);
      });
    });

    describe('custom half-life', () => {
      it('decays faster with shorter half-life', () => {
        const shortHalfLife = 7; // 7 days
        // 7 days ago should give ~0.5
        const score = calculateRecencyScore('2026-01-08T12:00:00.000Z', shortHalfLife);
        expect(score).toBeCloseTo(0.5, 2);
      });

      it('decays slower with longer half-life', () => {
        const longHalfLife = 28; // 28 days
        // 14 days ago with 28-day half-life should give ~0.707 (sqrt(0.5))
        const score = calculateRecencyScore('2026-01-01T12:00:00.000Z', longHalfLife);
        expect(score).toBeCloseTo(Math.sqrt(0.5), 2);
      });

      it('handles half-life of 1 day', () => {
        // 1 day ago with 1-day half-life
        const score = calculateRecencyScore('2026-01-14T12:00:00.000Z', 1);
        expect(score).toBeCloseTo(0.5, 2);
      });
    });

    describe('input formats', () => {
      it('accepts ISO string', () => {
        const score = calculateRecencyScore('2026-01-15T12:00:00.000Z');
        expect(score).toBeCloseTo(1.0, 2);
      });

      it('accepts Date object', () => {
        const date = new Date('2026-01-15T12:00:00.000Z');
        const score = calculateRecencyScore(date);
        expect(score).toBeCloseTo(1.0, 2);
      });

      it('accepts date without Z suffix', () => {
        const score = calculateRecencyScore('2026-01-15T12:00:00');
        // Without Z suffix, treated as local time - may differ from UTC
        // Score could be slightly > 1 if local timezone is ahead of UTC
        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThan(1.5); // Allow for timezone differences
      });
    });

    describe('edge cases', () => {
      it('handles future dates (score > 1)', () => {
        // Tomorrow - exponential will give > 1
        const score = calculateRecencyScore('2026-01-16T12:00:00.000Z');
        expect(score).toBeGreaterThan(1);
      });

      it('handles exact same time', () => {
        const score = calculateRecencyScore(new Date(NOW));
        expect(score).toBeCloseTo(1.0, 10);
      });

      it('handles midnight boundary', () => {
        const score = calculateRecencyScore('2026-01-15T00:00:00.000Z');
        expect(score).toBeGreaterThan(0.9);
        expect(score).toBeLessThan(1.0);
      });
    });
  });

  // ==========================================================================
  // calculateRecencyScoreWithConfig()
  // ==========================================================================

  describe('calculateRecencyScoreWithConfig', () => {
    it('uses default config when not provided', () => {
      const score1 = calculateRecencyScore('2026-01-01T12:00:00.000Z');
      const score2 = calculateRecencyScoreWithConfig('2026-01-01T12:00:00.000Z');
      expect(score1).toBeCloseTo(score2, 10);
    });

    it('uses custom config', () => {
      const customConfig = { halflifeDays: 7 };
      const score = calculateRecencyScoreWithConfig('2026-01-08T12:00:00.000Z', customConfig);
      expect(score).toBeCloseTo(0.5, 2);
    });

    it('accepts partial config', () => {
      const score = calculateRecencyScoreWithConfig('2026-01-01T12:00:00.000Z', {
        halflifeDays: DEFAULT_RECENCY_CONFIG.halflifeDays,
      });
      expect(score).toBeCloseTo(0.5, 2);
    });
  });

  // ==========================================================================
  // daysUntilThreshold()
  // ==========================================================================

  describe('daysUntilThreshold', () => {
    describe('basic calculations', () => {
      it('calculates days to reach 0.5 threshold', () => {
        // With default 14-day half-life, score reaches 0.5 at 14 days
        const days = daysUntilThreshold(0.5);
        expect(days).toBeCloseTo(14, 1);
      });

      it('calculates days to reach 0.25 threshold', () => {
        // Score reaches 0.25 at 28 days (2 half-lives)
        const days = daysUntilThreshold(0.25);
        expect(days).toBeCloseTo(28, 1);
      });

      it('calculates days to reach 0.1 threshold', () => {
        // log(0.1) / log(0.5) * 14 ≈ 46.5
        const days = daysUntilThreshold(0.1);
        expect(days).toBeCloseTo(46.5, 0);
      });

      it('calculates days to reach 0.01 threshold', () => {
        // log(0.01) / log(0.5) * 14 ≈ 93
        const days = daysUntilThreshold(0.01);
        expect(days).toBeCloseTo(93, 0);
      });
    });

    describe('custom half-life', () => {
      it('scales with half-life', () => {
        const days7 = daysUntilThreshold(0.5, 7);
        const days14 = daysUntilThreshold(0.5, 14);
        const days28 = daysUntilThreshold(0.5, 28);

        expect(days7).toBeCloseTo(7, 1);
        expect(days14).toBeCloseTo(14, 1);
        expect(days28).toBeCloseTo(28, 1);
      });

      it('maintains ratio across different half-lives', () => {
        // Days to 0.1 should be same multiple of half-life regardless of half-life value
        const ratio7 = daysUntilThreshold(0.1, 7) / 7;
        const ratio14 = daysUntilThreshold(0.1, 14) / 14;
        expect(ratio7).toBeCloseTo(ratio14, 5);
      });
    });

    describe('edge cases', () => {
      it('returns 0 for threshold of 1.0', () => {
        const days = daysUntilThreshold(1.0);
        // Math.log(1.0) = 0, so result is -0 (negative zero)
        // Use toBeCloseTo to handle -0 vs +0
        expect(days).toBeCloseTo(0, 10);
      });

      it('returns Infinity for threshold of 0', () => {
        const days = daysUntilThreshold(0);
        expect(days).toBe(Infinity);
      });

      it('handles very small thresholds', () => {
        const days = daysUntilThreshold(0.001);
        expect(days).toBeGreaterThan(100);
        expect(Number.isFinite(days)).toBe(true);
      });

      it('handles threshold > 1 (negative days)', () => {
        // Threshold > 1 means score would need to be in the future
        const days = daysUntilThreshold(2);
        expect(days).toBeLessThan(0);
      });
    });
  });
});
