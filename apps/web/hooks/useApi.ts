/**
 * API Request Hook with Loading and Error States
 *
 * @module hooks/useApi
 * @description Custom hook for making API requests with per-request loading
 * and error state tracking. Unlike the store's async actions which just
 * console.log errors, this hook exposes errors to the UI for display.
 *
 * Use this hook when you need:
 * - Loading spinners for specific operations
 * - Error messages displayed to the user
 * - Retry functionality after failures
 *
 * For simple data fetching that updates global state, prefer the store's
 * fetchX actions. Use this hook for mutations or when you need UI feedback.
 *
 * @upstream Called by:
 *   - Tab components - Form submissions, delete operations
 *   - Settings controls - Toggle operations
 *   - Any component needing loading/error UI feedback
 * @downstream Calls:
 *   - api/client.js - All HTTP requests
 *   - React hooks (useState, useCallback)
 *
 * @tests src/hooks/__tests__/useApi.test.js
 *   - useApi:
 *     - "initial state" (loading=false, error=null, data=null, function exports)
 *     - "execute - successful request" (loading state, data persistence, error clearing)
 *     - "execute - failed request" (error capture, null return, fallback message)
 *     - "clearError" (error state clearing)
 *     - "reset" (full state reset to initial values)
 *   - useApiMutation:
 *     - "mutate - successful mutation" (argument passing, onSuccess callback, return value)
 *     - "mutate - failed mutation" (onError callback, null return, error state)
 *     - "loading state" (loading tracking during mutation)
 *     - "clearError" (error clearing from mutation)
 *
 * @example
 * // Basic usage
 * const { execute, loading, error, clearError } = useApi();
 *
 * const handleSubmit = async () => {
 *   const result = await execute(() => api.post('/message', { content }));
 *   if (result) {
 *     // Success - result contains response data
 *     setContent('');
 *   }
 *   // Error is automatically set if request fails
 * };
 *
 * // In JSX
 * {loading && <Spinner />}
 * {error && <ErrorMessage message={error} onDismiss={clearError} />}
 *
 * @example
 * // With immediate execution
 * const { data, loading, error, refetch } = useApiQuery(() => api.get('/state'));
 *
 * @antipattern
 * // WRONG: Using useApi for data that should be in global state
 * const { execute } = useApi();
 * const [history, setHistory] = useState([]);
 * execute(() => api.get('/history')).then(setHistory);
 * // CORRECT: Use store.fetchHistory() for global data
 */

import { useState, useCallback } from 'react';

// =============================================================================
// MAIN HOOK: useApi
// =============================================================================

/**
 * @description Hook for API requests with loading and error states
 *
 * Provides a reusable execute function that wraps any API call with
 * automatic loading state management and error capture.
 *
 * @upstream Called by: Components needing request feedback
 * @downstream Calls: The API function passed to execute()
 *
 * @returns {Object} API request utilities
 * @returns {Function} returns.execute - Execute an API call
 * @returns {boolean} returns.loading - True while request is in flight
 * @returns {string|null} returns.error - Error message if request failed
 * @returns {Function} returns.clearError - Clear the error state
 * @returns {any} returns.data - Last successful response data
 *
 * @example
 * const { execute, loading, error } = useApi();
 *
 * const handleDelete = async (id) => {
 *   const result = await execute(() =>
 *     api.delete(`/items/${id}`, { password: ADMIN_PASSWORD })
 *   );
 *   if (result?.success) {
 *     refreshList();
 *   }
 * };
 */
export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  /**
   * @description Execute an API call with automatic state management
   *
   * @upstream Called by: Component event handlers
   * @downstream Calls: The provided apiCall function
   *
   * @param {Function} apiCall - Async function that makes the API request
   * @returns {Promise<any|null>} Response data on success, null on error
   *
   * @example
   * const result = await execute(() => api.post('/message', { content }));
   */
  const execute = useCallback(async (apiCall: any) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiCall();
      setData(result);
      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'An error occurred';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * @description Clear the current error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * @description Reset all state (loading, error, data)
   */
  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  return {
    execute,
    loading,
    error,
    data,
    clearError,
    reset,
  };
}

// =============================================================================
// CONVENIENCE HOOK: useApiMutation
// =============================================================================

/**
 * @description Specialized hook for mutation operations (POST, PUT, DELETE)
 *
 * Pre-configured for operations that modify data. Includes success callback
 * and automatic error handling.
 *
 * @upstream Called by: Form components, delete buttons
 * @downstream Calls: useApi
 *
 * @param {Function} mutationFn - Function that performs the mutation
 * @param {Object} [options={}] - Configuration options
 * @param {Function} [options.onSuccess] - Called after successful mutation
 * @param {Function} [options.onError] - Called after failed mutation
 * @returns {Object} Mutation utilities
 *
 * @example
 * const sendMessage = useApiMutation(
 *   (content) => api.post('/message', { content }),
 *   {
 *     onSuccess: () => {
 *       setInput('');
 *       fetchHistory();
 *     }
 *   }
 * );
 *
 * // In JSX
 * <button onClick={() => sendMessage.mutate(input)} disabled={sendMessage.loading}>
 *   {sendMessage.loading ? 'Sending...' : 'Send'}
 * </button>
 */
export function useApiMutation(mutationFn: any, options: any = {}) {
  const { execute, loading, error, clearError, data } = useApi();

  /**
   * @description Execute the mutation with optional callbacks
   *
   * @param {...any} args - Arguments to pass to mutationFn
   * @returns {Promise<any|null>} Response data on success, null on error
   */
  const mutate = useCallback(async (...args: any[]) => {
    const result = await execute(() => mutationFn(...args));

    if (result !== null) {
      options.onSuccess?.(result);
    } else {
      options.onError?.(error);
    }

    return result;
  }, [execute, mutationFn, options, error]);

  return {
    mutate,
    loading,
    error,
    data,
    clearError,
  };
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default useApi;
