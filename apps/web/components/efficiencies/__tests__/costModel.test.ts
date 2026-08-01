/**
 * Cost model tests — ratio arithmetic + shipped-parameter drift alarms
 *
 * @module components/efficiencies/__tests__/costModel.test
 * @description Executable spec for the Efficiencies page's numbers. Three
 * jobs: (1) the explorer's arithmetic behaves (uncached baseline = 1.0,
 * batch halves, more cache = cheaper); (2) every constant the page's PROSE
 * states (TTL cutoffs, cache ratios, roll thresholds, backoff, summarize
 * nudge) is asserted against the SHIPPED source — platform config imported
 * directly, module-private guard constants text-pinned — so code drift fails
 * here before the page can lie; (3) the boundary lab runs the REAL shipped
 * `calculateHistoryBoundary` (import identity pinned) and shows the
 * stable-then-shift behavior the copy claims.
 *
 * Targets: `apps/web/components/efficiencies/costModel.ts`,
 *   `apps/web/components/efficiencies/BoundaryShiftLab.tsx` (stepLab +
 *   BOUNDARY_ENGINE), `packages/runtime/src/context/cacheTtl.ts`,
 *   `packages/core/src/constants.ts` (CACHE_PRICING),
 *   `platforms/cloudflare/src/config/index.ts` (HISTORY_TOKEN_CONFIG),
 *   `platforms/cloudflare/src/constants.ts` (SUMMARY_BUFFER_CONFIG,
 *   DEFAULT_SUMMARIZE_THRESHOLD)
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { selectCacheTtl } from '@persistence/runtime/context/cacheTtl';
import { calculateHistoryBoundary } from '@persistence/memory/context/cache/boundary';
import {
  computeCycleEconomics,
  CACHE_PRICING,
  SHORT_TTL_THRESHOLD,
  LONG_TTL_THRESHOLD,
  HISTORY_ROLL,
  SUMMARY_ROLL,
  ADAPTIVE_BACKOFF,
  SUMMARIZE_NUDGE_ENTRIES,
  CYCLES_PER_BOUNDARY_SHIFT,
} from '../costModel';
import { BOUNDARY_ENGINE, stepLab, labCacheConfig } from '../BoundaryShiftLab';
import { HISTORY_TOKEN_CONFIG } from '../../../../../platforms/cloudflare/src/config/index';
import {
  SUMMARY_BUFFER_CONFIG,
  DEFAULT_SUMMARIZE_THRESHOLD,
} from '../../../../../platforms/cloudflare/src/constants';

const BASE = { intervalSeconds: 900, cachedFraction: 0.8, batchMode: false };

describe('computeCycleEconomics — arithmetic', () => {
  it('with nothing cached and no batch, the cycle costs exactly the uncached baseline', () => {
    const economics = computeCycleEconomics({ ...BASE, cachedFraction: 0 });
    expect(economics.relativeCost).toBeCloseTo(1.0, 10);
    expect(economics.readShare).toBe(0);
    expect(economics.writeShare).toBe(0);
  });

  it('batch mode halves the whole bill (the shipped batchDiscount)', () => {
    const sync = computeCycleEconomics(BASE);
    const batched = computeCycleEconomics({ ...BASE, batchMode: true });
    expect(batched.relativeCost).toBeCloseTo(sync.relativeCost * CACHE_PRICING.batchDiscount, 10);
  });

  it('a larger cached share always costs less', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (const fraction of [0, 0.2, 0.4, 0.6, 0.8, 0.95]) {
      const { relativeCost } = computeCycleEconomics({ ...BASE, cachedFraction: fraction });
      expect(relativeCost).toBeLessThan(previous);
      previous = relativeCost;
    }
  });

  it('cost shares always sum to the total', () => {
    for (const intervalSeconds of [90, 900, 2400]) {
      const economics = computeCycleEconomics({ ...BASE, intervalSeconds });
      expect(economics.readShare + economics.freshShare + economics.writeShare).toBeCloseTo(
        economics.relativeCost,
        10,
      );
    }
  });

  it('the TTL regime is decided by the REAL shipped selectCacheTtl', () => {
    for (const intervalSeconds of [60, 269, 270, 900, 1439, 1440, 3600]) {
      const economics = computeCycleEconomics({ ...BASE, intervalSeconds });
      expect(economics.volatileTtl).toBe(selectCacheTtl(intervalSeconds, false));
      expect(economics.stableTtl).toBe(selectCacheTtl(intervalSeconds, true));
    }
    expect(computeCycleEconomics({ ...BASE, intervalSeconds: 120 }).regime).toBe('5m');
    expect(computeCycleEconomics({ ...BASE, intervalSeconds: 900 }).regime).toBe('1h');
    expect(computeCycleEconomics({ ...BASE, intervalSeconds: 2400 }).regime).toBe(
      'uncached-volatile',
    );
  });

  it('wakes/day follows the cadence', () => {
    expect(computeCycleEconomics({ ...BASE, intervalSeconds: 3600 }).wakesPerDay).toBe(24);
    expect(computeCycleEconomics({ ...BASE, intervalSeconds: 1800 }).wakesPerDay).toBe(48);
  });
});

describe('shipped-parameter drift alarms — the prose states these numbers', () => {
  it('cache ratios match @persistence/core CACHE_PRICING (reads 0.1x, writes 1.25x/2x, batch 0.5x)', () => {
    expect(CACHE_PRICING.cacheReadDiscount).toBe(0.1);
    expect(CACHE_PRICING.cacheWritePremium5m).toBe(1.25);
    expect(CACHE_PRICING.cacheWritePremium1h).toBe(2.0);
    expect(CACHE_PRICING.batchDiscount).toBe(0.5);
  });

  it('TTL cutoffs match the shipped cacheTtl thresholds (270s / 1440s)', () => {
    expect(SHORT_TTL_THRESHOLD).toBe(270);
    expect(LONG_TTL_THRESHOLD).toBe(1440);
  });

  it('history roll parameters match the platform HISTORY_TOKEN_CONFIG (12K/6K/min 3)', () => {
    expect(HISTORY_ROLL.thresholdTokens).toBe(HISTORY_TOKEN_CONFIG.tail.threshold);
    expect(HISTORY_ROLL.targetTokens).toBe(HISTORY_TOKEN_CONFIG.tail.target);
    expect(HISTORY_ROLL.minTailEntries).toBe(HISTORY_TOKEN_CONFIG.tail.minValue);
  });

  it('summary roll parameters match the platform SUMMARY_BUFFER_CONFIG (8K/4K/min 1, prefix 10)', () => {
    expect(SUMMARY_ROLL.thresholdTokens).toBe(SUMMARY_BUFFER_CONFIG.tailTokenThreshold);
    expect(SUMMARY_ROLL.targetTokens).toBe(SUMMARY_BUFFER_CONFIG.tailTokenTarget);
    expect(SUMMARY_ROLL.minTailSummaries).toBe(SUMMARY_BUFFER_CONFIG.minTailSummaries);
    expect(SUMMARY_ROLL.prefixSize).toBe(SUMMARY_BUFFER_CONFIG.contextSize);
  });

  it('the summarize nudge matches DEFAULT_SUMMARIZE_THRESHOLD (~70 entries)', () => {
    expect(SUMMARIZE_NUDGE_ENTRIES).toBe(DEFAULT_SUMMARIZE_THRESHOLD);
  });

  it('adaptive-backoff numbers are text-pinned to guards.ts (module-private consts)', () => {
    const guardsSource = fs.readFileSync(
      path.resolve(process.cwd(), 'packages/runtime/src/loop/guards.ts'),
      'utf-8',
    );
    expect(guardsSource).toContain(
      `UNFED_WAKE_THRESHOLD = ${ADAPTIVE_BACKOFF.unfedWakesBeforeBackoff}`,
    );
    expect(guardsSource).toContain(
      `MAX_EFFECTIVE_INTERVAL_SECONDS = ${ADAPTIVE_BACKOFF.maxEffectiveIntervalSeconds}`,
    );
  });

  it('the ~10-cycle amortization is the boundary module\'s own worked example', () => {
    const boundarySource = fs.readFileSync(
      path.resolve(process.cwd(), 'packages/memory/src/context/cache/boundary.ts'),
      'utf-8',
    );
    expect(CYCLES_PER_BOUNDARY_SHIFT).toBe(10);
    expect(boundarySource).toContain('10+ cycles');
  });
});

describe('boundary lab — the real shipped algorithm', () => {
  it('BOUNDARY_ENGINE IS calculateHistoryBoundary — the import is pinned, not a re-implementation', () => {
    expect(BOUNDARY_ENGINE).toBe(calculateHistoryBoundary);
  });

  it('boundary initializes on the first wake, then HOLDS while the tail grows', () => {
    const tokensPerEntry = 600;
    let state = stepLab(
      {
        entries: [],
        boundaryId: null,
        hitsSinceShift: 0,
        totalShifts: 0,
        lastLog: '',
        lastShifted: false,
      },
      tokensPerEntry,
      1,
    );
    expect(state.totalShifts).toBe(1); // initialization counts as the first write
    const boundaryAfterInit = state.boundaryId;

    state = stepLab(state, tokensPerEntry, 5);
    expect(state.boundaryId).toBe(boundaryAfterInit); // pinned — cache HITs
    expect(state.totalShifts).toBe(1);
    expect(state.hitsSinceShift).toBe(5);
  });

  it('the boundary shifts once the tail crosses the shipped threshold, and the tail shrinks toward target', () => {
    const tokensPerEntry = 600;
    const state = stepLab(
      {
        entries: [],
        boundaryId: null,
        hitsSinceShift: 0,
        totalShifts: 0,
        lastLog: '',
        lastShifted: false,
      },
      tokensPerEntry,
      40,
    );
    expect(state.totalShifts).toBeGreaterThanOrEqual(2); // init + at least one threshold roll

    // Recompute the tail the same way the lab renders it and check the invariant:
    // after 40 wakes the tail must sit BELOW the threshold (a shift reset it).
    const config = labCacheConfig();
    const result = calculateHistoryBoundary(state.entries, state.boundaryId, config);
    expect(result.tailTokenCount).toBeLessThanOrEqual(config.historyTailTokenThreshold);
    expect(result.shifted).toBe(false); // steady state right after the lab's own pass
  });
});
