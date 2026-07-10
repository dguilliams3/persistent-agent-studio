/**
 * useMemoryTabState - State management hook for MemoryTab
 *
 * @module components/tabs/MemoryTab/useMemoryTabState
 * @description Extracts all store selectors, local state, effects, and memoized
 * values from the MemoryTab coordinator into a reusable hook.
 *
 * @upstream Called by: MemoryTab index
 * @downstream Calls: useAppStore, api client, useMemo, useEffect
 */

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useAppStore } from "../../../store";
import api from "../../../api/client";

export function useMemoryTabState() {
  // Get data from Zustand store (cast from unknown[] to Record<string, any>[])
  const summaries = useAppStore((s) => s.summaries) as Record<string, any>[];
  const archivedSummaries = useAppStore((s) => s.archivedSummaries) as Record<
    string,
    any
  >[];
  const notebook = useAppStore((s) => s.notebook) as Record<string, any>[];
  const coldStorage = useAppStore((s) => s.coldStorage) as Record<
    string,
    any
  >[];
  const reminders = useAppStore((s) => s.reminders) as Record<string, any>[];
  const observations = useAppStore((s) => s.observations) as Record<
    string,
    any
  >[];
  const learned = useAppStore((s) => s.learned) as Record<string, any>[];
  const questions = useAppStore((s) => s.questions) as Record<string, any>[];

  // Get delete action for learnings
  const deleteLearning = useAppStore((s) => s.deleteLearning);

  // Get summary consolidation state and actions from store
  const selectedSummaries = useAppStore((s) => s.selectedSummaries);
  const setSelectedSummaries = useAppStore((s) => s.setSelectedSummaries);
  const isMetasummarizing = useAppStore((s) => s.isMetasummarizing);
  const triggerMetasummarize = useAppStore((s) => s.triggerMetasummarize);
  const toggleSummarySelection = useAppStore((s) => s.toggleSummarySelection);
  const fetchSummaries = useAppStore((s) => s.fetchSummaries);

  // State for token breakdown visualization
  const [tokenBreakdown, setTokenBreakdown] = useState<Record<
    string,
    any
  > | null>(null);
  const [contextLoading, setContextLoading] = useState(false);

  // State for RAG preview
  const [ragResults, setRagResults] = useState<any[]>([]);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [ragConfig, setRagConfig] = useState({ mmrLambda: 0.7 });

  // State for sidebar navigation
  const [activeSection, setActiveSection] = useState("summaries");

  // Fetch token breakdown and RAG data from /context endpoint
  const hasFetchedOnce = useRef(false);

  useEffect(() => {
    const fetchContextData = async (isInitial = false) => {
      if (isInitial) {
        setContextLoading(true);
      }
      try {
        const [contextData, ragConfigData]: any[] = await Promise.all([
          api.get("/context"),
          api.get("/rag").catch(() => ({ enabled: false })),
        ]);

        setTokenBreakdown(contextData.stats?.tokenBreakdown || null);
        setRagResults(contextData.stats?.ragRetrievedSummaries || []);
        setRagEnabled(ragConfigData.enabled ?? false);
        setRagConfig(ragConfigData);
      } catch (error) {
        console.error("[MemoryTab] Failed to fetch context:", error);
      } finally {
        if (isInitial) {
          setContextLoading(false);
        }
      }
    };

    if (!hasFetchedOnce.current) {
      hasFetchedOnce.current = true;
      fetchContextData(true);
    }

    const interval = setInterval(() => fetchContextData(false), 30000);
    return () => clearInterval(interval);
  }, []);

  // PERF: Memoize expensive reduce operation
  const totalSummarizedEntries = useMemo(
    () => summaries.reduce((acc, s) => acc + (s.message_count || 0), 0),
    [summaries],
  );

  // Memoize counts for sidebar
  const sectionCounts = useMemo(
    () => ({
      summaries: summaries.length + archivedSummaries.length,
      notebook: notebook.length,
      coldStorage: coldStorage.length,
      learned: learned.length,
      questions: questions.length,
      observations: observations.length,
      reminders: reminders.length,
      rag: ragResults.length,
    }),
    [
      summaries,
      archivedSummaries,
      notebook,
      coldStorage,
      learned,
      questions,
      observations,
      reminders,
      ragResults,
    ],
  );

  const handleSectionChange = useCallback((sectionId: string) => {
    setActiveSection(sectionId);
  }, []);

  return {
    // Store data
    summaries,
    archivedSummaries,
    notebook,
    coldStorage,
    reminders,
    observations,
    learned,
    questions,
    deleteLearning,

    // Summary consolidation
    selectedSummaries,
    setSelectedSummaries,
    isMetasummarizing,
    triggerMetasummarize,
    toggleSummarySelection,

    // Context/token data
    tokenBreakdown,
    contextLoading,

    // RAG preview
    ragResults,
    ragEnabled,
    ragConfig,

    // Sidebar navigation
    activeSection,
    handleSectionChange,

    // Computed values
    totalSummarizedEntries,
    sectionCounts,
  };
}
