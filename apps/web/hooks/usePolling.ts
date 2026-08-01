/**
 * Smart Polling Hook
 *
 * @module hooks/usePolling
 * @description Custom hook for intelligent data polling with pause/resume
 * capability and visibility-aware behavior.
 *
 * Features:
 * - Configurable interval
 * - Pause when tab is hidden (saves resources)
 * - Manual start/stop control
 * - Immediate initial fetch option
 * - Cleanup on unmount
 *
 * This is UI-level polling (refreshing displayed data).
 * Different from backend LLM caching (context window optimization).
 *
 * @upstream Called by:
 *   - ClaudeExistenceLoop - Main data refresh loop
 *   - Settings tab - Loop status polling
 *   - Any component needing periodic updates
 * @downstream Calls:
 *   - The callback function provided (typically a fetch function)
 *   - React hooks (useEffect, useRef, useCallback)
 *
 * @pattern Core polling engine — composed by useSmartPolling for cycle-aware intervals
 * @tested_by src/hooks/__tests__/usePolling.test.js
 *   - usePolling:
 *     - "initial state" (enabled default, immediate execution, disabled start)
 *     - "interval behavior" (callback timing, default 10000ms interval)
 *     - "start/stop controls" (stop polling, resume after stop, immediate on start)
 *     - "refresh" (manual trigger without affecting interval)
 *     - "cleanup" (interval clearing on unmount)
 *     - "callback updates" (latest callback used when interval fires)
 *     - "error handling" (graceful handling of callback throws)
 *   - useInterval:
 *     - Basic interval calling at specified delay
 *     - Null delay prevents interval start
 *     - Pause/resume via delay changes
 *     - Cleanup on unmount
 *     - Latest callback usage
 *
 * @example
 * // Basic polling every 10 seconds
 * const { start, stop, isPolling } = usePolling(
 *   () => fetchHistory(),
 *   { interval: 10000 }
 * );
 *
 * @example
 * // With visibility awareness (pauses when tab hidden)
 * usePolling(fetchAll, {
 *   interval: 10000,
 *   pauseOnHidden: true,
 *   immediate: true
 * });
 *
 * @example
 * // Manual control
 * const polling = usePolling(fetchData, { enabled: false });
 * <button onClick={polling.start}>Start Polling</button>
 * <button onClick={polling.stop}>Stop Polling</button>
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * @description Smart polling hook with visibility awareness
 *
 * @upstream Called by: Components needing periodic data refresh
 * @downstream Calls: The provided callback function
 *
 * @param {Function} callback - Function to call on each interval
 * @param {Object} [options={}] - Polling configuration
 * @param {number} [options.interval=10000] - Polling interval in milliseconds
 * @param {boolean} [options.enabled=true] - Whether polling should start automatically
 * @param {boolean} [options.immediate=true] - Whether to call immediately on start
 * @param {boolean} [options.pauseOnHidden=true] - Pause polling when tab is hidden
 *
 * @returns {Object} Polling controls
 * @returns {Function} returns.start - Start polling
 * @returns {Function} returns.stop - Stop polling
 * @returns {Function} returns.refresh - Manually trigger the callback
 * @returns {boolean} returns.isPolling - Whether currently polling
 *
 * @example
 * const { isPolling, start, stop, refresh } = usePolling(
 *   async () => {
 *     await fetchState();
 *     await fetchHistory();
 *   },
 *   { interval: 10000 }
 * );
 */
export function usePolling(callback: any, options: any = {}) {
  const {
    interval = 10000,
    enabled = true,
    immediate = true,
    pauseOnHidden = true,
  } = options;

  // Store latest callback in ref to avoid stale closures
  const savedCallback = useRef(callback);
  const intervalRef = useRef<any>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Update ref when callback changes
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  /**
   * @description Execute the callback safely
   */
  const executeCallback = useCallback(() => {
    try {
      savedCallback.current?.();
    } catch (err) {
      console.error('Polling callback error:', err);
    }
  }, []);

  /**
   * @description Start the polling interval
   *
   * @param {boolean} [runImmediately=false] - Whether to run callback immediately
   */
  const start = useCallback((runImmediately = false) => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Run immediately if requested
    if (runImmediately) {
      executeCallback();
    }

    // Set up interval
    intervalRef.current = setInterval(executeCallback, interval);
    setIsPolling(true);
  }, [interval, executeCallback]);

  /**
   * @description Stop the polling interval
   */
  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  /**
   * @description Manually trigger the callback without affecting polling
   */
  const refresh = useCallback(() => {
    executeCallback();
  }, [executeCallback]);

  // Handle visibility changes
  useEffect(() => {
    if (!pauseOnHidden) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab became hidden - pause polling
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          // Don't set isPolling to false - we'll resume
        }
      } else {
        // Tab became visible - resume if we were polling
        if (isPolling && !intervalRef.current) {
          // Refresh immediately when tab becomes visible
          executeCallback();
          intervalRef.current = setInterval(executeCallback, interval);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pauseOnHidden, isPolling, interval, executeCallback]);

  // Initial setup
  useEffect(() => {
    if (enabled) {
      start(immediate);
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, immediate, start]);

  return {
    start: () => start(true),
    stop,
    refresh,
    isPolling,
  };
}

// =============================================================================
// CONVENIENCE HOOK: useInterval
// =============================================================================

/**
 * @description Simpler interval hook without polling-specific features
 *
 * Use this when you just need a setInterval with cleanup.
 * For data fetching, prefer usePolling.
 *
 * @upstream Called by: Components needing simple intervals
 * @downstream Calls: setInterval/clearInterval
 *
 * @param {Function} callback - Function to call on each interval
 * @param {number|null} delay - Interval in ms, or null to pause
 *
 * @example
 * // Update clock every second
 * useInterval(() => setTime(new Date()), 1000);
 *
 * // Pause by passing null
 * useInterval(tick, isPaused ? null : 1000);
 */
export function useInterval(callback: any, delay: any) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default usePolling;
