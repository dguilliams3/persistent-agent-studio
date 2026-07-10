import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/client';

/**
 * Hook for summary tier configuration with smart caching.
 *
 * Keeps backend requests minimal by caching the latest config and only
 * refetching when the caller-supplied summary count changes (indicating a new
 * summary was added). Threshold updates are debounced per key so slider/input
 * drags do not spam the API.
 */
export function useSummaryConfig(summaryCount: any) {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceTimers = useRef<Record<string, any>>({});

  // Clear timeouts when unmounting.
  useEffect(() => () => {
    Object.values(debounceTimers.current).forEach(clearTimeout);
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get('/summary-config');
      setConfig(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [summaryCount, fetchConfig]);

  const updateSetting = useCallback(
    (key: any, value: any, delay = 400) =>
      new Promise(resolve => {
        if (debounceTimers.current[key]) {
          clearTimeout(debounceTimers.current[key]);
        }

        debounceTimers.current[key] = setTimeout(async () => {
          try {
            const res = await api.post('/summary-config', { [key]: value });
            if (res?.success) {
              setConfig((prev: any) => ({ ...prev, [key]: value }));
              setError(null);
            }
            resolve(res);
          } catch (err: any) {
            setError(err.message);
            resolve({ success: false, error: err.message });
          } finally {
            debounceTimers.current[key] = null;
          }
        }, delay);
      }),
    []
  );

  /**
   * Move a summary to a specific tier with optional position (v25 tier model)
   *
   * @param {number} summaryId - The summary to move
   * @param {2|3|4} tier - Target tier: 2 (PROMOTED), 3 (CACHED), 4 (TAIL)
   * @param {number|null} position - Position within tier (optional)
   * @returns {Promise<{success: boolean, error?: string}>}
   *
   * @tests src/hooks/__tests__/useSummaryConfig.test.js - "moveSummary"
   */
  const moveSummary = useCallback(
    async (summaryId: any, tier: any, position: any = null) => {
      try {
        const res = await api.post(`/summaries/${summaryId}/move`, { tier, position });
        if (res?.success) {
          await fetchConfig();
        }
        return res;
      } catch (err: any) {
        setError(err.message);
        return { success: false, error: err.message };
      }
    },
    [fetchConfig]
  );

  /**
   * Set the tier for a summary without changing position (v25 tier model)
   *
   * @param {number} summaryId - The summary to update
   * @param {2|3|4|'archived'} tier - Target tier: 2 (PROMOTED), 3 (CACHED), 4 (TAIL), or 'archived'
   * @returns {Promise<{success: boolean, error?: string}>}
   *
   * @tests src/hooks/__tests__/useSummaryConfig.test.js - "setSummaryTier"
   */
  const setSummaryTier = useCallback(
    async (summaryId: any, tier: any) => {
      try {
        const res = await api.post(`/summaries/${summaryId}/tier`, { tier });
        if (res?.success) {
          await fetchConfig();
        }
        return res;
      } catch (err: any) {
        setError(err.message);
        return { success: false, error: err.message };
      }
    },
    [fetchConfig]
  );

  return {
    config,
    loading,
    error,
    updateSetting,
    moveSummary,     // v25: move summary to tier with position
    setSummaryTier,  // v25: set tier without position change
    refetch: fetchConfig,
  };
}
