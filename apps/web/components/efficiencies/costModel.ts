/**
 * Cost model — the ratio arithmetic behind the cadence explorer
 *
 * @module components/efficiencies/costModel
 * @description Pure logic for the Efficiencies page's interactive: given a
 * cycle cadence and an (illustrative) cached fraction of the prompt, derive
 * the shape of a cycle's bill relative to running the same prompt uncached.
 *
 * PROVENANCE RULE (binding, from the six-model review): ratios, not prices.
 * Everything here is expressed relative to the uncached input rate = 1.0.
 * The ratios and thresholds are IMPORTED from the shipped code — the same
 * `selectCacheTtl()` the production loop calls picks the TTL regime here,
 * and the read/write/batch ratios come from `@persistence/core` CACHE_PRICING.
 * The boundary-roll and backoff parameters are pinned copies of platform
 * config (the platform module can't ship in the web bundle); the efficiencies
 * tests assert parity against `platforms/cloudflare/src/config/index.ts` and
 * `platforms/cloudflare/src/constants.ts`, so drift fails the suite.
 *
 * Two knowingly ILLUSTRATIVE values, labeled in the UI:
 * - DEFAULT_CACHED_FRACTION — the real cached share varies with the life lived
 * - CYCLES_PER_BOUNDARY_SHIFT — the boundary module's own worked example
 *   ("one invalidation buys 10+ cycles of hits", boundary.ts header)
 *
 * @upstream Called by: CadenceCostExplorer.tsx, efficiencies tests
 * @downstream Calls: selectCacheTtl (@persistence/runtime — REAL shipped
 *   function), CACHE_PRICING (@persistence/core — REAL shipped ratios)
 * Tested by: `apps/web/components/efficiencies/__tests__/costModel.test.ts`
 */

import {
  selectCacheTtl,
  SHORT_TTL_THRESHOLD,
  LONG_TTL_THRESHOLD,
} from '@persistence/runtime/context/cacheTtl';
import { CACHE_PRICING } from '@persistence/core/constants';

export { selectCacheTtl, SHORT_TTL_THRESHOLD, LONG_TTL_THRESHOLD, CACHE_PRICING };

/**
 * History prefix/tail roll parameters. Pinned copy of
 * `HISTORY_TOKEN_CONFIG.tail` (platforms/cloudflare/src/config/index.ts) —
 * parity asserted by costModel.test.ts.
 */
export const HISTORY_ROLL = {
  thresholdTokens: 12000,
  targetTokens: 6000,
  minTailEntries: 3,
} as const;

/**
 * Summary prefix/tail roll parameters. Pinned copy of
 * `SUMMARY_BUFFER_CONFIG` (platforms/cloudflare/src/constants.ts) —
 * parity asserted by costModel.test.ts.
 */
export const SUMMARY_ROLL = {
  thresholdTokens: 8000,
  targetTokens: 4000,
  minTailSummaries: 1,
  prefixSize: 10,
} as const;

/**
 * Adaptive backoff parameters. Pinned against the module-private constants in
 * `packages/runtime/src/loop/guards.ts` (text-asserted by costModel.test.ts).
 */
export const ADAPTIVE_BACKOFF = {
  unfedWakesBeforeBackoff: 3,
  maxEffectiveIntervalSeconds: 3600,
} as const;

/**
 * The summarize nudge: history length (entries) at which the persona is
 * reminded to compress. Pinned copy of `DEFAULT_SUMMARIZE_THRESHOLD`
 * (platforms/cloudflare/src/constants.ts) — parity asserted in tests.
 */
export const SUMMARIZE_NUDGE_ENTRIES = 70;

/**
 * ILLUSTRATIVE amortization: how many cycles one boundary shift buys.
 * From boundary.ts's own worked example ("Cache invalidated ONCE for 10+
 * cycles of hits") — a shape, not a measurement.
 */
