/**
 * @module hooks/useToolRegistry
 * @description Shared React hook for fetching and caching the canonical tool
 * registry via the Zustand store (powered by `/tool-registry` endpoint).
 *
 * @upstream Called by:
 *   - VoiceTab RealtimeSessionPanel
 *   - SettingsTab ToolRegistryPanel (and future help components)
 * @downstream Calls:
 *   - Zustand store selectors (toolRegistry state/actions)
 */

import { useEffect, useMemo } from 'react';
import { useAppStore } from '../store';

/**
 * @description Consume the tool registry snapshot, auto-fetching if needed.
 *
 * @param {Object} [options] - Hook options
 * @param {number|null} [options.limit=null] - Optional slice length
 * @param {boolean} [options.autoFetch=true] - Whether to fetch on mount
 * @returns {Object} tools array, loading/error flags, and refresh handler
 */
export function useToolRegistry(options: any = {}) {
  const { limit = null, autoFetch = true } = options;

  // Select each value individually to avoid creating new objects on every render
  // (object selectors cause infinite loops without shallow comparison)
  const toolRegistry = useAppStore((state) => state.toolRegistry);
  const toolRegistryLoading = useAppStore((state) => state.toolRegistryLoading);
  const toolRegistryError = useAppStore((state) => state.toolRegistryError);
  const fetchToolRegistry = useAppStore((state) => state.fetchToolRegistry);

  useEffect(() => {
    // Only fetch if we haven't fetched yet (null). Empty array = fetched but no tools.
    if (autoFetch && toolRegistry === null) {
      fetchToolRegistry();
    }
  }, [autoFetch, toolRegistry, fetchToolRegistry]);

  const tools = useMemo(() => {
    if (!Array.isArray(toolRegistry)) return [];
    if (typeof limit === 'number') {
      return toolRegistry.slice(0, Math.max(0, limit));
    }
    return toolRegistry;
  }, [toolRegistry, limit]);

  return {
    tools,
    loading: !!toolRegistryLoading,
    error: toolRegistryError,
    refresh: fetchToolRegistry
  };
}
