/**
 * Summaries Slice
 *
 * @module store/slices/summaries
 * @description Zustand store slice for summary management: selection, consolidation
 * (meta-summarization), manual summarization, promotion/demotion to Block 2,
 * activation/archival between tiers, and drag-and-drop positioning.
 *
 * Manages:
 * - Summary selection for batch operations
 * - Meta-summarization (consolidating multiple summaries into one)
 * - Manual history summarization trigger
 * - Tier management (promote to Block 2, demote, activate/archive)
 * - Position/ordering of summaries
 *
 * @upstream Called by:
 *   - store/index.js - Spread into main store via createSummariesSlice()
 *   - React components: MemoryTab (selection, consolidate, promote/demote, activate/archive)
 * @downstream Calls:
 *   - api/client.js - /metasummarize, /summarize, /summaries/:id/promote, /summaries/:id/demote,
 *     /summaries/:id/activate, /summaries/:id/archive, /summaries/:id/position
 *   - Other slices via get(): addLog (core), fetchSummaries (data), fetchHistory (data)
 *
 * @tests apps/web/store/slices/__tests__/summaries.test.js
 *   - "triggerMetasummarize - validation and state"
 *   - "triggerMetasummarize - API call and data refresh"
 *   - "triggerSummarize - debounce enforcement"
 *   - "triggerSummarize - success and failure paths"
 *   - "promoteSummary/demoteSummary - tier operations"
 *   - "activateSummary/archiveSummary - RAG archive transitions"
 *   - "setSummaryPosition - positioning"
 */

import api from "../../api/client";
import type { StateCreator } from "zustand";
import type { AppState } from "../types";

export interface SummariesSlice {
  // State
  selectedSummaries: Set<number>;
  isMetasummarizing: boolean;
  isMovingSummary: boolean;
  isPinningSummary: boolean;

  // Setters
  setSelectedSummaries: (summaries: Set<number>) => void;
  toggleSummarySelection: (id: number) => void;
  clearSelectedSummaries: () => void;
  setIsMetasummarizing: (meta: boolean) => void;

  // Actions
  triggerMetasummarize: () => Promise<void>;
  triggerSummarize: (
    count?: number,
    force?: boolean,
    notes?: string,
  ) => Promise<void>;
  promoteSummary: (summaryId: number) => Promise<void>;
  demoteSummary: (summaryId: number) => Promise<void>;
  activateSummary: (summaryId: number) => Promise<void>;
  archiveSummary: (summaryId: number) => Promise<void>;
  setSummaryPosition: (summaryId: number, position: number) => Promise<void>;
}

export const createSummariesSlice: StateCreator<
  AppState,
  [],
  [],
  SummariesSlice
