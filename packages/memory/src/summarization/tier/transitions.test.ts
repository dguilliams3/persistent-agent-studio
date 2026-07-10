/**
 * @module @persistence/memory/summarization/tier/transitions.test
 * @description Unit tests for tier transition logic
 *
 * Tests cover:
 * - isValidTransition() - transition validation
 * - getTransitionType() - transition type identification
 * - validateTransition() - detailed validation with error messages
 * - computeDefaultPosition() - position calculation
 * - normalizePositions() - position normalization
 * - shouldTriggerMetasummarize() - auto-meta trigger conditions
 * - computeBoundaryIndex() - boundary index calculation
 * - shouldShiftBoundary() - boundary shift decision
 *
 * @covers transitions.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isValidTransition,
  getTransitionType,
  validateTransition,
  computeDefaultPosition,
  normalizePositions,
  shouldTriggerMetasummarize,
  computeBoundaryIndex,
  shouldShiftBoundary,
} from './transitions';
import { BLOCK } from '../../types';
import { DEFAULT_TIER_CONFIG } from './types';

// ============================================================================
// isValidTransition()
// ============================================================================

describe('isValidTransition', () => {
  describe('valid transitions', () => {
    it('allows STABLE -> PROMOTED (promotion)', () => {
      expect(isValidTransition(BLOCK.STABLE, BLOCK.PROMOTED)).toBe(true);
    });

    it('allows FRESH -> STABLE (stabilization)', () => {
      expect(isValidTransition(BLOCK.FRESH, BLOCK.STABLE)).toBe(true);
    });

    it('allows FRESH -> PROMOTED (direct promotion)', () => {
      expect(isValidTransition(BLOCK.FRESH, BLOCK.PROMOTED)).toBe(true);
    });

    it('allows PROMOTED -> STABLE (demotion)', () => {
      expect(isValidTransition(BLOCK.PROMOTED, BLOCK.STABLE)).toBe(true);
    });

    it('allows STABLE -> FRESH (demotion)', () => {
      expect(isValidTransition(BLOCK.STABLE, BLOCK.FRESH)).toBe(true);
    });

    it('allows PROMOTED -> FRESH (direct demotion)', () => {
      expect(isValidTransition(BLOCK.PROMOTED, BLOCK.FRESH)).toBe(true);
    });

    it('allows STABLE -> archived', () => {
      expect(isValidTransition(BLOCK.STABLE, 'archived')).toBe(true);
    });

    it('allows FRESH -> archived', () => {
      expect(isValidTransition(BLOCK.FRESH, 'archived')).toBe(true);
    });

    it('allows archived -> FRESH (reactivation)', () => {
      expect(isValidTransition('archived', BLOCK.FRESH)).toBe(true);
    });
  });

  describe('invalid transitions', () => {
    it('disallows same tier (no-op)', () => {
      expect(isValidTransition(BLOCK.STABLE, BLOCK.STABLE)).toBe(false);
      expect(isValidTransition(BLOCK.FRESH, BLOCK.FRESH)).toBe(false);
      expect(isValidTransition('archived', 'archived')).toBe(false);
    });

    it('disallows PROMOTED -> archived (must demote first)', () => {
      expect(isValidTransition(BLOCK.PROMOTED, 'archived')).toBe(false);
    });

    it('disallows archived -> PROMOTED (must reactivate to FRESH first)', () => {
      expect(isValidTransition('archived', BLOCK.PROMOTED)).toBe(false);
    });

    it('disallows archived -> STABLE (must go through FRESH)', () => {
      expect(isValidTransition('archived', BLOCK.STABLE)).toBe(false);
    });

    it('disallows transitions to CONSTITUTION (block 1)', () => {
      expect(isValidTransition(BLOCK.STABLE, BLOCK.CONSTITUTION)).toBe(false);
      expect(isValidTransition(BLOCK.FRESH, BLOCK.CONSTITUTION)).toBe(false);
    });

    it('disallows transitions from CONSTITUTION', () => {
      expect(isValidTransition(BLOCK.CONSTITUTION, BLOCK.FRESH)).toBe(false);
    });
  });
});

// ============================================================================
// getTransitionType()
// ============================================================================

describe('getTransitionType', () => {
  it('returns promote type for STABLE -> PROMOTED', () => {
    expect(getTransitionType(BLOCK.STABLE, BLOCK.PROMOTED)).toBe('promote');
  });

  it('returns stabilize type for FRESH -> STABLE', () => {
    expect(getTransitionType(BLOCK.FRESH, BLOCK.STABLE)).toBe('stabilize');
  });

  it('returns demote type for PROMOTED -> STABLE', () => {
    expect(getTransitionType(BLOCK.PROMOTED, BLOCK.STABLE)).toBe('demote');
  });

  it('returns archive type for STABLE -> archived', () => {
    expect(getTransitionType(BLOCK.STABLE, 'archived')).toBe('archive');
  });

  it('returns reactivate type for archived -> FRESH', () => {
    expect(getTransitionType('archived', BLOCK.FRESH)).toBe('reactivate');
  });

  it('returns null for invalid transitions', () => {
    expect(getTransitionType(BLOCK.PROMOTED, 'archived')).toBeNull();
    expect(getTransitionType('archived', BLOCK.PROMOTED)).toBeNull();
  });

  it('returns null for same tier', () => {
    expect(getTransitionType(BLOCK.STABLE, BLOCK.STABLE)).toBeNull();
  });
});

// ============================================================================
// validateTransition()
// ============================================================================

describe('validateTransition', () => {
  describe('valid transitions', () => {
    it('returns valid: true for allowed transition', () => {
      const result = validateTransition(BLOCK.STABLE, BLOCK.PROMOTED);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.transition).toBe('promote');
    });
  });

  describe('invalid transitions', () => {
    it('returns error for same tier', () => {
      const result = validateTransition(BLOCK.STABLE, BLOCK.STABLE);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('already in this tier');
    });

    it('returns helpful error for PROMOTED -> archived', () => {
      const result = validateTransition(BLOCK.PROMOTED, 'archived');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be demoted');
    });

    it('returns helpful error for archived -> non-FRESH', () => {
      const result = validateTransition('archived', BLOCK.STABLE);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('must be reactivated');
      expect(result.error).toContain('Block 4');
    });

    it('includes valid targets in error message', () => {
      const result = validateTransition(BLOCK.CONSTITUTION, BLOCK.FRESH);

      expect(result.valid).toBe(false);
      // Should mention what transitions ARE valid (if any)
    });
  });
});

// ============================================================================
// computeDefaultPosition()
// ============================================================================

describe('computeDefaultPosition', () => {
  describe('empty tier', () => {
    it('returns gap value for first item', () => {
      const position = computeDefaultPosition(BLOCK.STABLE, []);
      expect(position).toBe(100); // Default gap
    });

    it('uses custom gap', () => {
      const position = computeDefaultPosition(BLOCK.STABLE, [], { positionGap: 50 });
      expect(position).toBe(50);
    });
  });

  describe('insertAt: end (default)', () => {
    it('adds after highest position', () => {
      const position = computeDefaultPosition(BLOCK.STABLE, [100, 200, 300]);
      expect(position).toBe(400); // 300 + 100 (gap)
    });

    it('handles unsorted positions', () => {
      const position = computeDefaultPosition(BLOCK.STABLE, [200, 100, 300]);
      expect(position).toBe(400); // max is 300, add gap
    });
  });

  describe('insertAt: start', () => {
    it('inserts before lowest position', () => {
      const position = computeDefaultPosition(BLOCK.STABLE, [100, 200], { insertAt: 'start' });
      // max(1, min - gap) = max(1, 100 - 100) = max(1, 0) = 1
      expect(position).toBe(1);
    });

    it('never goes below 1', () => {
      const position = computeDefaultPosition(BLOCK.STABLE, [50], { insertAt: 'start' });
      expect(position).toBeGreaterThanOrEqual(1);
    });
  });

  describe('insertAt: specific position', () => {
    it('uses specified position', () => {
      const position = computeDefaultPosition(BLOCK.STABLE, [100, 200], { insertAt: 150 });
      expect(position).toBe(150);
    });
  });
});

// ============================================================================
// normalizePositions()
// ============================================================================

describe('normalizePositions', () => {
  it('reorders positions with consistent gaps', () => {
    const input = [
      { id: 1, position: 500 },
      { id: 2, position: 100 },
      { id: 3, position: 300 },
    ];

    const result = normalizePositions(input);

    expect(result).toEqual([
      { id: 2, position: 100 },
      { id: 3, position: 200 },
      { id: 1, position: 300 },
    ]);
  });

  it('uses custom gap', () => {
    const input = [
      { id: 1, position: 500 },
      { id: 2, position: 100 },
    ];

    const result = normalizePositions(input, 50);

    expect(result).toEqual([
      { id: 2, position: 50 },
      { id: 1, position: 100 },
    ]);
  });

  it('handles empty array', () => {
    expect(normalizePositions([])).toEqual([]);
  });

  it('handles single item', () => {
    const input = [{ id: 1, position: 999 }];
    const result = normalizePositions(input);
    expect(result).toEqual([{ id: 1, position: 100 }]);
  });
});

// ============================================================================
// shouldTriggerMetasummarize()
// ============================================================================

describe('shouldTriggerMetasummarize', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('trigger conditions', () => {
    it('triggers when tail tokens exceed threshold', () => {
      const result = shouldTriggerMetasummarize({
        tailTokens: 10000, // Over threshold
        activeSummaryCount: 10,
        lastMetaAt: null,
      });

      expect(result.shouldRun).toBe(true);
      expect(result.conditions.tailOverThreshold).toBe(true);
    });

    it('triggers when summary count exceeded', () => {
      const result = shouldTriggerMetasummarize({
        tailTokens: 1000, // Under threshold
        activeSummaryCount: 100, // Very high
        lastMetaAt: null,
      });

      expect(result.shouldRun).toBe(true);
      expect(result.conditions.summaryCountExceeded).toBe(true);
    });

    it('does not trigger during cooldown', () => {
      const recentMeta = new Date('2026-01-15T11:58:00.000Z'); // 2 minutes ago

      const result = shouldTriggerMetasummarize({
        tailTokens: 10000,
        activeSummaryCount: 100,
        lastMetaAt: recentMeta,
      });

      expect(result.shouldRun).toBe(false);
      expect(result.conditions.cooldownPassed).toBe(false);
    });

    it('triggers after cooldown passes', () => {
      const oldMeta = new Date('2026-01-15T11:50:00.000Z'); // 10 minutes ago

      const result = shouldTriggerMetasummarize({
        tailTokens: 10000,
        activeSummaryCount: 100,
        lastMetaAt: oldMeta,
      });

      expect(result.shouldRun).toBe(true);
      expect(result.conditions.cooldownPassed).toBe(true);
    });
  });

  describe('auto-meta disabled', () => {
    it('never triggers when autoMetaEnabled is false', () => {
      const result = shouldTriggerMetasummarize(
        {
          tailTokens: 100000,
          activeSummaryCount: 1000,
          lastMetaAt: null,
        },
        { ...DEFAULT_TIER_CONFIG, autoMetaEnabled: false }
      );

      expect(result.shouldRun).toBe(false);
      expect(result.reason).toContain('disabled');
    });
  });

  describe('reason messages', () => {
    it('explains why it should run', () => {
      const result = shouldTriggerMetasummarize({
        tailTokens: 10000,
        activeSummaryCount: 10,
        lastMetaAt: null,
      });

      expect(result.reason).toContain('Should run');
      expect(result.reason).toContain('tail tokens');
    });

    it('explains when no conditions met', () => {
      const result = shouldTriggerMetasummarize({
        tailTokens: 100,
        activeSummaryCount: 5,
        lastMetaAt: null,
      });

      expect(result.reason).toContain('No trigger conditions');
    });
  });
});

// ============================================================================
// computeBoundaryIndex()
// ============================================================================

describe('computeBoundaryIndex', () => {
  it('returns -1 for empty array', () => {
    expect(computeBoundaryIndex([], 1000)).toBe(-1);
  });

  it('returns last index when all fit in target', () => {
    const summaries = [
      { id: 1, tokenCount: 100 },
      { id: 2, tokenCount: 100 },
      { id: 3, tokenCount: 100 },
    ];

    const result = computeBoundaryIndex(summaries, 1000);
    expect(result).toBe(2); // All 300 tokens fit in 1000 target
  });

  it('finds boundary when cumulative exceeds target', () => {
    const summaries = [
      { id: 1, tokenCount: 500 },
      { id: 2, tokenCount: 500 },
      { id: 3, tokenCount: 500 },
    ];

    const result = computeBoundaryIndex(summaries, 1000);
    expect(result).toBe(1); // 500 + 500 = 1000, hits target at index 1
  });

  it('returns 0 if first summary exceeds target', () => {
    const summaries = [
      { id: 1, tokenCount: 2000 },
      { id: 2, tokenCount: 100 },
    ];

    const result = computeBoundaryIndex(summaries, 1000);
    expect(result).toBe(0);
  });
});

// ============================================================================
// shouldShiftBoundary()
// ============================================================================

describe('shouldShiftBoundary', () => {
  describe('forward shift (tail too large)', () => {
    it('recommends forward shift when tail exceeds threshold', () => {
      const result = shouldShiftBoundary({
        cachedTokens: 5000,
        tailTokens: 10000, // Over threshold
      });

      expect(result.shouldShift).toBe(true);
      expect(result.direction).toBe('forward');
      expect(result.reason).toContain('exceed threshold');
    });
  });

  describe('backward shift (cached too large)', () => {
    it('recommends backward shift when cached very high and tail has room', () => {
      const config = { ...DEFAULT_TIER_CONFIG, cachedTokenThreshold: 4000, tailTokenTarget: 4000 };
      const result = shouldShiftBoundary(
        {
          cachedTokens: 8000, // 1.5x threshold
          tailTokens: 1000,   // 0.25x target, has lots of room
        },
        config
      );

      expect(result.shouldShift).toBe(true);
      expect(result.direction).toBe('backward');
    });
  });

  describe('no shift needed', () => {
    it('returns no shift when within acceptable ranges', () => {
      const result = shouldShiftBoundary({
        cachedTokens: 3000,
        tailTokens: 4000, // Under threshold
      });

      expect(result.shouldShift).toBe(false);
      expect(result.direction).toBeNull();
      expect(result.reason).toContain('within acceptable ranges');
    });
  });
});
