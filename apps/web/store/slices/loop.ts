/**
 * Loop Control Slice
 *
 * @module store/slices/loop
 * @description Start/stop/think-now, cycle interval, batch mode,
 * sleep/wake, and public-safe loop toggles.
 *
 * Split from settings.ts during Phase 3 decomposition.
 *
 * @upstream Called by: store/index.ts
 * @downstream Calls: api/client.ts
 */

import type { StateCreator } from "zustand";
import type { AppState } from "../types";
import api from "../../api/client";

export interface SleepStatus {
  sleeping: boolean;
  sleepUntil: string | null;
}

export interface LoopSlice {
  cycleIntervalInput: string;
  batchEnabled: boolean;
  batchMinutes: number;
  batchHistory: unknown[];
  streamingEnabled: boolean;
  sleepStatus: SleepStatus;
  userStatus: string | null;
  userStatusInput: string;
  setCycleIntervalInput: (val: string) => void;
  setBatchEnabled: (enabled: boolean) => void;
  setBatchMinutes: (mins: number) => void;
  setBatchHistory: (history: unknown[]) => void;
  setStreamingEnabled: (enabled: boolean) => void;
  setSleepStatus: (status: SleepStatus) => void;
  setUserStatus: (status: string | null) => void;
  setUserStatusInput: (val: string) => void;
  startLoop: () => Promise<void>;
  stopLoop: () => Promise<void>;
  triggerThinkNow: () => Promise<void>;
}

export const createLoopSlice: StateCreator<AppState, [], [], LoopSlice> = (
  set,
  get,
) => ({
  cycleIntervalInput: "60",
  batchEnabled: false,
  batchMinutes: 60,
  batchHistory: [],
  streamingEnabled: false,
  sleepStatus: { sleeping: false, sleepUntil: null },
  userStatus: null,
  userStatusInput: "",

  // Setters
  setCycleIntervalInput: (val: string) => set({ cycleIntervalInput: val }),
  setBatchEnabled: (enabled: boolean) => set({ batchEnabled: enabled }),
  setBatchMinutes: (mins: number) => set({ batchMinutes: mins }),
  setBatchHistory: (history: unknown[]) => set({ batchHistory: history }),
  setStreamingEnabled: (enabled: boolean) => set({ streamingEnabled: enabled }),
  setSleepStatus: (status: SleepStatus) => set({ sleepStatus: status }),
  setUserStatus: (status: string | null) => set({ userStatus: status }),
  setUserStatusInput: (val: string) => set({ userStatusInput: val }),

  // Actions
  startLoop: async () => {
    const { addLog, fetchState } = get();
    try {
      await api.post("/start");
      addLog("▶️ Loop started");
      await fetchState();
    } catch (err: unknown) {
      addLog(
        `❌ Start failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  stopLoop: async () => {
    const { addLog, fetchState } = get();
    try {
      await api.post("/stop");
      addLog("⏸️ Loop stopped");
      await fetchState();
    } catch (err: unknown) {
      addLog(
        `❌ Stop failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  triggerThinkNow: async () => {
    const { addLog, setIsThinking, fetchHistory } = get();
    setIsThinking(true);
    addLog("🧠 Triggering think cycle...");
    try {
      const data = await api.post("/think-now");
      if ((data as Record<string, unknown>).queued) {
        addLog(
          `⏳ ${((data as Record<string, unknown>).message as string) || "Cycle queued for next cron tick (~1 min)"}`,
        );
      } else {
        addLog("✅ Think cycle complete");
      }
      if ((data as Record<string, unknown>).decision)
        set({
          lastDecision: (data as Record<string, unknown>)
            .decision as import("./ui").DecisionEntry,
        });
      await fetchHistory();
    } catch (err: unknown) {
      addLog(
        `❌ Think failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsThinking(false);
    }
  },

  // Toggle/test/update actions live in loopActions.ts (split for 100-line limit)
  // Fetch actions live in loopFetch.ts (split for 100-line limit)
});
