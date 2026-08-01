/**
 * Summarization Config Slice
 *
 * @module store/slices/summarization
 * @description Summarize settings, thresholds, token limits, summarization
 * model provider/model selection, cost stats, and meta-summarization config.
 * Split from settings.ts during Phase 3 decomposition.
 *
 * @upstream Called by: store/index.ts
 * @downstream Calls: api/client.ts
 */

import type { StateCreator } from "zustand";
import type { AppState } from "../types";
import api from "../../api/client";

export interface ProviderStatus {
  label: string;
  envKeyName: string;
  available: boolean;
  reason?: string;
}

export interface SummarizationSlice {
  isSummarizing: boolean;
  lastSummarizeTime: number;
  summarizeSuccess: boolean;
  summarizeThresholdInput: string;
  summaryMaxTokensInput: string;
  metaSummaryMaxTokensInput: string;
  metaReasoningEffort: string;
  reasoningEffortOptions: string[];
  summarizeDefaultCountInput: string;
  sumProvider: string;
  sumModel: string;
  sumAvailableModels: Record<string, Record<string, string>> | null;
  sumProviderStatus: Record<string, ProviderStatus> | null;
  sumModelSaving: boolean;
  sumCostStats: Record<string, unknown> | null;
  summarizationStats: Record<string, unknown> | null;
  metaProvider: string;
  metaModel: string;
  metaModelInherited: boolean;
  metaAvailableModels: null;
  metaModelSaving: boolean;

  setIsSummarizing: (v: boolean) => void;
  setLastSummarizeTime: (v: number) => void;
  setSummarizeSuccess: (v: boolean) => void;
  setSummarizeThresholdInput: (v: string) => void;
  setSummaryMaxTokensInput: (v: string) => void;
  setMetaSummaryMaxTokensInput: (v: string) => void;
  setMetaReasoningEffort: (v: string) => void;
  setSummarizeDefaultCountInput: (v: string) => void;
  setSumProvider: (v: string) => void;
  setSumModel: (v: string) => void;
  setSumAvailableModels: (v: unknown) => void;
  setSumProviderStatus: (v: unknown) => void;
  setSumModelSaving: (v: boolean) => void;
  setSumCostStats: (v: unknown) => void;
  setSummarizationStats: (v: unknown) => void;

  fetchSummarizeSettings: () => Promise<void>;
  fetchSumModel: () => Promise<void>;
}

export const createSummarizationSlice: StateCreator<
  AppState,
  [],
  [],
  SummarizationSlice
> = (set, _get) => ({
  isSummarizing: false,
  lastSummarizeTime: 0,
  summarizeSuccess: false,
  summarizeThresholdInput: "50",
  summaryMaxTokensInput: "4000",
  metaSummaryMaxTokensInput: "4000",
  metaReasoningEffort: "low",
  reasoningEffortOptions: ["none", "low", "medium", "high"],
  summarizeDefaultCountInput: "50",
  sumProvider: "openai",
  sumModel: "gpt-4.1-mini",
  sumAvailableModels: null as Record<string, Record<string, string>> | null,
  sumProviderStatus: null as Record<string, ProviderStatus> | null,
  sumModelSaving: false,
  sumCostStats: null as Record<string, unknown> | null,
  summarizationStats: null as Record<string, unknown> | null,
  metaProvider: "openai",
  metaModel: "gpt-4.1-mini",
  metaModelInherited: true,
  metaAvailableModels: null,
  metaModelSaving: false,

  setIsSummarizing: (v: boolean) => set({ isSummarizing: v }),
  setLastSummarizeTime: (v: number) => set({ lastSummarizeTime: v }),
  setSummarizeSuccess: (v: boolean) => set({ summarizeSuccess: v }),
  setSummarizeThresholdInput: (v: string) =>
    set({ summarizeThresholdInput: v }),
  setSummaryMaxTokensInput: (v: string) => set({ summaryMaxTokensInput: v }),
  setMetaSummaryMaxTokensInput: (v: string) =>
    set({ metaSummaryMaxTokensInput: v }),
  setMetaReasoningEffort: (v: string) => set({ metaReasoningEffort: v }),
  setSummarizeDefaultCountInput: (v: string) =>
    set({ summarizeDefaultCountInput: v }),
  setSumProvider: (v: string) => set({ sumProvider: v }),
  setSumModel: (v: string) => set({ sumModel: v }),
  setSumAvailableModels: (v: unknown) =>
    set({
      sumAvailableModels: (v as Record<string, Record<string, string>>) || null,
    }),
  setSumProviderStatus: (v: unknown) =>
    set({
      sumProviderStatus: (v as Record<string, ProviderStatus>) || null,
    }),
  setSumModelSaving: (v: boolean) => set({ sumModelSaving: v }),
  setSumCostStats: (v: unknown) =>
    set({ sumCostStats: (v as Record<string, unknown>) || null }),
  setSummarizationStats: (v: unknown) =>
    set({ summarizationStats: (v as Record<string, unknown>) || null }),

  fetchSummarizeSettings: async () => {
    try {
      const d = await api.get("/summarize-settings");
      set({
        summarizeThresholdInput: String(d.summarizeThreshold || 30),
        summaryMaxTokensInput: String(d.summaryMaxTokens || 4000),
        metaSummaryMaxTokensInput: String(d.metaSummaryMaxTokens || 4000),
        metaReasoningEffort: (d.metaReasoningEffort as string) || "low",
        reasoningEffortOptions: (d.reasoningEffortOptions as string[]) || [
          "none",
          "low",
          "medium",
          "high",
        ],
        summarizeDefaultCountInput: String(d.summarizeDefaultCount || 50),
      });
    } catch (err: unknown) {
      console.error(
        "Failed to fetch summarize settings:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  // Async update/fetch actions live in summarizationActions.ts (split for 100-line limit)

  fetchSumModel: async () => {
    try {
      const data = await api.get("/sum-model");
      set({
        sumProvider: (data.provider as string) || "openai",
        sumModel: (data.model as string) || "gpt-4.1-mini",
        sumAvailableModels:
          (data.availableModels as Record<string, Record<string, string>>) ||
          null,
        sumProviderStatus:
          (data.providerStatus as Record<string, ProviderStatus>) || null,
      });
    } catch (err: unknown) {
      console.error(
        "Failed to fetch sum-model:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },
});
