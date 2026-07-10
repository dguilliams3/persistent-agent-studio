/**
 * Summarization Actions Slice
 *
 * @module store/slices/summarizationActions
 * @description Async actions for summarization: update settings, thresholds,
 * max tokens, model selection, cost stats, and summarization stats.
 *
 * Split from summarization.ts to keep each slice under the 100-line limit.
 *
 * @upstream Called by: store/index.ts
 * @downstream Calls: api/client.ts
 */

import type { StateCreator } from "zustand";
import type { AppState } from "../types";
import api from "../../api/client";

export interface SummarizationActionsSlice {
  updateSummarizeSettings: (
    thresholdValue?: string,
    autoSummarize?: boolean,
  ) => Promise<void>;
  updateSummaryMaxTokens: () => Promise<void>;
  updateMetaSummaryMaxTokens: () => Promise<void>;
  updateMetaReasoningEffort: (effort: string) => Promise<void>;
  updateSummarizeDefaultCount: () => Promise<void>;
  updateSumModel: (provider: string, model: string) => Promise<boolean>;
  fetchSumCostStats: () => Promise<void>;
  fetchSummarizationStats: () => Promise<void>;
}

export const createSummarizationActionsSlice: StateCreator<
  AppState,
  [],
  [],
  SummarizationActionsSlice
> = (set, get) => ({
  updateSummarizeSettings: async (
    thresholdValue?: string,
    autoSummarize?: boolean,
  ) => {
    const { addLog, summarizeThresholdInput, fetchState } = get();
    const threshold = parseInt(thresholdValue ?? summarizeThresholdInput, 10);
    if (isNaN(threshold) || threshold < 10) {
      addLog("Threshold must be at least 10");
      return;
    }
    try {
      const payload: Record<string, unknown> = { threshold };
      if (autoSummarize !== undefined) payload.autoSummarize = autoSummarize;
      await api.post("/summarize-settings", payload);
      addLog(`Summarize settings updated: threshold=${threshold}`);
      await fetchState();
    } catch (err: unknown) {
      addLog(
        `Summarize settings update failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  updateSummaryMaxTokens: async () => {
    const { addLog, summaryMaxTokensInput } = get();
    const tokens = parseInt(summaryMaxTokensInput, 10);
    if (isNaN(tokens) || tokens < 500 || tokens > 7500) {
      addLog("Max tokens must be between 500 and 7500");
      return;
    }
    try {
      const data = await api.post("/summarize-settings", {
        summaryMaxTokens: tokens,
      });
      set({ summaryMaxTokensInput: String(data.summaryMaxTokens) });
      addLog(`Summary max tokens set to ${tokens}`);
    } catch (err: unknown) {
      addLog(
        `Max tokens update failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  updateMetaSummaryMaxTokens: async () => {
    const { addLog, metaSummaryMaxTokensInput } = get();
    const tokens = parseInt(metaSummaryMaxTokensInput, 10);
    if (isNaN(tokens) || tokens < 500 || tokens > 7500) {
      addLog("Meta max tokens must be between 500 and 7500");
      return;
    }
    try {
      const data = await api.post("/summarize-settings", {
        metaSummaryMaxTokens: tokens,
      });
      set({ metaSummaryMaxTokensInput: String(data.metaSummaryMaxTokens) });
      addLog(`Meta-summary max tokens set to ${tokens}`);
    } catch (err: unknown) {
      addLog(
        `Meta max tokens update failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  updateMetaReasoningEffort: async (effort: string) => {
    const { addLog } = get();
    if (!["none", "low", "medium", "high"].includes(effort)) {
      addLog("Invalid reasoning effort level");
      return;
    }
    try {
      const data = await api.post("/summarize-settings", {
        metaReasoningEffort: effort,
      });
      set({
        metaReasoningEffort: (data.metaReasoningEffort as string) || effort,
      });
      addLog(`Meta reasoning effort set to ${effort}`);
    } catch (err: unknown) {
      addLog(
        `Reasoning effort update failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  updateSummarizeDefaultCount: async () => {
    const { addLog, summarizeDefaultCountInput } = get();
    const count = parseInt(summarizeDefaultCountInput, 10);
    if (isNaN(count) || count < 10 || count > 100) {
      addLog("Default count must be between 10 and 100");
      return;
    }
    try {
      const data = await api.post("/summarize-settings", {
        summarizeDefaultCount: count,
      });
      set({ summarizeDefaultCountInput: String(data.summarizeDefaultCount) });
      addLog(`Default summarize count set to ${count} entries`);
    } catch (err: unknown) {
      addLog(
        `Default count update failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  updateSumModel: async (provider: string, model: string) => {
    const { addLog, setSumModelSaving } = get();
    setSumModelSaving(true);
    try {
      const data = await api.post("/sum-model", { provider, model });
      if (data.success) {
        set({
          sumProvider: data.provider as string,
          sumModel: data.model as string,
          sumAvailableModels:
            (data.availableModels as Record<string, Record<string, string>>) ||
            null,
          sumProviderStatus:
            (data.providerStatus as Record<
              string,
              { label: string; envKeyName: string; available: boolean; reason?: string }
            >) || null,
        });
        addLog(`Summarization model set to ${data.provider}/${data.model}`);
        return true;
      }
      addLog(`Failed to update sum model: ${data.error}`);
      return false;
    } catch (err: unknown) {
      addLog(
        `Failed to update sum model: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    } finally {
      setSumModelSaving(false);
    }
  },

  fetchSumCostStats: async () => {
    const { setSumCostStats } = get();
    try {
      const data = await api.get<{
        cycles?: Array<{ estimated_cost_cents?: number; created_at?: string }>;
        stats?: {
          avgCostCents?: number;
          count?: number;
          totalCostCents?: number;
        };
      }>("/cycles?hours=12");
      const last = data.cycles?.[0] || null;
      setSumCostStats({
        lastCostCents: last?.estimated_cost_cents || 0,
        lastCycleTime: last?.created_at || null,
        avgCostCents: data.stats?.avgCostCents || 0,
        cycleCount: data.stats?.count || 0,
        totalCostCents: data.stats?.totalCostCents || 0,
      });
    } catch (err: unknown) {
      console.error(
        "Failed to fetch sum cost stats:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  fetchSummarizationStats: async () => {
    const { setSummarizationStats } = get();
    try {
      const data = await api.get("/summarization-stats");
      setSummarizationStats(data);
    } catch (err: unknown) {
      console.error(
        "Failed to fetch summarization stats:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },
});
