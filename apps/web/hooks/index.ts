/**
 * Custom Hooks Barrel File
 *
 * @module hooks
 * @description Centralized exports for all custom React hooks.
 *
 * Import from here for convenience:
 *   import { useFormInput, useApi, usePolling } from './hooks';
 *
 * Or import from specific modules for clarity:
 *   import { useFormInput } from './hooks/useFormInput';
 *
 * @upstream Called by:
 *   - All React components using custom hooks
 * @downstream Calls:
 *   - Individual hook modules
 */

// =============================================================================
// FORM HOOKS
// =============================================================================
// Hooks for managing form input state efficiently.
// Replace repetitive useState + onChange patterns with cleaner APIs.
//
// @see useFormInput - Single input with value, onChange, reset
// @see useFormInputs - Multiple inputs in one hook
// =============================================================================
export { useFormInput, useFormInputs } from './useFormInput';

// =============================================================================
// API HOOKS
// =============================================================================
// Hooks for making API requests with loading/error state tracking.
// Use when you need UI feedback for specific operations.
//
// @see useApi - Generic request wrapper with execute()
// @see useApiMutation - Specialized for POST/PUT/DELETE with callbacks
// =============================================================================
export { useApi, useApiMutation } from './useApi';

// =============================================================================
// POLLING HOOKS
// =============================================================================
// Hooks for periodic data fetching with smart features.
// Handles visibility changes, cleanup, and manual control.
//
// @see usePolling - Fixed interval polling with pause/resume
// @see useSmartPolling - Cycle-aware polling (adapts to backend cycle interval)
// @see useInterval - Simple interval with cleanup
// =============================================================================
export { usePolling, useInterval } from './usePolling';
export { useSmartPolling } from './useSmartPolling';

// =============================================================================
// SUMMARY CONFIG HOOKS
// =============================================================================
// Hooks for working with summary tier configuration and caching API responses.
// =============================================================================
export { useSummaryConfig } from './useSummaryConfig';

// useLoopState deleted in Phase 3 — replaced by store slices + AppShell.
