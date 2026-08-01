/**
 * Model Selection Slice
 *
 * @module store/slices/model
 * @description Model selection, max tokens, profile picture, cycle stats, pricing.
 * Split from settings.ts during Phase 3 decomposition.
 *
 * @upstream Called by: store/index.ts
 * @downstream Calls: api/client.ts
 */

import type { StateCreator } from "zustand";
import type { AppState } from "../types";
import api from "../../api/client";

/** Profile picture data from /profile-picture endpoint */
export interface ProfilePictureData {
  base64: string;
  prompt?: string;
  updatedAt?: string;
  hasProfilePicture?: boolean;
}

export interface ModelSlice {
  selectedModel: string;
  cycleStats: unknown;
  cycleStatsLimit: number;
  profilePicture: ProfilePictureData | null;
  showProfilePic: boolean;
  maxTokens: number;
  maxTokensInput: string;
  setCycleStats: (stats: unknown) => void;
  setCycleStatsLimit: (limit: number) => void;
  setProfilePicture: (pic: ProfilePictureData | null) => void;
  setShowProfilePic: (show: boolean) => void;
  setMaxTokens: (tokens: number) => void;
  setMaxTokensInput: (val: string) => void;
  setSelectedModel: (model: string) => Promise<void>;
  updateMaxTokens: () => Promise<void>;
  fetchCycleStats: (limit?: number) => Promise<void>;
  fetchMaxTokens: () => Promise<void>;
  fetchProfilePicture: () => Promise<void>;
  resetAll: (password: string) => Promise<void>;
}

export const createModelSlice: StateCreator<AppState, [], [], ModelSlice> = (
  set,
  get,
) => ({
  selectedModel: "claude-sonnet-4-6-20250514",
  cycleStats: null as unknown,
  cycleStatsLimit: 50,
  profilePicture: null as ProfilePictureData | null,
  showProfilePic: false,
  maxTokens: 4000,
  maxTokensInput: "4000",

  setCycleStats: (stats: unknown) => set({ cycleStats: stats }),
  setCycleStatsLimit: (limit: number) => set({ cycleStatsLimit: limit }),
  setProfilePicture: (pic: ProfilePictureData | null) =>
    set({ profilePicture: pic }),
  setShowProfilePic: (show: boolean) => set({ showProfilePic: show }),
  setMaxTokens: (tokens: number) => set({ maxTokens: tokens }),
  setMaxTokensInput: (val: string) => set({ maxTokensInput: val }),

  setSelectedModel: async (model: string) => {
    const { addLog } = get();
    set({ selectedModel: model });
    try {
      await api.post("/model", { model });
      addLog(
        `🤖 Model set to ${model.includes("opus") ? "Opus" : model.includes("haiku") ? "Haiku" : "Sonnet"}`,
      );
    } catch (err: unknown) {
      addLog(
        `❌ Failed to set model: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  updateMaxTokens: async () => {
    const { addLog, maxTokensInput, setMaxTokens } = get();
    const tokens = parseInt(maxTokensInput, 10);
    if (isNaN(tokens) || tokens < 100 || tokens > 128000) {
      addLog("❌ Max tokens must be 100-128000");
      return;
    }
    try {
      await api.post("/max-tokens", { maxTokens: tokens });
      setMaxTokens(tokens);
      addLog(`📊 Max tokens set to ${tokens}`);
    } catch (err: unknown) {
      addLog(
        `❌ Max tokens update failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  fetchCycleStats: async (limit?: number) => {
    const { cycleStatsLimit, setCycleStats } = get();
    try {
      const d = await api.get(`/cycles?limit=${limit ?? cycleStatsLimit}`);
      setCycleStats(d);
    } catch (err: unknown) {
      console.error(
        "Failed to fetch cycle stats:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  fetchMaxTokens: async () => {
    const { setMaxTokens, setMaxTokensInput } = get();
    try {
      const d = await api.get("/max-tokens");
      const t = ((d as Record<string, unknown>).maxTokens as number) ?? 4000;
      setMaxTokens(t);
      setMaxTokensInput(String(t));
    } catch (err: unknown) {
      console.error(
        "Failed to fetch max tokens:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  fetchProfilePicture: async () => {
    const { setProfilePicture } = get();
    try {
      const d = (await api.get("/profile-picture")) as Record<string, unknown>;
      if (d.hasProfilePicture) {
        setProfilePicture(d as unknown as ProfilePictureData);
      } else {
        setProfilePicture(null);
      }
    } catch (err: unknown) {
      console.error(
        "Failed to fetch profile picture:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  resetAll: async (password: string) => {
    const { addLog, fetchAll } = get();
    if (!password) {
      addLog("❌ Password required for reset");
      return;
    }
    try {
      await api.post("/reset", { password });
      addLog("🔄 Reset complete");
      await fetchAll();
    } catch (err: unknown) {
      addLog(
        `❌ Reset failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },
});
