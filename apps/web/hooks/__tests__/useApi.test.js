/**
 * @module tests/hooks/useApi
 * @description Unit tests for useApi and useApiMutation hooks
 *
 * Test coverage:
 * - Loading state management during requests
 * - Error capture and display
 * - Data persistence after successful requests
 * - Reset functionality
 * - useApiMutation callback integration
 *
 * @covers src/hooks/useApi.js
 *   - useApi() - Loading state (true during request, false after), error capture
 *     (message extraction, fallback), data persistence, clearError(), reset()
 *   - useApiMutation() - Mutation function wrapping, onSuccess/onError callbacks,
 *     loading state tracking, clearError delegation to useApi
 *
 * @fixtures None (uses mock API calls directly)
 * @mocks None (tests hook isolation)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useApi, useApiMutation } from '../../hooks/useApi';

describe('useApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with loading=false, error=null, data=null', () => {
      const { result } = renderHook(() => useApi());

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.data).toBe(null);
    });

    it('should provide execute, clearError, and reset functions', () => {
      const { result } = renderHook(() => useApi());

      expect(typeof result.current.execute).toBe('function');
      expect(typeof result.current.clearError).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });
  });

  describe('execute - successful request', () => {
    it('should set loading=true during request', async () => {
      const { result } = renderHook(() => useApi());

      // Create a promise we can control
      let resolvePromise;
      const mockApiCall = () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        });

      // Start the request
      act(() => {
        result.current.execute(mockApiCall);
      });

      // Should be loading
      expect(result.current.loading).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolvePromise({ success: true });
      });

      // Should no longer be loading
      expect(result.current.loading).toBe(false);
    });

    it('should set data on success and return the result', async () => {
      const { result } = renderHook(() => useApi());
      const mockData = { items: [1, 2, 3] };
      const mockApiCall = vi.fn().mockResolvedValue(mockData);

      let returnValue;
      await act(async () => {
        returnValue = await result.current.execute(mockApiCall);
      });

      expect(result.current.data).toEqual(mockData);
      expect(result.current.error).toBe(null);
      expect(returnValue).toEqual(mockData);
    });

    it('should clear previous error on new request', async () => {
      const { result } = renderHook(() => useApi());

      // First request fails
      const failingCall = vi.fn().mockRejectedValue(new Error('First error'));
      await act(async () => {
        await result.current.execute(failingCall);
      });
      expect(result.current.error).toBe('First error');

      // Second request succeeds
      const successCall = vi.fn().mockResolvedValue({ ok: true });
      await act(async () => {
        await result.current.execute(successCall);
      });

      expect(result.current.error).toBe(null);
      expect(result.current.data).toEqual({ ok: true });
    });
  });

  describe('execute - failed request', () => {
    it('should set error on failure', async () => {
      const { result } = renderHook(() => useApi());
      const mockApiCall = vi.fn().mockRejectedValue(new Error('API Error'));

      await act(async () => {
        await result.current.execute(mockApiCall);
      });

      expect(result.current.error).toBe('API Error');
      expect(result.current.data).toBe(null);
      expect(result.current.loading).toBe(false);
    });

    it('should return null on failure', async () => {
      const { result } = renderHook(() => useApi());
      const mockApiCall = vi.fn().mockRejectedValue(new Error('Fail'));

      let returnValue;
      await act(async () => {
        returnValue = await result.current.execute(mockApiCall);
      });

      expect(returnValue).toBe(null);
    });

    it('should handle errors without message property', async () => {
      const { result } = renderHook(() => useApi());
      const mockApiCall = vi.fn().mockRejectedValue({});

      await act(async () => {
        await result.current.execute(mockApiCall);
      });

      expect(result.current.error).toBe('An error occurred');
    });
  });

  describe('clearError', () => {
    it('should clear the error state', async () => {
      const { result } = renderHook(() => useApi());
      const mockApiCall = vi.fn().mockRejectedValue(new Error('Test error'));

      await act(async () => {
        await result.current.execute(mockApiCall);
      });
      expect(result.current.error).toBe('Test error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBe(null);
    });
  });

  describe('reset', () => {
    it('should reset all state to initial values', async () => {
      const { result } = renderHook(() => useApi());
      const mockApiCall = vi.fn().mockResolvedValue({ data: 'test' });

      await act(async () => {
        await result.current.execute(mockApiCall);
      });
      expect(result.current.data).toEqual({ data: 'test' });

      act(() => {
        result.current.reset();
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.data).toBe(null);
    });
  });
});

describe('useApiMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mutate - successful mutation', () => {
    it('should call mutationFn with provided arguments', async () => {
      const mutationFn = vi.fn().mockResolvedValue({ success: true });
      const { result } = renderHook(() => useApiMutation(mutationFn));

      await act(async () => {
        await result.current.mutate('arg1', 'arg2');
      });

      expect(mutationFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should call onSuccess callback with result', async () => {
      const mockData = { id: 1, name: 'Test' };
      const mutationFn = vi.fn().mockResolvedValue(mockData);
      const onSuccess = vi.fn();

      const { result } = renderHook(() =>
        useApiMutation(mutationFn, { onSuccess })
      );

      await act(async () => {
        await result.current.mutate();
      });

      expect(onSuccess).toHaveBeenCalledWith(mockData);
    });

    it('should return the result on success', async () => {
      const mockData = { created: true };
      const mutationFn = vi.fn().mockResolvedValue(mockData);
      const { result } = renderHook(() => useApiMutation(mutationFn));

      let returnValue;
      await act(async () => {
        returnValue = await result.current.mutate();
      });

      expect(returnValue).toEqual(mockData);
    });
  });

  describe('mutate - failed mutation', () => {
    it('should call onError callback on failure', async () => {
      const mutationFn = vi.fn().mockRejectedValue(new Error('Mutation failed'));
      const onError = vi.fn();

      const { result } = renderHook(() =>
        useApiMutation(mutationFn, { onError })
      );

      await act(async () => {
        await result.current.mutate();
      });

      expect(onError).toHaveBeenCalled();
    });

    it('should return null on failure', async () => {
      const mutationFn = vi.fn().mockRejectedValue(new Error('Fail'));
      const { result } = renderHook(() => useApiMutation(mutationFn));

      let returnValue;
      await act(async () => {
        returnValue = await result.current.mutate();
      });

      expect(returnValue).toBe(null);
    });

    it('should set error state on failure', async () => {
      const mutationFn = vi.fn().mockRejectedValue(new Error('Server error'));
      const { result } = renderHook(() => useApiMutation(mutationFn));

      await act(async () => {
        await result.current.mutate();
      });

      expect(result.current.error).toBe('Server error');
    });
  });

  describe('loading state', () => {
    it('should track loading during mutation', async () => {
      let resolvePromise;
      const mutationFn = () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        });

      const { result } = renderHook(() => useApiMutation(mutationFn));

      expect(result.current.loading).toBe(false);

      act(() => {
        result.current.mutate();
      });

      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolvePromise({ done: true });
      });

      expect(result.current.loading).toBe(false);
    });
  });

  describe('clearError', () => {
    it('should clear error from mutation', async () => {
      const mutationFn = vi.fn().mockRejectedValue(new Error('Error'));
      const { result } = renderHook(() => useApiMutation(mutationFn));

      await act(async () => {
        await result.current.mutate();
      });
      expect(result.current.error).toBe('Error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBe(null);
    });
  });
});
