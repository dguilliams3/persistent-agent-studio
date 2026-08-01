/**
 * Authentication Hook
 *
 * Manages authentication state and provides login/logout functionality.
 * Uses JWT tokens stored in localStorage for persistence across browser sessions.
 *
 * IMPORTANT: Uses a singleton pattern to share state across all components.
 * This ensures LoginForm and ProtectedRoute see the same auth state.
 *
 * @module hooks/useAuth
 * @upstream Called by: LoginForm, ProtectedRoute, App components
 * @downstream Calls: api.post('/auth/*') endpoints
 */

import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { api, DEMO_MODE } from '../api/client.js';

// =============================================================================
// SINGLETON AUTH STATE
// =============================================================================
// Shared state across all useAuth() calls - fixes the "independent state" bug
// where LoginForm and ProtectedRoute had different isAuthenticated values.
// =============================================================================

let authState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  error: null,
};

const listeners = new Set();

function notifyListeners() {
  listeners.forEach((listener: any) => listener());
}

function setAuthState(updates: any) {
  authState = { ...authState, ...updates };
  notifyListeners();
}

function subscribe(listener: any) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return authState;
}

/**
 * Authentication state and actions hook
 *
 * @returns {Object} Authentication state and methods
 * @property {boolean} isAuthenticated - Whether user is currently authenticated
 * @property {boolean} isLoading - Whether authentication check is in progress
 * @property {Object|null} user - User information if authenticated
 * @property {string|null} error - Last authentication error message
 * @property {Function} login - Login function (username, password) => Promise<boolean>
 * @property {Function} logout - Logout function () => Promise<void>
 * @property {Function} checkAuth - Manually check authentication status () => Promise<void>
 */
export function useAuth() {
  // Subscribe to shared auth state
  const state = useSyncExternalStore(subscribe, getSnapshot);
  const { isAuthenticated, isLoading, user, error } = state;

  /**
   * Store JWT token in localStorage
   *
   * @param {string} token - JWT token to store
   */
  const storeToken = useCallback((token: any) => {
    try {
      localStorage.setItem('auth_token', token);
    } catch (error: any) {
      console.error('Failed to store auth token:', error);
    }
  }, []);

  /**
   * Retrieve JWT token from localStorage
   *
   * @returns {string|null} Stored JWT token or null
   */
  const getToken = useCallback(() => {
    try {
      return localStorage.getItem('auth_token');
    } catch (error: any) {
      console.error('Failed to retrieve auth token:', error);
      return null;
    }
  }, []);

  /**
   * Remove JWT token from localStorage
   */
  const removeToken = useCallback(() => {
    try {
      localStorage.removeItem('auth_token');
    } catch (error: any) {
      console.error('Failed to remove auth token:', error);
    }
  }, []);

  /**
   * Check authentication status with server
   *
   * Verifies stored token with /auth/status endpoint
   */
  const checkAuth = useCallback(async () => {
    // Observatory demo: there is no auth ceremony for an exhibit. The gate
    // short-circuits on a missing localStorage token BEFORE calling
    // /auth/status, so serving an authenticated fixture from the demo router
    // is not enough — a fresh visitor has no token and would hit the login
    // wall. Bypass the gate itself.
    if (DEMO_MODE) {
      setAuthState({
        isAuthenticated: true,
        user: { username: 'observer', role: 'demo' },
        error: null,
        isLoading: false,
      });
      return;
    }
    const token = getToken();
    if (!token) {
      setAuthState({ isAuthenticated: false, user: null, isLoading: false });
      return;
    }

    try {
      const response = await api.get('/auth/status');
      if (response.authenticated) {
        setAuthState({ isAuthenticated: true, user: response.user, error: null, isLoading: false });
      } else {
        // Token invalid, remove it
        removeToken();
        setAuthState({ isAuthenticated: false, user: null, isLoading: false });
      }
    } catch (err: any) {
      console.error('Auth check failed:', err);
      // Fail closed on auth verification errors
      setAuthState({ isAuthenticated: false, user: null, error: 'Unable to verify authentication status', isLoading: false });
    }
  }, [getToken, removeToken]);

  /**
   * Login with username and password
   *
   * @param {string} username - Username for authentication
   * @param {string} password - Password for authentication
   * @returns {Promise<boolean>} True if login successful
   */
  const login = useCallback(async (username: any, password: any) => {
    setAuthState({ error: null, isLoading: true });

    try {
      const response = await api.post('/auth/login', { username, password });

      if (response.token) {
        storeToken(response.token);
        setAuthState({ isAuthenticated: true, user: response.user, isLoading: false });
        return true;
      } else {
        setAuthState({ error: response.message || 'Login failed', isLoading: false });
        return false;
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed';
      setAuthState({ error: errorMessage, isLoading: false });
      return false;
    }
  }, [storeToken]);

  /**
   * Logout current user
   */
  const logout = useCallback(async () => {
    setAuthState({ isLoading: true });

    try {
      // Call logout endpoint (though stateless, good for audit trail)
      await api.post('/auth/logout');
    } catch (err: any) {
      console.error('Logout API call failed:', err);
      // Continue with local logout even if API call fails
    }

    // Clear local state regardless of API response
    removeToken();
    setAuthState({ isAuthenticated: false, user: null, error: null, isLoading: false });
  }, [removeToken]);

  // Check authentication on mount - only runs once globally due to singleton
  useEffect(() => {
    // Only check if we haven't already (singleton pattern)
    if (authState.isLoading) {
      checkAuth();
    }
  }, [checkAuth]);

  return {
    isAuthenticated,
    isLoading,
    user,
    error,
    login,
    logout,
    checkAuth
  };
}



