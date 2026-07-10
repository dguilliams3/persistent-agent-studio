/**
 * Loop Actions Slice
 *
 * @module store/slices/loopActions
 * @description Toggle actions for batch, streaming, and public-safe settings
 * cycle interval updates, user status, and wake-up.
 *
 * Split from loop.ts to keep each slice under the 100-line limit.
 *
 * @upstream Called by: store/index.ts
 * @downstream Calls: api/client.ts
 */

import type { StateCreator } from "zustand";
import type { AppState } from "../types";
import api from "../../api/client";

export interface LoopActionsSlice {
  toggleBatch: (enabled: boolean) => Promise<void>;
  toggleBatchWithTimer: (enabled: boolean) => Promise<void>;
  toggleStreaming: (enabled: boolean) => Promise<void>;
  updateCycleInterval: () => Promise<void>;
  updateUserStatus: (newStatus?: string | null) => Promise<void>;
  wakeUp: () => Promise<void>;
}

export const createLoopActionsSlice: StateCreator<
  AppState,
  [],
  [],
  LoopActionsSlice
> = (_set, get) => ({
  toggleBatch: async (enabled: boolean) => {
    const { addLog, setBatchEnabled } = get();
    try {
      await api.post("/batch-enabled", { enabled });
      setBatchEnabled(enabled);
      addLog(`Batch mode ${enabled ? "enabled" : "disabled"}`);
    } catch (err: unknown) {
      addLog(
        `Batch toggle failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  toggleBatchWithTimer: async (enabled: boolean) => {
    const { addLog, setBatchEnabled, batchMinutes } = get();
    try {
      await api.post("/batch-enabled", { enabled, minutes: batchMinutes });
      setBatchEnabled(enabled);
      addLog(
        `Batch mode ${enabled ? `enabled (${batchMinutes}m)` : "disabled"}`,
      );
    } catch (err: unknown) {
      addLog(
        `Batch toggle failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  toggleStreaming: async (enabled: boolean) => {
    const { addLog, setStreamingEnabled } = get();
    try {
      await api.post("/streaming", { enabled });
      setStreamingEnabled(enabled);
      addLog(`Streaming ${enabled ? "enabled" : "disabled"}`);
    } catch (err: unknown) {
      addLog(
        `Streaming toggle failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  updateCycleInterval: async () => {
    const { addLog, cycleIntervalInput, fetchState } = get();
    const seconds = parseInt(cycleIntervalInput, 10);
    if (isNaN(seconds) || seconds < 30) {
      addLog("Interval must be at least 30 seconds");
      return;
    }
    try {
      await api.post("/interval", { seconds });
      addLog(`Cycle interval set to ${seconds}s`);
      await fetchState();
    } catch (err: unknown) {
      addLog(
        `Interval update failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  updateUserStatus: async (newStatus?: string | null) => {
    const { addLog, userStatusInput, setUserStatus, setUserStatusInput } = get();
    const status = newStatus ?? userStatusInput;
    try {
      await api.post("/user-status", { status });
      setUserStatus(status);
      setUserStatusInput("");
      addLog(`User status updated: ${status || "(cleared)"}`);
    } catch (err: unknown) {
      addLog(
        `Status update failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  wakeUp: async () => {
    const { addLog, fetchState } = get();
    try {
      await api.delete("/sleep-status");
      addLog("Woke up from sleep");
      await fetchState();
    } catch (err: unknown) {
      addLog(
        `Wake up failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },
});
