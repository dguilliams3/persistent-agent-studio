/**
 * RAG Config Slice
 *
 * @module store/slices/rag
 * @description RAG configuration: enabled, topK, halflife, similarity,
 * MMR lambda, weights. Split from settings.ts during Phase 3 decomposition.
 *
 * @upstream Called by: store/index.ts
 * @downstream Calls: api/client.ts
 */

import type { StateCreator } from "zustand";
import type { AppState } from "../types";
import api from "../../api/client";

export interface RagWeights {
  similarity: number;
  recency: number;
  importance: number;
}

export interface RagSlice {
  ragConfig: unknown;
  ragEnabled: boolean;
  ragTopK: number;
  ragHalflife: number;
  ragMinSimilarity: number;
  ragMmrLambda: number;
  ragWeights: RagWeights;
  isSavingRag: boolean;
  setRagConfig: (config: unknown) => void;
  setRagEnabled: (enabled: boolean) => void;
  setRagTopK: (k: number) => void;
  setRagHalflife: (halflife: number) => void;
  setRagMinSimilarity: (sim: number) => void;
  setRagMmrLambda: (lambda: number) => void;
  setRagWeights: (
    weightsOrFn: RagWeights | ((weights: RagWeights) => RagWeights),
  ) => void;
  setIsSavingRag: (saving: boolean) => void;
  fetchRagConfig: () => Promise<void>;
  updateRagConfig: (updates?: Record<string, unknown>) => Promise<void>;
  resetRagConfig: () => Promise<void>;
}

export const createRagSlice: StateCreator<AppState, [], [], RagSlice> = (
  set,
  get,
) => ({
  ragConfig: null,
  ragEnabled: true,
  ragTopK: 10,
  ragHalflife: 7,
  ragMinSimilarity: 0.3,
  ragMmrLambda: 0.5,
  ragWeights: { similarity: 0.5, recency: 0.3, importance: 0.2 },
  isSavingRag: false,

  setRagConfig: (config: unknown) => set({ ragConfig: config }),
  setRagEnabled: (enabled: boolean) => set({ ragEnabled: enabled }),
  setRagTopK: (k: number) => set({ ragTopK: k }),
  setRagHalflife: (halflife: number) => set({ ragHalflife: halflife }),
  setRagMinSimilarity: (sim: number) => set({ ragMinSimilarity: sim }),
  setRagMmrLambda: (lambda: number) => set({ ragMmrLambda: lambda }),
  setRagWeights: (
    weightsOrFn: RagWeights | ((weights: RagWeights) => RagWeights),
  ) =>
    set((state) => ({
      ragWeights:
        typeof weightsOrFn === "function"
          ? weightsOrFn(state.ragWeights)
          : weightsOrFn,
    })),
  setIsSavingRag: (saving: boolean) => set({ isSavingRag: saving }),

  fetchRagConfig: async () => {
    const g = get();
    try {
      const d = await api.get("/rag");
      g.setRagConfig(d);
      if (d) {
        g.setRagEnabled(
          ((d as Record<string, unknown>).enabled as boolean) ?? true,
        );
        g.setRagTopK(((d as Record<string, unknown>).topK as number) ?? 10);
        g.setRagHalflife(
          ((d as Record<string, unknown>).recencyHalflifeDays as number) ?? 7,
        );
        g.setRagMinSimilarity(
          ((d as Record<string, unknown>).minSimilarity as number) ?? 0.3,
        );
        g.setRagMmrLambda(
          ((d as Record<string, unknown>).mmrLambda as number) ?? 0.5,
        );
        g.setRagWeights(
          ((d as Record<string, unknown>).weights as RagWeights) || {
            similarity: 0.5,
            recency: 0.3,
            importance: 0.2,
          },
        );
      }
    } catch (err: unknown) {
      console.error(
        "Failed to fetch RAG config:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  updateRagConfig: async (updates?: Record<string, unknown>) => {
    const g = get();
    const config = updates || {
      enabled: g.ragEnabled,
      topK: g.ragTopK,
      recencyHalflifeDays: g.ragHalflife,
      minSimilarity: g.ragMinSimilarity,
      mmrLambda: g.ragMmrLambda,
      weights: g.ragWeights,
    };
    g.setIsSavingRag(true);
    try {
      await api.post("/rag", config);
      g.addLog("✅ RAG config updated");
      await g.fetchRagConfig();
    } catch (err: unknown) {
      g.addLog(
        `❌ RAG config update failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      g.setIsSavingRag(false);
    }
  },

  resetRagConfig: async () => {
    const { addLog, fetchRagConfig } = get();
    try {
      await api.post("/rag", { reset: true });
      addLog("🔄 RAG config reset to defaults");
      await fetchRagConfig();
    } catch (err: unknown) {
      addLog(
        `❌ RAG reset failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },
});
