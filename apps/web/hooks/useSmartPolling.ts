/**
 * Smart Polling Hook with Cycle-Aware Intervals
 *
 * @module hooks/useSmartPolling
 * @description Thin wrapper over usePolling that adapts the polling interval
 * to the backend cycle_interval_seconds. Polls at 90% of the cycle interval
 * (with a minimum floor) to catch new data shortly after cycles complete.
 *
 * Key features:
 * - Cycle-aware: Adapts polling interval to backend cycle_interval_seconds
 * - Minimum floor: Never polls faster than minInterval (default 5s)
 * - All features inherited from usePolling: visibility-aware, pause/resume, cleanup
 * - Refresh trigger: Force immediate fetch and reset interval timer
 *
 * @upstream Called by:
 *   - ClaudeExistenceLoop - Main data refresh loop
 * @downstream Calls:
 *   - usePolling (core polling engine)
 *
 * @pattern Composition — wraps usePolling, adds only cycle-interval calculation
 *
 * @antipattern Do NOT copy-paste usePolling internals here. This hook should
 * only compute the interval and delegate to usePolling for all polling mechanics.
 *
 * @example
 * // Basic usage with cycle-aware polling
 * const cycleIntervalSeconds = state?.cycleIntervalSeconds || 60;
 * const { refresh } = useSmartPolling(
 *   () => fetchAllData(),
 *   { cycleIntervalSeconds }
 * );
 *
 * @example
 * // With custom minimum interval
 * useSmartPolling(fetchData, {
 *   cycleIntervalSeconds: 300,  // 5 minute cycles
 *   minInterval: 10000,         // Min 10s between polls
 * });
 * // Result: polls every 270s (90% of 300s)
 *
 * @example
 * // Force immediate refresh after user action
 * const { refresh } = useSmartPolling(fetchAll, { cycleIntervalSeconds });
 * const handleSendMessage = async () => {
 *   await sendMessage(content);
 *   refresh(); // Immediately fetch new data
 * };
 */

import { useMemo } from 'react';
import { usePolling } from './usePolling';

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * @description Smart polling hook with cycle-aware intervals
 *
 * Computes polling interval as 90% of backend cycle interval (with floor),
 * then delegates all polling mechanics to usePolling.
 *
 * @upstream Called by: Components needing cycle-aware data refresh
 * @downstream Calls: usePolling
 *
 * @param {Function} callback - Async function to call on each poll
 * @param {Object} [options={}] - Polling configuration
 * @param {number} [options.cycleIntervalSeconds=60] - Backend cycle interval in seconds
 * @param {number} [options.minInterval=5000] - Minimum polling interval in milliseconds
 * @param {boolean} [options.enabled=true] - Whether polling should start automatically
 * @param {boolean} [options.immediate=true] - Whether to call immediately on start
 * @param {boolean} [options.pauseOnHidden=true] - Pause polling when tab is hidden
 *
 * @returns {Object} Polling controls and state
 * @returns {Function} returns.start - Start polling
 * @returns {Function} returns.stop - Stop polling
 * @returns {Function} returns.refresh - Manually trigger the callback (resets interval)
 * @returns {boolean} returns.isPolling - Whether currently polling
 * @returns {number} returns.currentInterval - Current calculated interval in ms
 */
export function useSmartPolling(callback: any, options: any = {}) {
  const {
    cycleIntervalSeconds = 60,
    minInterval = 5000,
    enabled = true,
    immediate = true,
    pauseOnHidden = true,
  } = options;

  /**
   * @description Calculate smart interval based on cycle interval
   *
   * Uses 90% of cycle interval to poll shortly after cycles complete,
   * with a minimum floor to prevent over-polling.
   *
   * @example
   * // cycleIntervalSeconds=60 → 54000ms (54 seconds)
   * // cycleIntervalSeconds=300 → 270000ms (4.5 minutes)
   * // cycleIntervalSeconds=2 → 5000ms (floor kicks in)
   */
  const currentInterval = useMemo(() => {
    const calculated = cycleIntervalSeconds * 0.9 * 1000;
    return Math.max(calculated, minInterval);
  }, [cycleIntervalSeconds, minInterval]);

  // Delegate all polling mechanics to usePolling
  const polling = usePolling(callback, {
    interval: currentInterval,
    enabled,
    immediate,
    pauseOnHidden,
  });

  return {
    ...polling,
    currentInterval,
  };
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default useSmartPolling;
