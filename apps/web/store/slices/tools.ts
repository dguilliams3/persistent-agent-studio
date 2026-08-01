/**
 * Tool Registry Slice
 *
 * @module store/slices/tools
 * @description Tool registry fetch and state. Split from voice.ts
 * (tool registry doesn't belong in voice) during Phase 3 decomposition.
 *
 * @upstream Called by: store/index.ts
 * @downstream Calls: api/client.ts
 */

import type { StateCreator } from "zustand";
import type { AppState } from "../types";
import api from "../../api/client";

export interface ToolsSlice {
  toolRegistry: unknown[] | null;
  toolRegistryLoading: boolean;
  toolRegistryError: string | null;
  fetchToolRegistry: () => Promise<unknown[] | null>;
}

export const createToolsSlice: StateCreator<AppState, [], [], ToolsSlice> = (
  set,
  get,
) => ({
  toolRegistry: null as unknown[] | null,
  toolRegistryLoading: false,
  toolRegistryError: null as string | null,

  fetchToolRegistry: async () => {
    const { toolRegistryLoading } = get();
    if (toolRegistryLoading) return null;
    set({ toolRegistryLoading: true, toolRegistryError: null });
    try {
      const result = await api.get("/tool-registry");
      const tools = Array.isArray(result?.tools)
        ? (result.tools as unknown[])
        : [];
      set({
        toolRegistry: tools,
        toolRegistryLoading: false,
        toolRegistryError: null,
      });
      return tools;
    } catch (err: unknown) {
      const apiErr = err as { data?: { error?: string }; message?: string };
      const message =
        apiErr?.data?.error || apiErr.message || "Failed to load tool registry";
      console.error(message);
      set({ toolRegistryLoading: false, toolRegistryError: message });
      return null;
    }
  },
});
