/**
 * Loop Fetch Slice
 *
 * @module store/slices/loopFetch
 * @description Read-only fetch actions for loop state: batch,
 * streaming, sleep, and user status polling.
 *
 * Split from loop.ts to keep each slice under the 100-line limit.
 *
 * @upstream Called by: store/index.ts
 * @downstream Calls: api/client.ts
 */

import type { StateCreator } from "zustand";
import type { AppState } from "../types";
import api from "../../api/client";

export interface LoopFetchSlice {
  fetchBatchEnabled: () => Promise<void>;
  fetchStreaming: () => Promise<void>;
  fetchSleepStatus: () => Promise<void>;
  fetchUserStatus: () => Promise<void>;
}

export const createLoopFetchSlice: StateCreator<
  AppState,
  [],
  [],
  LoopFetchSlice
> = (_set, get) => ({
  fetchBatchEnabled: async () => {
    const { setBatchEnabled } = get();
    try {
      const data = await api.get("/batch-enabled");
      setBatchEnabled(
        ((data as Record<string, unknown>).enabled as boolean) ?? false,
      );
    } catch (err: unknown) {
      console.error(
        "Failed to fetch batch status:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  fetchStreaming: async () => {
    const { setStreamingEnabled } = get();
    try {
      const data = await api.get("/streaming");
      setStreamingEnabled(
        ((data as Record<string, unknown>).enabled as boolean) ?? false,
      );
    } catch (err: unknown) {
      console.error(
        "Failed to fetch streaming status:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  fetchSleepStatus: async () => {
    const { setSleepStatus } = get();
    try {
      const data = await api.get("/sleep-status");
      setSleepStatus(
        (data as { sleeping: boolean; sleepUntil: string | null }) || {
          sleeping: false,
          sleepUntil: null,
        },
      );
    } catch (err: unknown) {
      console.error(
        "Failed to fetch sleep status:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  fetchUserStatus: async () => {
    const { setUserStatus } = get();
    try {
      const data = await api.get("/user-status");
      setUserStatus((data.status as string) || null);
    } catch (err: unknown) {
      console.error(
        "Failed to fetch user status:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },
});
