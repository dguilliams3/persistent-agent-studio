/**
 * @module tests/hooks/useSummaryConfig
 * @description Tests for useSummaryConfig React hook - v25 tier functions
 *
 * Test coverage:
 * - moveSummary() - API call with correct params, config refresh, error handling
 * - setSummaryTier() - API call with correct params, config refresh, error handling
 * - Config fetching and state management
 * - Error propagation and state updates
 *
 * @covers src/hooks/useSummaryConfig.js
 *   - moveSummary(summaryId, tier, position) - Move summary to tier with position
 *   - setSummaryTier(summaryId, tier) - Set tier without position change
 *   - fetchConfig() - Fetch and cache summary config
 *   - Loading/error state management
 *
 * @fixtures None (uses mock API calls)
 * @mocks api client (src/api/client)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSummaryConfig } from '../useSummaryConfig';
import api from '../../api/client';

// Mock the API client
vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('useSummaryConfig', () => {
  const mockConfig = {
    cachedCount: 2,
    tailCount: 3,
    cachedTokens: 800,
    tailTokens: 600,
    tailTokenThreshold: 5000,
    cachedTokenThreshold: 8000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock responses
    api.get.mockResolvedValue(mockConfig);
    api.post.mockResolvedValue({ success: true, changes: 1 });
  });

  function createPendingPromise() {
    return new Promise(() => {});
  }

  describe('initialization', () => {
    it('should start with loading=true and config=null', () => {
      api.get.mockImplementationOnce(() => createPendingPromise());
      const { result } = renderHook(() => useSummaryConfig(5));

      expect(result.current.loading).toBe(true);
      expect(result.current.config).toBe(null);
      expect(result.current.error).toBe(null);
    });

    it('should provide moveSummary and setSummaryTier functions', () => {
      api.get.mockImplementationOnce(() => createPendingPromise());
      const { result } = renderHook(() => useSummaryConfig(5));

      expect(typeof result.current.moveSummary).toBe('function');
      expect(typeof result.current.setSummaryTier).toBe('function');
    });
  });

  describe('fetchConfig', () => {
    it('should fetch config on mount', async () => {
      const { result } = renderHook(() => useSummaryConfig(5));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(api.get).toHaveBeenCalledWith('/summary-config');
      expect(result.current.config).toEqual(mockConfig);
      expect(result.current.error).toBe(null);
    });

    it('should refetch when summaryCount changes', async () => {
      const { result, rerender } = renderHook(
        ({ count }) => useSummaryConfig(count),
        { initialProps: { count: 5 } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(api.get).toHaveBeenCalledTimes(1);

      // Change the summary count to trigger a refetch
      rerender({ count: 6 });

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledTimes(2);
      });
    });

    it('should set error state on API failure', async () => {
      const error = new Error('Network error');
      api.get.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useSummaryConfig(5));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.config).toBe(null);
    });

    it('should clear error on successful refetch after failure', async () => {
      api.get.mockRejectedValueOnce(new Error('Network error'));

      const { result, rerender } = renderHook(
        ({ count }) => useSummaryConfig(count),
        { initialProps: { count: 5 } }
      );

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });

      // Reset mock and trigger refetch
      api.get.mockResolvedValueOnce(mockConfig);
      rerender({ count: 6 });

      await waitFor(() => {
        expect(result.current.error).toBe(null);
        expect(result.current.config).toEqual(mockConfig);
      });
    });
  });

  describe('moveSummary', () => {
    it('should call API with correct path and body', async () => {
      const { result } = renderHook(() => useSummaryConfig(5));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      vi.clearAllMocks();
      api.post.mockResolvedValueOnce({ success: true, changes: 1 });

      let moveResult;
      await act(async () => {
        moveResult = await result.current.moveSummary(42, 'tail', 3);
      });

      expect(api.post).toHaveBeenCalledWith('/summaries/42/move', {
        tier: 'tail',
        position: 3,
      });
      expect(moveResult.success).toBe(true);
    });

    it('should call API without position when position is null', async () => {
      const { result } = renderHook(() => useSummaryConfig(5));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      vi.clearAllMocks();
      api.post.mockResolvedValueOnce({ success: true, changes: 1 });

      await act(async () => {
        await result.current.moveSummary(42, 'cached', null);
      });

      expect(api.post).toHaveBeenCalledWith('/summaries/42/move', {
        tier: 'cached',
        position: null,
      });
    });

    it('should refresh config after successful move', async () => {
      const { result } = renderHook(() => useSummaryConfig(5));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      vi.clearAllMocks();
      api.post.mockResolvedValueOnce({ success: true, changes: 1 });
      api.get.mockResolvedValueOnce(mockConfig);

      await act(async () => {
        await result.current.moveSummary(42, 'tail', 3);
      });

      expect(api.post).toHaveBeenCalled();
      expect(api.get).toHaveBeenCalledWith('/summary-config');
    });

    it('should return success response from API', async () => {
      const { result } = renderHook(() => useSummaryConfig(5));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const expectedResponse = { success: true, changes: 1 };
      api.post.mockResolvedValueOnce(expectedResponse);

      let moveResult;
      await act(async () => {
        moveResult = await result.current.moveSummary(42, 'tail', 3);
      });

      expect(moveResult).toEqual(expectedResponse);
    });

    it('should handle API errors and set error state', async () => {
      const { result } = renderHook(() => useSummaryConfig(5));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const error = new Error('Failed to move summary');
      api.post.mockRejectedValueOnce(error);

      let moveResult;
      await act(async () => {
        moveResult = await result.current.moveSummary(42, 'tail', 3);
      });

      expect(moveResult.success).toBe(false);
      expect(moveResult.error).toBe('Failed to move summary');
      expect(result.current.error).toBe('Failed to move summary');
    });

    it('should not refresh config on API error', async () => {
      const { result } = renderHook(() => useSummaryConfig(5));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      vi.clearAllMocks();
      api.post.mockRejectedValueOnce(new Error('API error'));

      await act(async () => {
        await result.current.moveSummary(42, 'tail', 3);
      });

      // get should NOT be called for config refresh
      expect(api.get).not.toHaveBeenCalled();
    });

    it('should handle failed move with success=false response', async () => {
      const { result } = renderHook(() => useSummaryConfig(5));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const failureResponse = { success: false, error: 'Invalid tier' };
      api.post.mockResolvedValueOnce(failureResponse);

      let moveResult;
      await act(async () => {
        moveResult = await result.current.moveSummary(42, 'invalid', 3);
      });

      expect(moveResult).toEqual(failureResponse);
      // Config should not refresh for failed responses
      // (because res?.success check is falsy)
    });
  });

  describe('setSummaryTier', () => {
    it('should call tier endpoint with correct params', async () => {
      const { result } = renderHook(() => useSummaryConfig(5));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      vi.clearAllMocks();
      api.post.mockResolvedValueOnce({ success: true, changes: 1 });

      let tierResult;
      await act(async () => {
        tierResult = await result.current.setSummaryTier(42, 'archived');
      });

      expect(api.post).toHaveBeenCalledWith('/summaries/42/tier', {
        tier: 'archived',
      });
      expect(tierResult.success).toBe(true);
    });

    it('should accept all valid tier values', async () => {
      const { result } = renderHook(() => useSummaryConfig(5));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const tiers = ['cached', 'tail', 'archived'];

      for (const tier of tiers) {
        vi.clearAllMocks();
        api.post.mockResolvedValueOnce({ success: true });

        await act(async () => {
          await result.current.setSummaryTier(42, tier);
        });

        expect(api.post).toHaveBeenCalledWith(`/summaries/42/tier`, {
          tier,
        });
      }
    });

    it('should refresh config after successful tier change', async () => {
      const { result } = renderHook(() => useSummaryConfig(5));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      vi.clearAllMocks();
      api.post.mockResolvedValueOnce({ success: true });
      api.get.mockResolvedValueOnce(mockConfig);

      await act(async () => {
        await result.current.setSummaryTier(42, 'tail');
      });

      expect(api.post).toHaveBeenCalled();
      expect(api.get).toHaveBeenCalledWith('/summary-config');
    });

    it('should return success response from API', async () => {
      const { result } = renderHook(() => useSummaryConfig(5));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const expectedResponse = { success: true, updated: true };
      api.post.mockResolvedValueOnce(expectedResponse);

      let tierResult;
      await act(async () => {
        tierResult = await result.current.setSummaryTier(42, 'tail');
      });

      expect(tierResult).toEqual(expectedResponse);
    });

    it('should handle API errors and set error state', async () => {
      const { result } = renderHook(() => useSummaryConfig(5));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const error = new Error('Tier update failed');
      api.post.mockRejectedValueOnce(error);

      let tierResult;
      await act(async () => {
        tierResult = await result.current.setSummaryTier(42, 'tail');
      });

      expect(tierResult.success).toBe(false);
      expect(tierResult.error).toBe('Tier update failed');
      expect(result.current.error).toBe('Tier update failed');
    });

    it('should not refresh config on API error', async () => {
      const { result } = renderHook(() => useSummaryConfig(5));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      vi.clearAllMocks();
      api.post.mockRejectedValueOnce(new Error('API error'));

      await act(async () => {
        await result.current.setSummaryTier(42, 'tail');
      });

      expect(api.get).not.toHaveBeenCalled();
    });

    it('should handle timeout or network errors gracefully', async () => {
      const { result } = renderHook(() => useSummaryConfig(5));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const error = new Error('Network timeout');
      api.post.mockRejectedValueOnce(error);

      let tierResult;
      await act(async () => {
        tierResult = await result.current.setSummaryTier(42, 'tail');
      });

      expect(tierResult).toEqual({
        success: false,
        error: 'Network timeout',
      });
    });
  });

  describe('refetch function', () => {
    it('should provide a refetch function', () => {
      api.get.mockImplementationOnce(() => createPendingPromise());
      const { result } = renderHook(() => useSummaryConfig(5));

      expect(typeof result.current.refetch).toBe('function');
    });

    it('should manually trigger config fetch', async () => {
      const { result } = renderHook(() => useSummaryConfig(5));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      vi.clearAllMocks();
      api.get.mockResolvedValueOnce(mockConfig);

      await act(async () => {
        await result.current.refetch();
      });

      expect(api.get).toHaveBeenCalledWith('/summary-config');
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent moveSummary and setSummaryTier calls', async () => {
      const { result } = renderHook(() => useSummaryConfig(5));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      vi.clearAllMocks();
      api.post.mockResolvedValue({ success: true });
      api.get.mockResolvedValue(mockConfig);

      const results = await act(async () => {
        const [moveRes, tierRes] = await Promise.all([
          result.current.moveSummary(1, 'tail', 1),
          result.current.setSummaryTier(2, 'cached'),
        ]);
        return [moveRes, tierRes];
      });

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      // Should have called config refresh twice
      expect(api.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('state persistence', () => {
    it('should preserve config state across multiple calls', async () => {
      const { result } = renderHook(() => useSummaryConfig(5));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialConfig = { ...result.current.config };

      vi.clearAllMocks();
      api.post.mockResolvedValueOnce({ success: true });
      api.get.mockResolvedValueOnce(mockConfig);

      await act(async () => {
        await result.current.moveSummary(1, 'tail', 1);
      });

      // Config should still be valid
      expect(result.current.config).toBeTruthy();
    });
  });
});