export const CYCLES_PER_BOUNDARY_SHIFT = 10;

/** ILLUSTRATIVE default for the cached share of a mature prompt. */
export const DEFAULT_CACHED_FRACTION = 0.8;

/** Slider bounds for the cadence control (seconds). */
export const INTERVAL_BOUNDS = { min: 60, max: 3600 } as const;

export type TtlRegime = '5m' | '1h' | 'uncached-volatile';

export interface CycleEconomicsInput {
  /** Cycle interval in seconds (the think-loop cadence). */
  intervalSeconds: number;
  /** Fraction of the assembled prompt sitting behind cache markers (0..0.95). */
  cachedFraction: number;
  /** Off-hours batch window engaged (halves the whole bill, adds latency). */
  batchMode: boolean;
}

export interface CycleEconomics {
  /** Wakes per day at this cadence (before adaptive backoff). */
  wakesPerDay: number;
  /** TTL the real selectCacheTtl picks for stable blocks (1 + 2). */
  stableTtl: string | null;
  /** TTL the real selectCacheTtl picks for the volatile block (3) — null = skip caching. */
  volatileTtl: string | null;
  /** Which regime the cadence lands in (drives the UI copy). */
  regime: TtlRegime;
  /** Cache-write premium in effect (1.25x for 5m entries, 2x for 1h). */
  writePremium: number;
  /** Cost share: cached prefix re-read at the read discount. */
  readShare: number;
  /** Cost share: the fresh tail at full input rate. */
  freshShare: number;
  /** Cost share: amortized cache re-writes when the boundary shifts. */
  writeShare: number;
  /** Total cost of the cycle relative to the same prompt uncached (1.0). */
  relativeCost: number;
  /** 1 - relativeCost, as a fraction. */
  savingsFraction: number;
}

/**
 * @description Derive the ratio structure of one cycle's bill. Uncached
 * baseline = 1.0: every token of the prompt paid at the full input rate.
 * With the four-block layout, the cached share is re-read at
 * CACHE_PRICING.cacheReadDiscount, the fresh tail stays at full rate, and the
 * pinned boundary means the cached share is re-WRITTEN (at the TTL's premium)
 * only once per ~CYCLES_PER_BOUNDARY_SHIFT cycles. Batch mode halves the lot.
 *
 * @upstream CadenceCostExplorer (on every slider input), costModel tests
 * @downstream selectCacheTtl (real shipped TTL policy)
 */
export function computeCycleEconomics({
  intervalSeconds,
  cachedFraction,
  batchMode,
}: CycleEconomicsInput): CycleEconomics {
  const interval = Math.max(1, intervalSeconds);
  const cached = Math.min(0.95, Math.max(0, cachedFraction));

  const stableTtl = selectCacheTtl(interval, true);
  const volatileTtl = selectCacheTtl(interval, false);
  const regime: TtlRegime =
    volatileTtl === null ? 'uncached-volatile' : (volatileTtl as TtlRegime);

  const activeTtl = volatileTtl ?? stableTtl;
  const writePremium =
    activeTtl === '5m' ? CACHE_PRICING.cacheWritePremium5m : CACHE_PRICING.cacheWritePremium1h;

  const readShare = cached * CACHE_PRICING.cacheReadDiscount;
  const freshShare = 1 - cached;
  const writeShare = (cached * writePremium) / CYCLES_PER_BOUNDARY_SHIFT;

  const batchMultiplier = batchMode ? CACHE_PRICING.batchDiscount : 1;
  const relativeCost = (readShare + freshShare + writeShare) * batchMultiplier;

  return {
    wakesPerDay: 86400 / interval,
    stableTtl,
    volatileTtl,
    regime,
    writePremium,
    readShare: readShare * batchMultiplier,
    freshShare: freshShare * batchMultiplier,
    writeShare: writeShare * batchMultiplier,
    relativeCost,
    savingsFraction: 1 - relativeCost,
  };
}
