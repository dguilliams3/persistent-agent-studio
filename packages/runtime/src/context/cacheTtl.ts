/**
 * Cache TTL Selection
 *
 * @module @persistence/runtime/context/cacheTtl
 * @description Pure function that selects the appropriate cache TTL for system blocks
 * based on the think cycle interval. Shorter intervals benefit from shorter TTLs
 * (auto-refresh), while longer intervals need longer TTLs to survive between calls.
 *
 * @upstream Called by: buildSystemBlocks() in systemBlocks.ts
 * @downstream Calls: None (pure function)
 */

/** Threshold below which short (5m) TTL is used */
export const SHORT_TTL_THRESHOLD = 270;

/** Threshold below which long (1h) TTL is used */
export const LONG_TTL_THRESHOLD = 1440;

/**
 * @description Selects the appropriate cache TTL based on cycle interval.
 *
 * Stable blocks (constitution, cold storage, etc.) are always cached.
 * Volatile blocks are only cached if the interval supports enough reads
 * to justify the cache write cost.
 *
 * TTL Selection:
 * - interval < 270s: Use 5m TTL (1.25x write cost, auto-refreshes)
 * - interval < 1440s: Use 1h TTL (2x write cost, multiple reads)
 * - interval >= 1440s: Skip caching volatile blocks (not worth 2x write cost)
 *
 * @param intervalSeconds - Current cycle interval in seconds
 * @param isStableBlock - Whether this is a stable (rarely-changing) block
 * @returns Cache TTL string ('5m', '1h') or null if caching is not worthwhile
 */
export function selectCacheTtl(intervalSeconds: number, isStableBlock = false): string | null {
  // Stable blocks (constitution, cold storage, etc): always cache
  if (isStableBlock) {
    return intervalSeconds < SHORT_TTL_THRESHOLD ? '5m' : '1h';
  }

  // Volatile blocks: optimize based on interval
  if (intervalSeconds < SHORT_TTL_THRESHOLD) {
    return '5m';
  }
  if (intervalSeconds < LONG_TTL_THRESHOLD) {
    return '1h';
  }
  return null;
}
