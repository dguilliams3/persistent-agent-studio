/**
 * useSettingsTabState - State management hook for SettingsTab
 *
 * @module components/tabs/SettingsTab/useSettingsTabState
 * @description Extracts all Zustand store selectors, effects, and initial data
 * fetching from the SettingsTab coordinator.
 *
 * @upstream Called by: SettingsTab index
 * @downstream Calls: useAppStore
 */

import { useEffect } from "react";
import { useAppStore } from "../../../store";

export function useSettingsTabState() {
  // ==========================================================================
  // STORE SELECTORS - All state and actions from Zustand store
  // ==========================================================================

  // Data (cast from unknown to expected types for downstream components)
  const state = useAppStore((s) => s.state) as Record<string, any> | null;
  const history = useAppStore((s) => s.history) as Record<string, any>[];

  // Actions
  const fetchAll = useAppStore((s) => s.fetchAll);

  // Load data if not already loaded
  useEffect(() => {
    if (!state) {
      fetchAll();
    }
  }, [state, fetchAll]);

  // UI State
  const isThinking = useAppStore((s) => s.isThinking ?? false);

  // Loop controls
  const startLoop = useAppStore((s) => s.startLoop);
  const stopLoop = useAppStore((s) => s.stopLoop);
  const triggerThinkNow = useAppStore((s) => s.triggerThinkNow);
  const resetAll = useAppStore((s) => s.resetAll);

  // Model settings
  const selectedModel = useAppStore((s) => s.selectedModel);
  const setSelectedModel = useAppStore((s) => s.setSelectedModel);
  const cycleIntervalInput = useAppStore((s) => s.cycleIntervalInput);
  const setCycleIntervalInput = useAppStore((s) => s.setCycleIntervalInput);
  const updateCycleInterval = useAppStore((s) => s.updateCycleInterval);

  // Summarization
  const summarizeThresholdInput = useAppStore((s) => s.summarizeThresholdInput);
  const setSummarizeThresholdInput = useAppStore(
    (s) => s.setSummarizeThresholdInput,
  );
  const updateSummarizeSettings = useAppStore((s) => s.updateSummarizeSettings);
  const isSummarizing = useAppStore((s) => s.isSummarizing ?? false);
  const summarizeSuccess = useAppStore((s) => s.summarizeSuccess ?? false);
  const triggerSummarize = useAppStore((s) => s.triggerSummarize);
  const fetchSummarizeSettings = useAppStore((s) => s.fetchSummarizeSettings);
  const summaryMaxTokensInput = useAppStore((s) => s.summaryMaxTokensInput);
  const setSummaryMaxTokensInput = useAppStore(
    (s) => s.setSummaryMaxTokensInput,
  );
  const updateSummaryMaxTokens = useAppStore((s) => s.updateSummaryMaxTokens);
  const metaSummaryMaxTokensInput = useAppStore(
    (s) => s.metaSummaryMaxTokensInput,
  );
  const setMetaSummaryMaxTokensInput = useAppStore(
    (s) => s.setMetaSummaryMaxTokensInput,
  );
  const updateMetaSummaryMaxTokens = useAppStore(
    (s) => s.updateMetaSummaryMaxTokens,
  );

  // Summarization model
  const sumProvider = useAppStore((s) => s.sumProvider);
  const sumModel = useAppStore((s) => s.sumModel);
  const sumAvailableModels = useAppStore((s) => s.sumAvailableModels);
  const sumProviderStatus = useAppStore((s) => s.sumProviderStatus);
  const sumModelSaving = useAppStore((s) => s.sumModelSaving);
  const fetchSumModel = useAppStore((s) => s.fetchSumModel);
  const updateSumModel = useAppStore((s) => s.updateSumModel);
  const summarizationStats = useAppStore((s) => s.summarizationStats);
  const fetchSummarizationStats = useAppStore((s) => s.fetchSummarizationStats);

  // Meta-summarization reasoning effort
  const metaReasoningEffort = useAppStore((s) => s.metaReasoningEffort);
  const reasoningEffortOptions = useAppStore((s) => s.reasoningEffortOptions);
  const updateMetaReasoningEffort = useAppStore(
    (s) => s.updateMetaReasoningEffort,
  );

  // Default summarize count
  const summarizeDefaultCountInput = useAppStore(
    (s) => s.summarizeDefaultCountInput,
  );
  const setSummarizeDefaultCountInput = useAppStore(
    (s) => s.setSummarizeDefaultCountInput,
  );
  const updateSummarizeDefaultCount = useAppStore(
    (s) => s.updateSummarizeDefaultCount,
  );

  // Cost stats
  const cycleStatsLimit = useAppStore((s) => s.cycleStatsLimit);
  const setCycleStatsLimit = useAppStore((s) => s.setCycleStatsLimit);
  const fetchCycleStats = useAppStore((s) => s.fetchCycleStats);
  const cycleStats = useAppStore((s) => s.cycleStats) as Record<
    string,
    any
  > | null;

  // Toggles
  const batchEnabled = useAppStore((s) => s.batchEnabled);
  const batchMinutes = useAppStore((s) => s.batchMinutes);
  const setBatchMinutes = useAppStore((s) => s.setBatchMinutes);
  const toggleBatchWithTimer = useAppStore((s) => s.toggleBatchWithTimer);
  const streamingEnabled = useAppStore((s) => s.streamingEnabled);
  const toggleStreaming = useAppStore((s) => s.toggleStreaming);
  const showProfilePic = useAppStore((s) => s.showProfilePic);
  const setShowProfilePic = useAppStore((s) => s.setShowProfilePic);

  // Status
  const userStatusInput = useAppStore((s) => s.userStatusInput);
  const setUserStatusInput = useAppStore((s) => s.setUserStatusInput);
  const userStatus = useAppStore((s) => s.userStatus);
  const updateUserStatus = useAppStore((s) => s.updateUserStatus);
  const sleepStatus = useAppStore((s) => s.sleepStatus);
  const wakeUp = useAppStore((s) => s.wakeUp);
  const maxTokensInput = useAppStore((s) => s.maxTokensInput);
  const setMaxTokensInput = useAppStore((s) => s.setMaxTokensInput);
  const updateMaxTokens = useAppStore((s) => s.updateMaxTokens);

  // RAG config
  const ragEnabled = useAppStore((s) => s.ragEnabled);
  const setRagEnabled = useAppStore((s) => s.setRagEnabled);
  const ragTopK = useAppStore((s) => s.ragTopK);
  const setRagTopK = useAppStore((s) => s.setRagTopK);
  const ragHalflife = useAppStore((s) => s.ragHalflife);
  const setRagHalflife = useAppStore((s) => s.setRagHalflife);
  const ragMinSimilarity = useAppStore((s) => s.ragMinSimilarity);
  const setRagMinSimilarity = useAppStore((s) => s.setRagMinSimilarity);
  const ragMmrLambda = useAppStore((s) => s.ragMmrLambda);
  const setRagMmrLambda = useAppStore((s) => s.setRagMmrLambda);
  const ragWeights = useAppStore((s) => s.ragWeights);
  const setRagWeights = useAppStore((s) => s.setRagWeights);
  const ragConfig = useAppStore((s) => s.ragConfig) as Record<
    string,
    any
  > | null;
  const isSavingRag = useAppStore((s) => s.isSavingRag ?? false);
  const updateRagConfig = useAppStore((s) => s.updateRagConfig);
  const resetRagConfig = useAppStore((s) => s.resetRagConfig);
  const fetchRagConfig = useAppStore((s) => s.fetchRagConfig);

  // Additional fetches
  const fetchUserStatus = useAppStore((s) => s.fetchUserStatus);
  const fetchMaxTokens = useAppStore((s) => s.fetchMaxTokens);
  const fetchBatchEnabled = useAppStore((s) => s.fetchBatchEnabled);
  const fetchStreaming = useAppStore((s) => s.fetchStreaming);
  const fetchProfilePicture = useAppStore((s) => s.fetchProfilePicture);

  // Fetch all settings data on mount
  useEffect(() => {
    fetchSummarizeSettings();
    fetchRagConfig();
    fetchUserStatus();
    fetchMaxTokens();
    fetchCycleStats();
    fetchSumModel();
    fetchSummarizationStats();
    fetchBatchEnabled();
    fetchStreaming();
    fetchProfilePicture();
  }, [
    fetchSummarizeSettings,
    fetchRagConfig,
    fetchUserStatus,
    fetchMaxTokens,
    fetchCycleStats,
    fetchSumModel,
    fetchSummarizationStats,
    fetchBatchEnabled,
    fetchStreaming,
    fetchProfilePicture,
  ]);

  return {
    // Core state
    state,
    history,
    isThinking,

    // Loop controls
    startLoop,
    stopLoop,
    triggerThinkNow,
    resetAll,

    // Model settings
    selectedModel,
    setSelectedModel,
    cycleIntervalInput,
    setCycleIntervalInput,
    updateCycleInterval,

    // Summarization
    summarizeThresholdInput,
    setSummarizeThresholdInput,
    updateSummarizeSettings,
    isSummarizing,
    summarizeSuccess,
    triggerSummarize,
    summaryMaxTokensInput,
    setSummaryMaxTokensInput,
    updateSummaryMaxTokens,
    metaSummaryMaxTokensInput,
    setMetaSummaryMaxTokensInput,
    updateMetaSummaryMaxTokens,
    sumProvider,
    sumModel,
    sumAvailableModels,
    sumProviderStatus,
    sumModelSaving,
    updateSumModel,
    summarizationStats,
    metaReasoningEffort,
    reasoningEffortOptions,
    updateMetaReasoningEffort,
    summarizeDefaultCountInput,
    setSummarizeDefaultCountInput,
    updateSummarizeDefaultCount,

    // Cost & toggles
    cycleStatsLimit,
    setCycleStatsLimit,
    fetchCycleStats,
    cycleStats,
    batchEnabled,
    batchMinutes,
    setBatchMinutes,
    toggleBatchWithTimer,
    streamingEnabled,
    toggleStreaming,
    showProfilePic,
    setShowProfilePic,

    // Status
    userStatusInput,
    setUserStatusInput,
    userStatus,
    updateUserStatus,
    sleepStatus,
    wakeUp,
    maxTokensInput,
    setMaxTokensInput,
    updateMaxTokens,

    // RAG
    ragEnabled,
    setRagEnabled,
    ragTopK,
    setRagTopK,
    ragHalflife,
    setRagHalflife,
    ragMinSimilarity,
    setRagMinSimilarity,
    ragMmrLambda,
    setRagMmrLambda,
    ragWeights,
    setRagWeights,
    ragConfig,
    isSavingRag,
    updateRagConfig,
    resetRagConfig,
  };
}