> = (set, get) => ({
  // ===========================================================================
  // STATE
  // ===========================================================================

  /** @type {Set<number>} Selected summary IDs for meta-summarization */
  selectedSummaries: new Set<number>(),

  /** @type {boolean} Meta-summarization in progress */
  isMetasummarizing: false,

  /** @type {boolean} Moving summary between tiers */
  isMovingSummary: false,

  /** @type {boolean} Pinning/unpinning summary */
  isPinningSummary: false,

  // ===========================================================================
  // SETTERS
  // ===========================================================================

  /**
   * @description Replace entire selection set
   * @upstream Called by: UI components clearing selection
   * @downstream Calls: setState (Zustand)
   * @param {Set<number>} summaries - New Set of summary IDs
   */
  setSelectedSummaries: (summaries: Set<number>) =>
    set({ selectedSummaries: summaries }),

  /**
   * @description Toggle a single summary ID in/out of selection
   * @upstream Called by: Summary row click handlers
   * @downstream Calls: setState (Zustand)
   * @param {number} id - Summary ID to toggle
   */
  toggleSummarySelection: (id: number) =>
    set((s) => {
      const newSet = new Set(s.selectedSummaries);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return { selectedSummaries: newSet };
    }),

  /**
   * @description Clear all selected summaries
   * @upstream Called by: Selection clear button, after successful consolidate
   * @downstream Calls: setState (Zustand)
   */
  clearSelectedSummaries: () => set({ selectedSummaries: new Set() }),

  /**
   * @description Set meta-summarization loading state
   * @upstream Called by: triggerMetasummarize action
   * @downstream Calls: setState (Zustand)
   * @param {boolean} meta - True if meta-summarization is in progress
   */
  setIsMetasummarizing: (meta: boolean) => set({ isMetasummarizing: meta }),

  // ===========================================================================
  // ACTIONS
  // ===========================================================================

  /**
   * @description Trigger meta-summarization of selected summaries
   *
   * Consolidates 2+ selected summaries into a single new summary.
   * Uses database IDs (not array indices) for stability across sorts/filters/pagination.
   *
   * Validation:
   * - Requires minimum 2 summaries selected, otherwise logs error and returns
   *
   * State transition:
   * - Sets isMetasummarizing = true
   * - Makes API call with array of selected IDs
   * - Clears selection and refreshes summaries + history
   * - Sets isMetasummarizing = false in finally block
   *
   * @upstream Called by: MemoryTab consolidate button
   * @downstream Calls: api.post('/metasummarize'), addLog (core), fetchSummaries (data), fetchHistory (data)
   *
   * @returns {Promise<void>} No return value; state updates and logs handled via store
   *
   * @example
   * await store.triggerMetasummarize();
   * // Assumes 2+ summaries are selected via toggleSummarySelection()
   * // Logs progress, success (new ID + tier), or error
   *
   * @tests apps/web/store/slices/__tests__/summaries.test.js
   *   - "triggerMetasummarize - validation and state" - requires 2+ selections
   *   - "triggerMetasummarize - API call and data refresh" - successful consolidation flow
   *
   * @note Selection validation happens BEFORE async operation starts
   * @note Archived IDs may be included in result (consolidated summaries auto-archived)
   */
  triggerMetasummarize: async () => {
    const {
      addLog,
      selectedSummaries,
      setIsMetasummarizing,
      clearSelectedSummaries,
      fetchSummaries,
      fetchHistory,
    } = get();
    if (selectedSummaries.size < 2) {
      addLog("❌ Select at least 2 summaries to consolidate");
      return;
    }
    setIsMetasummarizing(true);
    addLog(`📊 Consolidating ${selectedSummaries.size} summaries...`);
    try {
      const result = (await api.post("/metasummarize", {
        ids: Array.from(selectedSummaries),
      })) as Record<string, unknown>;
      addLog(`✅ Created #${result.newSummaryId} → ${result.landedIn}`);
      addLog(
        `   Archived: [${(result.archivedIds as number[] | undefined)?.join(", ")}] → ${result.archivedTo}`,
      );
      addLog(
        `   Active: ${result.summariesBefore} → ${result.summariesAfter} (${result.durationMs}ms)`,
      );
      clearSelectedSummaries();
      await Promise.all([fetchSummaries(), fetchHistory()]);
    } catch (err: unknown) {
      addLog(
        `❌ Consolidation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsMetasummarizing(false);
    }
  },

  /**
   * @description Manually trigger history summarization from web UI
   *
   * Debounced to prevent rapid-fire consolidations. Summarizes oldest N history
   * entries into a single summary entry.
   *
   * Debounce:
   * - Minimum 3 seconds between summarization calls
   * - Tracks lastSummarizeTime in store
   * - Returns early with warning if called too soon
   *
   * Success:
   * - Sets summarizeSuccess = true (for UI success feedback)
   * - Auto-clears summarizeSuccess after 3 seconds
   * - Refreshes history + summaries
   *
   * Failure:
   * - Logs error from API response or exception
   * - summarizeSuccess stays false
   *
   * @upstream Called by: SettingsTab summarize button
   * @downstream Calls: api.post('/summarize'), addLog (core), fetchHistory (data), fetchSummaries (data),
   *   setIsSummarizing (settings), setLastSummarizeTime (settings), setSummarizeSuccess (settings)
   *
   * @param {number} [count] - Number of oldest entries to summarize (optional)
   * @param {boolean} [force=false] - Override threshold check if true
   * @param {string} [notes] - Optional focus notes to guide LLM summarization
   *
   * @returns {Promise<void>} No return value; state and logs managed via store
   *
   * @example
   * // Summarize oldest 50 entries
   * await store.triggerSummarize(50);
   * // Summarize with force flag and focus notes
   * await store.triggerSummarize(100, true, 'Focus on system behavior changes');
   *
   * @tests apps/web/store/slices/__tests__/summaries.test.js
   *   - "triggerSummarize - debounce enforcement" - 3s min interval, warning message
   *   - "triggerSummarize - success and failure paths" - API call, state updates, data refresh
   *
   * @note Debounce timer is per-session (resets on page reload)
   * @note lastSummarizeTime is stored in settings slice, not summaries slice
   */
  triggerSummarize: async (count?: number, force = false, notes?: string) => {
    const {
      addLog,
      setIsSummarizing,
      setLastSummarizeTime,
      setSummarizeSuccess,
      fetchHistory,
      fetchSummaries,
      lastSummarizeTime,
    } = get();

    const now = Date.now();
    const timeSinceLast = now - lastSummarizeTime;
    if (timeSinceLast < 3000) {
      addLog(
        `⏳ Please wait ${Math.ceil((3000 - timeSinceLast) / 1000)}s before starting another summarization`,
      );
      return;
    }

    setIsSummarizing(true);
    setSummarizeSuccess(false);
    setLastSummarizeTime(now);
    addLog(
      `📦 Starting summarization of ${count || "oldest"} history entries...`,
    );

    try {
      const result = await api.post("/summarize", { count, force, notes });
      if (result.success) {
        addLog(`✅ SUCCESS: Summarized ${result.count} entries into 1 summary`);
        setSummarizeSuccess(true);
        await Promise.all([fetchHistory(), fetchSummaries()]);
        setTimeout(() => setSummarizeSuccess(false), 3000);
      } else {
        addLog(`❌ FAILED: Summarization error: ${result.error}`);
      }
    } catch (err: unknown) {
      addLog(
        `❌ ERROR: Summarization failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsSummarizing(false);
    }
  },

  /**
   * @description Move summary to Block 2 (higher priority in Claude's context)
   *
   * Promotion increases summary priority so it appears in higher context blocks,
   * giving Claude more recent/weighted access to that summary's compressed knowledge.
   *
   * @upstream Called by: Summary control button in UI
   * @downstream Calls: api.post('/summaries/:id/promote'), addLog (core), fetchSummaries (data)
   *
   * @param {number} summaryId - Summary ID to promote
   *
   * @returns {Promise<void>} Rejects if API call fails
   *
   * @example
   * await store.promoteSummary(42);
   * // Logs: "⭐ Promoted summary #42 to Block 2"
   *
   * @tests apps/web/store/slices/__tests__/summaries.test.js
   *   - "promoteSummary/demoteSummary - tier operations" - API call, log, fetchSummaries
   *
   * @note Throws error to caller; caller should catch if needed
   * @antipattern
   * // WRONG: Don't swallow the promise rejection
   * promoteSummary(id); // Fire and forget, errors silent
   * // CORRECT: Await or handle rejection
   * await promoteSummary(id).catch(err => console.error(err));
   */
  promoteSummary: async (summaryId: number) => {
    const { addLog, fetchSummaries } = get();
    try {
      await api.post(`/summaries/${summaryId}/promote`);
      addLog(`⭐ Promoted summary #${summaryId} to Block 2`);
      await fetchSummaries();
    } catch (err: unknown) {
      addLog(
        `❌ Failed to promote summary: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  },

  /**
   * @description Remove summary from Block 2 (return to default priority)
   *
   * Inverse of promoteSummary. Demoting reduces summary priority so it appears
   * in lower context blocks (or removed from active context if RAG only).
   *
   * @upstream Called by: Summary control button in UI
   * @downstream Calls: api.post('/summaries/:id/demote'), addLog (core), fetchSummaries (data)
   *
   * @param {number} summaryId - Summary ID to demote
   *
   * @returns {Promise<void>} Rejects if API call fails
   *
   * @example
   * await store.demoteSummary(42);
   * // Logs: "↩️ Demoted summary #42 from Block 2"
   *
   * @tests apps/web/store/slices/__tests__/summaries.test.js
   *   - "promoteSummary/demoteSummary - tier operations" - API call, log, fetchSummaries
   *
   * @note Throws error to caller; caller should catch if needed
   */
  demoteSummary: async (summaryId: number) => {
    const { addLog, fetchSummaries } = get();
    try {
      await api.post(`/summaries/${summaryId}/demote`);
      addLog(`↩️ Demoted summary #${summaryId} from Block 2`);
      await fetchSummaries();
    } catch (err: unknown) {
      addLog(
        `❌ Failed to demote summary: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  },

  /**
   * @description Move summary from RAG Archive to Dynamic Tail (active context)
   *
   * Activation brings a summary back into Claude's active context (Dynamic Tail),
   * making it available for immediate use rather than only through RAG retrieval.
   *
   * Tier transitions:
   * - RAG Archive (rarely used) → Dynamic Tail (always in context)
   *
   * @upstream Called by: Summary control button in archive view
   * @downstream Calls: api.post('/summaries/:id/activate'), addLog (core), fetchSummaries (data)
   *
   * @param {number} summaryId - Summary ID to activate
   *
   * @returns {Promise<void>} Rejects if API call fails
   *
   * @example
   * await store.activateSummary(42);
   * // Logs: "📤 Activated summary #42 (moved from RAG Archive to Dynamic Tail)"
   *
   * @tests apps/web/store/slices/__tests__/summaries.test.js
   *   - "activateSummary/archiveSummary - RAG archive transitions" - tier movements
   *
   * @note Throws error to caller; caller should catch if needed
   */
  activateSummary: async (summaryId: number) => {
    const { addLog, fetchSummaries } = get();
    try {
      await api.post(`/summaries/${summaryId}/activate`);
      addLog(
        `📤 Activated summary #${summaryId} (moved from RAG Archive to Dynamic Tail)`,
      );
      await fetchSummaries();
    } catch (err: unknown) {
      addLog(
        `❌ Failed to activate summary: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  },

  /**
   * @description Move summary from Dynamic Tail to RAG Archive (semantic search only)
   *
   * Archiving removes a summary from Claude's active context, but keeps it available
   * for retrieval via RAG (semantic similarity search) when relevant.
   *
   * Tier transitions:
   * - Dynamic Tail (always in context) → RAG Archive (search-only)
   *
   * @upstream Called by: Summary control button in active view
   * @downstream Calls: api.post('/summaries/:id/archive'), addLog (core), fetchSummaries (data)
   *
   * @param {number} summaryId - Summary ID to archive
   *
   * @returns {Promise<void>} Rejects if API call fails
   *
   * @example
   * await store.archiveSummary(42);
   * // Logs: "📥 Archived summary #42 (moved from Dynamic Tail to RAG Archive)"
   *
   * @tests apps/web/store/slices/__tests__/summaries.test.js
   *   - "activateSummary/archiveSummary - RAG archive transitions" - tier movements
   *
   * @note Throws error to caller; caller should catch if needed
   * @note Archived summaries remain in database and are searchable via RAG
   */
  archiveSummary: async (summaryId: number) => {
    const { addLog, fetchSummaries } = get();
    try {
      await api.post(`/summaries/${summaryId}/archive`);
      addLog(
        `📥 Archived summary #${summaryId} (moved from Dynamic Tail to RAG Archive)`,
      );
      await fetchSummaries();
    } catch (err: unknown) {
      addLog(
        `❌ Failed to archive summary: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  },

  /**
   * @description Set drag-and-drop position for summary in tier
   *
   * Allows user to manually reorder summaries within their current tier.
   * Position is a Unix timestamp (sort key) updated via API.
   *
   * @upstream Called by: Drag-and-drop handlers in SummaryList
   * @downstream Calls: api.post('/summaries/:id/position'), addLog (core), fetchSummaries (data)
   *
   * @param {number} summaryId - Summary ID to reposition
   * @param {number} position - New position timestamp
   *
   * @returns {Promise<void>} Rejects if API call fails
   *
   * @example
   * // Move summary to top of tier (current time)
   * await store.setSummaryPosition(42, Date.now());
   * // Move to specific position
   * await store.setSummaryPosition(42, 1707000000000);
   *
   * @tests apps/web/store/slices/__tests__/summaries.test.js
   *   - "setSummaryPosition - positioning" - API call, state refresh
   *
   * @note Position is stored as Unix timestamp in database
   * @note Higher position values = later in sort order (descending)
   */
  setSummaryPosition: async (summaryId: number, position: number) => {
    const { addLog, fetchSummaries } = get();
    try {
      await api.post(`/summaries/${summaryId}/position`, { position });
      addLog(`🔄 Set summary #${summaryId} position to ${position}`);
      await fetchSummaries();
    } catch (err: unknown) {
      addLog(
        `❌ Failed to set summary position: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  },
});
