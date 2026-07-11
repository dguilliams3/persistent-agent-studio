/**
 * Data Fetching Slice
 *
 * @module store/slices/data
 * @description Zustand store slice for core data arrays and their fetch actions.
 * Manages all data fetched from the worker API: history, cold storage, notebook,
 * summaries, reminders, observations, learned, questions, branches, synthetics,
 * personas, and pricing config.
 *
 * Also contains fetchAll and fetchTabData for coordinated data loading.
 *
 * @upstream Called by:
 *   - store/index.js - Spread into main store via createDataSlice()
 * @downstream Calls:
 *   - api/client.js - All API fetch requests
 */

import api from "../../api/client";
import type { StateCreator } from "zustand";
import type { AppState } from "../types";

/** Gallery image entry from /gallery endpoint */
export interface GalleryImage {
  id: number;
  content: string;
  internal: string | null;
  created_at: string;
  type: string;
  blurred: boolean;
  vaulted: boolean;
  _lastUpdated: number;
  [key: string]: unknown;
}

/** Minimal persona shape stored in the data slice. Superset of PersonaSelectorItem. */
export interface PersonaRecord {
  id: number;
  name: string;
  [key: string]: unknown;
}

export interface DataSlice {
  // ===========================================================================
  // CORE DATA
  // ===========================================================================

  /** @type {Object|null} Loop state from /state endpoint (isRunning, loopCount, etc.) */
  state: unknown;
  /** @type {Array<Object>} Timeline entries from /history endpoint */
  history: unknown[];
  /** @type {{total: number, limit: number, offset: number, hasMore: boolean}} History pagination state */
  historyPagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  /** @type {Array<Object>} Permanent memories from /cold-storage endpoint */
  coldStorage: unknown[];
  /** @type {Array<Object>} Saved notes from /notebook endpoint */
  notebook: unknown[];
  /** @type {Array<Object>} Active (non-archived) summaries from /summaries endpoint */
  summaries: unknown[];
  /** @type {Array<Object>} Archived summaries (consolidated/replaced) */
  archivedSummaries: unknown[];
  /** @type {Array<Object>} Active reminders from /reminders endpoint */
  reminders: unknown[];
  /** @type {Array<Object>} User observations from /observations endpoint */
  observations: unknown[];
  /** @type {Array<Object>} Self-knowledge entries from /learned endpoint */
  learned: unknown[];
  /** @type {Array<Object>} Open questions from /questions endpoint */
  questions: unknown[];
  /** @type {Array<GalleryImage>} Art gallery images from /gallery endpoint */
  galleryImages: GalleryImage[];
  /** @type {Array<Object>} Memory branches from /branches endpoint */
  branches: unknown[];
  /** @type {Array<Object>} Synthetic memories from /memory/synthetic endpoint */
  syntheticMemories: unknown[];
  /** @type {Array<Object>} All personas from /personas endpoint */
  personas: PersonaRecord[];
  /** @type {Object|null} Currently active persona from /personas/active endpoint */
  activePersona: PersonaRecord | null;
  /** @type {Object|null} Pricing config from API (models, cache, batchDiscount) */
  pricingConfig: unknown;
  /** @type {boolean} Whether a fetchAll is currently in progress */
  isLoading: boolean;

  // ===========================================================================
  // DIRECT SETTERS
  // ===========================================================================

  setState: (state: Record<string, unknown> | null) => void;
  setHistory: (history: unknown[]) => void;
  setColdStorage: (coldStorage: unknown[]) => void;
  setNotebook: (notebook: unknown) => void;
  setSummaries: (summaries: unknown) => void;
  setReminders: (reminders: unknown) => void;
  setObservations: (observations: unknown) => void;
  setLearned: (learned: unknown) => void;
  setQuestions: (questions: unknown) => void;
  setGalleryImages: (galleryImages: GalleryImage[] | unknown) => void;
  setBranches: (branches: unknown[] | unknown) => void;
  setSyntheticMemories: (syntheticMemories: unknown[] | unknown) => void;
  setPersonas: (personas: PersonaRecord[] | unknown) => void;
  setActivePersona: (activePersona: PersonaRecord | null) => void;
  setPricingConfig: (config: unknown) => void;

  // ===========================================================================
  // FETCH ACTIONS
  // ===========================================================================

  fetchState: () => Promise<void>;
  fetchHistory: (limit?: number) => Promise<void>;
  loadMoreHistory: () => Promise<void>;
  fetchColdStorage: () => Promise<void>;
  fetchNotebook: () => Promise<void>;
  fetchSummaries: () => Promise<void>;
  fetchReminders: () => Promise<void>;
  fetchObservations: () => Promise<void>;
  fetchLearned: () => Promise<void>;
  deleteLearning: (id: string) => Promise<boolean>;
  fetchQuestions: () => Promise<void>;
  fetchGalleryImages: () => Promise<void>;
  fetchBranches: () => Promise<void>;
  fetchSyntheticMemories: () => Promise<void>;
  fetchPersonas: () => Promise<void>;
  fetchActivePersona: () => Promise<void>;
  switchPersona: (personaId: string | number) => Promise<boolean>;
  createPersona: (
    name: string,
    password: string,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
  fetchPricing: () => Promise<void>;

  // ===========================================================================
  // COORDINATED FETCH
  // ===========================================================================

  fetchAll: () => Promise<void>;
  fetchTabData: (tab: string) => Promise<void>;

  // ===========================================================================
  // METER ACTIONS
  // ===========================================================================

  saveMeterChanges: (
    changes: Record<string, { from: number; to: number }>,
  ) => Promise<unknown>;
}

export const createDataSlice: StateCreator<AppState, [], [], DataSlice> = (
  set,
  get,
) => ({
  // ===========================================================================
  // CORE DATA (fetched from worker API)
  // ===========================================================================

  /** @type {Object|null} Loop state from /state endpoint (isRunning, loopCount, etc.) */
  state: null as unknown,

  /** @type {Array<Object>} Timeline entries from /history endpoint */
  history: [] as unknown[],

  /** @type {{total: number, limit: number, offset: number, hasMore: boolean}} History pagination state */
  historyPagination: { total: 0, limit: 100, offset: 0, hasMore: false },

  /** @type {Array<Object>} Permanent memories from /cold-storage endpoint */
  coldStorage: [] as unknown[],

  /** @type {Array<Object>} Saved notes from /notebook endpoint */
  notebook: [] as unknown[],

  /** @type {Array<Object>} Active (non-archived) summaries from /summaries endpoint */
  summaries: [] as unknown[],

  /** @type {Array<Object>} Archived summaries (consolidated/replaced) */
  archivedSummaries: [] as unknown[],

  /** @type {Array<Object>} Active reminders from /reminders endpoint */
  reminders: [] as unknown[],

  /** @type {Array<Object>} User observations from /observations endpoint */
  observations: [] as unknown[],

  /** @type {Array<Object>} Self-knowledge entries from /learned endpoint */
  learned: [] as unknown[],

  /** @type {Array<Object>} Open questions from /questions endpoint */
  questions: [] as unknown[],

  /** @type {Array<Object>} Art gallery images from /gallery endpoint */
  galleryImages: [] as GalleryImage[],

  /** @type {Array<Object>} Memory branches from /branches endpoint */
  branches: [] as unknown[],

  /** @type {Array<Object>} Synthetic memories from /memory/synthetic endpoint */
  syntheticMemories: [] as unknown[],

  /** @type {Array<Object>} All personas from /personas endpoint */
  personas: [] as PersonaRecord[],

  /** @type {Object|null} Currently active persona from /personas/active endpoint */
  activePersona: null as PersonaRecord | null,

  /** @type {Object|null} Pricing config from API (models, cache, batchDiscount) */
  pricingConfig: null as unknown,

  /** @type {boolean} Whether a fetchAll is currently in progress */
  isLoading: false,

  // ===========================================================================
  // DIRECT SETTERS
  // ===========================================================================

  /**
   * @description Set loop state directly
   * @upstream Called by: Manual state setting, UI sync
   * @downstream Calls: React component re-render
   * @param {Object} state - Loop state object
   * @returns {void}
   */
  setState: (state: Record<string, unknown> | null) => set({ state }),

  /**
   * @description Set history entries
   * @upstream Called by: fetchHistory, loadMoreHistory
   * @downstream Calls: History display rendering
   * @param {Array<Object>} history - History entries array
   * @returns {void}
   */
  setHistory: (history: unknown[]) => set({ history }),

  /**
   * @description Set cold storage (permanent memories)
   * @upstream Called by: fetchColdStorage
   * @downstream Calls: Memory tab rendering
   * @param {Array<Object>} coldStorage - Cold storage entries
   * @returns {void}
   */
  setColdStorage: (coldStorage: unknown[]) => set({ coldStorage }),

  /**
   * @description Set notebook entries
   * @upstream Called by: fetchNotebook
   * @downstream Calls: Notebook tab rendering
   * @param {Array<Object>} notebook - Notebook entries
   * @returns {void}
   */
  setNotebook: (notebook: unknown) => set({ notebook: notebook as unknown[] }),

  /**
   * @description Set summaries (compressed history)
   * @upstream Called by: fetchSummaries
   * @downstream Calls: Summaries display rendering
   * @param {Array<Object>} summaries - Summary entries
   * @returns {void}
   */
  setSummaries: (summaries: unknown) =>
    set({ summaries: summaries as unknown[] }),

  /**
   * @description Set reminders
   * @upstream Called by: fetchReminders
   * @downstream Calls: Reminders display
   * @param {Array<Object>} reminders - Active reminders
   * @returns {void}
   */
  setReminders: (reminders: unknown) =>
    set({ reminders: reminders as unknown[] }),

  /**
   * @description Set user observations
   * @upstream Called by: fetchObservations
   * @downstream Calls: Observations display
   * @param {Array<Object>} observations - Observations about the user
   * @returns {void}
   */
  setObservations: (observations: unknown) =>
    set({ observations: observations as unknown[] }),

  /**
   * @description Set learned entries (verified self-knowledge)
   * @upstream Called by: fetchLearned
   * @downstream Calls: Learned display
   * @param {Array<Object>} learned - Self-knowledge entries
   * @returns {void}
   */
  setLearned: (learned: unknown) => set({ learned: learned as unknown[] }),

  /**
   * @description Set open questions
   * @upstream Called by: fetchQuestions
   * @downstream Calls: Questions display
   * @param {Array<Object>} questions - Open questions
   * @returns {void}
   */
  setQuestions: (questions: unknown) =>
    set({ questions: questions as unknown[] }),

  /**
   * @description Set gallery images
   * @upstream Called by: fetchGalleryImages
   * @downstream Calls: Gallery tab rendering
   * @param {Array<Object>} galleryImages - Image objects with metadata
   * @returns {void}
   */
  setGalleryImages: (galleryImages: GalleryImage[] | unknown) =>
    set({
      galleryImages: (Array.isArray(galleryImages)
        ? galleryImages
        : []) as GalleryImage[],
    }),

  /**
   * @description Set memory branches
   * @upstream Called by: fetchBranches
   * @downstream Calls: Editor tab rendering
   * @param {Array<Object>} branches - Branch configurations
   * @returns {void}
   */
  setBranches: (branches: unknown[] | unknown) =>
    set({ branches: (Array.isArray(branches) ? branches : []) as unknown[] }),

  /**
   * @description Set synthetic memories
   * @upstream Called by: fetchSyntheticMemories
   * @downstream Calls: Editor tab rendering
   * @param {Array<Object>} syntheticMemories - Injected memories
   * @returns {void}
   */
  setSyntheticMemories: (syntheticMemories: unknown[] | unknown) =>
    set({
      syntheticMemories: (Array.isArray(syntheticMemories)
        ? syntheticMemories
        : []) as unknown[],
    }),

  /**
   * @description Set all personas
   * @upstream Called by: fetchPersonas
   * @downstream Calls: Persona selector display
   * @param {Array<Object>} personas - All persona definitions
   * @returns {void}
   */
  setPersonas: (personas: PersonaRecord[] | unknown) =>
    set({
      personas: (Array.isArray(personas) ? personas : []) as PersonaRecord[],
    }),

  /**
   * @description Set currently active persona
   * @upstream Called by: fetchPersonas, fetchActivePersona, switchPersona
   * @downstream Calls: Active persona display
   * @param {Object|null} activePersona - Currently active persona or null
   * @returns {void}
   */
  setActivePersona: (activePersona: PersonaRecord | null) =>
    set({ activePersona }),

  /**
   * @description Set pricing configuration
   * @upstream Called by: fetchPricing
   * @downstream Calls: Cost display, calculator logic
   * @param {Object} config - Pricing model config
   * @returns {void}
   */
  setPricingConfig: (config: unknown) => set({ pricingConfig: config }),

  // ===========================================================================
  // FETCH ACTIONS
  // ===========================================================================

  /**
   * @description Fetch loop state from /state endpoint
   *
   * Retrieves isRunning, loopCount, cycle_interval_seconds, and other
   * configuration state variables.
   *
   * @upstream Called by: fetchAll, initialization
   * @downstream Calls: api.get('/state'), setState
   *
   * @returns {Promise<void>}
   *
   * @tests apps/web/store/slices/__tests__/data.test.js
   *   - "fetchState - success"
   *   - "fetchState - error handling"
   */
  fetchState: async () => {
    try {
      const data = await api.get("/state");
      set({
        state: data,
        cycleIntervalInput: String(data.cycleIntervalSeconds || 60),
        summarizeThresholdInput: String(data.summarizeThreshold || 30),
        selectedModel:
          (data.selectedModel as string) || "claude-sonnet-5",
      });
    } catch (err: unknown) {
      console.error(
        "Failed to fetch state:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  /**
   * @description Fetch history entries with pagination
   *
   * Retrieves timeline entries (thoughts, messages, art, searches, etc.)
   * from /history endpoint. Initializes pagination state.
   *
   * @upstream Called by: fetchAll, tab initialization
   * @downstream Calls: api.get('/history'), setHistory, historyPagination state
   *
   * @param {number} [limit=100] - Number of entries to fetch
   * @returns {Promise<void>}
   *
   * @tests apps/web/store/slices/__tests__/data.test.js
   *   - "fetchHistory - success"
   *   - "fetchHistory - with limit"
   *   - "fetchHistory - error handling"
   *
   * @example
   * await fetchHistory();       // Fetch 100 entries
   * await fetchHistory(50);     // Fetch 50 entries
   */
  fetchHistory: async (limit = 100) => {
    try {
      const data = await api.get(`/history?limit=${limit}`);
      set({
        history: (data.history as unknown[]) || [],
        historyPagination: {
          total: (data.total as number) || 0,
          limit: (data.limit as number) || limit,
          offset: (data.offset as number) || 0,
          hasMore: (data.hasMore as boolean) || false,
        },
      });
    } catch (err: unknown) {
      console.error(
        "Failed to fetch history:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  /**
   * @description Load next page of history entries
   *
   * Appends more history entries if hasMore is true. Shows log message
   * with offset for user feedback.
   *
   * @upstream Called by: "Load more" button in ChatTab
   * @downstream Calls: api.get('/history'), addLog, setHistory
   *
   * @returns {Promise<void>}
   *
   * @tests apps/web/store/slices/__tests__/data.test.js
   *   - "loadMoreHistory - appends entries"
   *   - "loadMoreHistory - respects hasMore flag"
   *   - "loadMoreHistory - error handling"
   */
  loadMoreHistory: async () => {
    const { history, historyPagination, addLog } = get();
    if (!historyPagination.hasMore) return;

    const newOffset = historyPagination.offset + historyPagination.limit;
    addLog(`📜 Loading more history (offset: ${newOffset})...`);

    try {
      const data: Record<string, unknown> = await api.get(
        `/history?limit=${historyPagination.limit}&offset=${newOffset}`,
      );
      set({
        history: [
          ...(history as unknown[]),
          ...((data.history as unknown[]) || []),
        ],
        historyPagination: {
          total: (data.total as number) || historyPagination.total,
          limit: (data.limit as number) || historyPagination.limit,
          offset: (data.offset as number) || newOffset,
          hasMore: (data.hasMore as boolean) || false,
        },
      });
    } catch (err: unknown) {
      console.error(
        "Failed to load more history:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  /**
   * @description Fetch cold storage (permanent memories)
   *
   * Retrieves permanently frozen memories that never scroll away.
   *
   * @upstream Called by: fetchAll, memory tab initialization
   * @downstream Calls: api.get('/cold-storage'), setColdStorage
   *
   * @returns {Promise<void>}
   *
   * @tests apps/web/store/slices/__tests__/data.test.js
   *   - "fetchColdStorage - success"
   *   - "fetchColdStorage - error handling"
   */
  fetchColdStorage: async () => {
    try {
      const data = await api.get("/cold-storage");
      set({ coldStorage: (data.coldStorage as unknown[]) || [] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Failed to fetch cold storage:", msg);
      set({ error: `Failed to load cold storage: ${msg}` });
    }
  },

  /**
   * @description Fetch notebook entries
   *
   * Retrieves saved notes from the notebook.
   *
   * @upstream Called by: fetchAll, memory tab initialization
   * @downstream Calls: api.get('/notebook'), setNotebook
   *
   * @returns {Promise<void>}
   *
   * @tests apps/web/store/slices/__tests__/data.test.js
   *   - "fetchNotebook - success"
   *   - "fetchNotebook - error handling"
   */
  fetchNotebook: async () => {
    try {
      const data = await api.get("/notebook");
      set({ notebook: (data.notebook as unknown[]) || [] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Failed to fetch notebook:", msg);
      set({ error: `Failed to load notebook: ${msg}` });
    }
  },

  /**
   * @description Fetch summaries (both active and archived)
   *
   * Retrieves compressed history summaries and archived summaries.
   *
   * @upstream Called by: fetchAll, memory tab initialization
   * @downstream Calls: api.get('/summaries'), setSummaries, setArchivedSummaries
   *
   * @returns {Promise<void>}
   *
   * @tests apps/web/store/slices/__tests__/data.test.js
   *   - "fetchSummaries - success"
   *   - "fetchSummaries - separates active/archived"
   *   - "fetchSummaries - error handling"
   */
  fetchSummaries: async () => {
    try {
      const data = await api.get("/summaries?include_archived=true");
      set({
        summaries: (data.active as unknown[]) || [],
        archivedSummaries: (data.archived as unknown[]) || [],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Failed to fetch summaries:", msg);
      set({ error: `Failed to load summaries: ${msg}` });
    }
  },

  /**
   * @description Fetch active reminders
   *
   * Retrieves persistent reminders that survive sessions.
   *
   * @upstream Called by: fetchAll, memory tab initialization
   * @downstream Calls: api.get('/reminders'), setReminders
   *
   * @returns {Promise<void>}
   *
   * @tests apps/web/store/slices/__tests__/data.test.js
   *   - "fetchReminders - success"
   *   - "fetchReminders - error handling"
   */
  fetchReminders: async () => {
    try {
      const data = await api.get("/reminders");
      set({ reminders: (data.reminders as unknown[]) || [] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Failed to fetch reminders:", msg);
      set({ error: `Failed to load reminders: ${msg}` });
    }
  },

  /**
   * @description Fetch observations about the user
   *
   * Retrieves Clio's observations of the user's behavior and preferences.
   *
   * @upstream Called by: fetchAll, memory tab initialization
   * @downstream Calls: api.get('/observations'), setObservations
   *
   * @returns {Promise<void>}
   *
   * @tests apps/web/store/slices/__tests__/data.test.js
   *   - "fetchObservations - success"
   *   - "fetchObservations - error handling"
   */
  fetchObservations: async () => {
    try {
      const data = await api.get("/observations");
      set({ observations: (data.observations as unknown[]) || [] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Failed to fetch observations:", msg);
      set({ error: `Failed to load observations: ${msg}` });
    }
  },

  /**
   * @description Fetch learned entries (verified self-knowledge)
   *
   * Retrieves Clio's verified knowledge about itself.
   *
   * @upstream Called by: fetchAll, memory tab initialization
   * @downstream Calls: api.get('/learned'), setLearned
   *
   * @returns {Promise<void>}
   *
   * @tests apps/web/store/slices/__tests__/data.test.js
   *   - "fetchLearned - success"
   *   - "fetchLearned - error handling"
   */
  fetchLearned: async () => {
    try {
      const data = await api.get("/learned");
      set({ learned: (data.learned as unknown[]) || [] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Failed to fetch learned:", msg);
      set({ error: `Failed to load learned entries: ${msg}` });
    }
  },

  /**
   * @description Delete a learned entry (with password)
   *
   * Removes a learned entry. Requires admin password confirmation via prompt.
   *
   * @upstream Called by: Delete button in memory tab
   * @downstream Calls: api.delete('/learned/:id'), addLog, fetchLearned
   *
   * @param {string} id - Learned entry ID
   * @returns {Promise<boolean>} True if delete succeeded, false otherwise
   *
   * @tests apps/web/store/slices/__tests__/data.test.js
   *   - "deleteLearning - success with password"
   *   - "deleteLearning - cancels without password"
   *   - "deleteLearning - error handling"
   *
   * @note Requires admin password (prompted via window.prompt)
   */
  deleteLearning: async (id: string) => {
    const { addLog, fetchLearned } = get();
    const password = prompt("Enter admin password to delete learning:");
    if (!password) {
      addLog("❌ Password required for delete");
      return false;
    }
    try {
      await api.delete(`/learned/${id}`, { password });
      addLog("🗑️ Learning deleted");
      await fetchLearned();
      return true;
    } catch (err: unknown) {
      addLog(
        `❌ Delete failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  },

  /**
   * @description Fetch open questions
   *
   * Retrieves questions Clio is currently holding or exploring.
   *
   * @upstream Called by: fetchAll, memory tab initialization
   * @downstream Calls: api.get('/questions'), setQuestions
   *
   * @returns {Promise<void>}
   *
   * @tests apps/web/store/slices/__tests__/data.test.js
   *   - "fetchQuestions - success"
   *   - "fetchQuestions - error handling"
   */
  fetchQuestions: async () => {
    try {
      const data = await api.get("/questions");
      set({ questions: (data.questions as unknown[]) || [] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Failed to fetch questions:", msg);
      set({ error: `Failed to load questions: ${msg}` });
    }
  },

  /**
   * @description Fetch gallery images
   *
   * Retrieves all art gallery images with metadata (type, prompt, vaulted status).
   *
   * @upstream Called by: fetchAll, gallery tab initialization
   * @downstream Calls: api.get('/gallery'), setGalleryImages
   *
   * @returns {Promise<void>}
   *
   * @tests apps/web/store/slices/__tests__/data.test.js
   *   - "fetchGalleryImages - success"
   *   - "fetchGalleryImages - maps response structure"
   *   - "fetchGalleryImages - error handling"
   */
  fetchGalleryImages: async () => {
    try {
      const data: Record<string, unknown> = await api.get(
        "/gallery?limit=100&include_vaulted=true",
      );
      const images = (
        (data.images as Array<Record<string, unknown>>) || []
      ).map(
        (img) =>
          ({
            id: img.id as number,
            type: img.type as string,
            content: img.image as string,
            internal: (img.prompt as string) || null,
            created_at: img.createdAt as string,
            blurred: img.blurred as boolean,
            vaulted: img.vaulted as boolean,
            _lastUpdated: Date.now(),
          }) as GalleryImage,
      );
      set({ galleryImages: images as GalleryImage[] });
    } catch (err: unknown) {
      console.error(
        "Failed to fetch gallery images:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  /**
   * @description Fetch memory branches
   *
   * Retrieves all memory branch configurations (main, experimental, etc.).
   *
   * @upstream Called by: fetchAll, editor tab initialization
   * @downstream Calls: api.get('/branches'), setBranches
   *
   * @returns {Promise<void>}
   *
   * @tests apps/web/store/slices/__tests__/data.test.js
   *   - "fetchBranches - success"
   *   - "fetchBranches - error handling"
   */
  fetchBranches: async () => {
    try {
      const data = await api.get("/branches");
      set({ branches: (data.branches as unknown[]) || [] });
    } catch (err: unknown) {
      console.error(
        "Failed to fetch branches:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  /**
   * @description Fetch synthetic memories
   *
   * Retrieves memories injected into a branch that don't exist in canonical history.
   *
   * @upstream Called by: fetchAll, editor tab initialization
   * @downstream Calls: api.get('/memory/synthetic'), setSyntheticMemories
   *
   * @returns {Promise<void>}
   *
   * @tests apps/web/store/slices/__tests__/data.test.js
   *   - "fetchSyntheticMemories - success"
   *   - "fetchSyntheticMemories - error handling"
   */
  fetchSyntheticMemories: async () => {
    try {
      const data = await api.get("/memory/synthetic");
      set({ syntheticMemories: (data.synthetics as unknown[]) || [] });
    } catch (err: unknown) {
      console.error(
        "Failed to fetch synthetic memories:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  /**
   * @description Fetch all personas
   *
   * Retrieves all persona definitions and identifies the active one.
   *
   * @upstream Called by: fetchAll, settings tab initialization
   * @downstream Calls: api.get('/personas'), setPersonas, setActivePersona
   *
   * @returns {Promise<void>}
   *
   * @tests apps/web/store/slices/__tests__/data.test.js
   *   - "fetchPersonas - success"
   *   - "fetchPersonas - sets active persona"
   *   - "fetchPersonas - error handling"
   */
  fetchPersonas: async () => {
    try {
      const data: Record<string, unknown> = await api.get("/personas");
      set({ personas: (data.personas as PersonaRecord[]) || [] });
      const active = ((data.personas as PersonaRecord[]) || []).find(
        (p) => p.isActive,
      );
      if (active) {
        set({ activePersona: active as PersonaRecord });
      }
    } catch (err: unknown) {
      console.error(
        "Failed to fetch personas:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  /**
   * @description Fetch currently active persona
   *
   * Retrieves only the active persona via dedicated endpoint.
   *
   * @upstream Called by: Persona checking, initialization
   * @downstream Calls: api.get('/personas/active'), setActivePersona
   *
   * @returns {Promise<void>}
   *
   * @tests apps/web/store/slices/__tests__/data.test.js
   *   - "fetchActivePersona - success"
   *   - "fetchActivePersona - null when none active"
   *   - "fetchActivePersona - error handling"
   */
  fetchActivePersona: async () => {
    try {
      const data = await api.get("/personas/active");
      set({ activePersona: (data.persona as PersonaRecord) || null });
    } catch (err: unknown) {
      console.error(
        "Failed to fetch active persona:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  /**
   * @description Switch to a different persona
   *
   * Activates a persona by ID and refreshes all data.
   *
   * @upstream Called by: Persona selector in settings
   * @downstream Calls: api.put('/personas/:id/activate'), addLog, fetchPersonas, fetchAll
   *
   * @param {string|number} personaId - ID of persona to activate
   * @returns {Promise<boolean>} True if switch succeeded
   *
   * @tests apps/web/store/slices/__tests__/data.test.js
   *   - "switchPersona - success"
   *   - "switchPersona - refreshes data"
   *   - "switchPersona - error handling"
   */
  switchPersona: async (personaId: string | number) => {
    const { addLog, fetchPersonas, fetchAll } = get();
    try {
      await api.put(`/personas/${personaId}/activate`);
      addLog(`🔄 Switched to persona #${personaId}`);
      await fetchPersonas();
      await fetchAll();
      return true;
    } catch (err: unknown) {
      addLog(
        `❌ Failed to switch persona: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  },

  /**
   * @description Create a new persona
   *
   * Creates a new persona with name and optional configuration.
   * Requires admin password.
   *
   * @upstream Called by: Create persona form in settings
   * @downstream Calls: api.post('/personas'), addLog, fetchPersonas
   *
   * @param {string} name - Persona name
   * @param {string} password - Admin password
   * @param {Object} [options={}] - Additional persona options
   * @returns {Promise<Object|null>} Created persona object or null on failure
   *
   * @tests apps/web/store/slices/__tests__/data.test.js
   *   - "createPersona - success"
   *   - "createPersona - requires password"
   *   - "createPersona - error handling"
   */
  createPersona: async (name: string, password: string, options = {}) => {
    const { addLog, fetchPersonas } = get();
    if (!password) {
      addLog("❌ Password required to create persona");
      return null;
    }
    try {
      const data = await api.post("/personas", {
        name,
        password,
        ...options,
      });
      addLog(`✅ Created persona: ${name}`);
      await fetchPersonas();
      return data.persona;
    } catch (err: unknown) {
      addLog(
        `❌ Failed to create persona: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  },

  /**
   * @description Fetch pricing configuration
   *
   * Retrieves model pricing, cache costs, and batch discounts for UI display.
   *
   * @upstream Called by: fetchAll, cost calculation
   * @downstream Calls: api.get('/pricing'), setPricingConfig
   *
   * @returns {Promise<void>}
   *
   * @tests apps/web/store/slices/__tests__/data.test.js
   *   - "fetchPricing - success"
   *   - "fetchPricing - error handling"
   */
  fetchPricing: async () => {
    const { setPricingConfig } = get();
    try {
      const data = await api.get("/pricing");
      setPricingConfig(data);
    } catch (err: unknown) {
      console.error(
        "Failed to fetch pricing:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  // ===========================================================================
  // COORDINATED FETCH
  // ===========================================================================

  /**
   * @description Fetch all data in parallel with smart tab-conditional loading
   *
   * Initiates loading state and fetches:
   * - Always: state, history, pricing, personas, cold storage, notebook, summaries, reminders, observations, learned, questions
   * - Conditional: gallery (if visited), editor data (if visited)
   *
   * This is the main initialization fetch that runs when UI first loads.
   *
   * @upstream Called by: App initialization, refresh handlers
   * @downstream Calls: All individual fetch functions, setIsLoading
   *
   * @returns {Promise<void>}
   *
   * @tests apps/web/store/slices/__tests__/data.test.js
   *   - "fetchAll - fetches core data"
   *   - "fetchAll - conditionally fetches gallery"
   *   - "fetchAll - conditionally fetches editor"
   *   - "fetchAll - always sets loading state"
   *   - "fetchAll - clears loading on error"
   *
   * @note Uses Promise.all for parallel fetching (max efficiency)
   * @note Respects visitedTabs state (lazy loading optimization)
   */
  fetchAll: async () => {
    const {
      visitedTabs,
      fetchState,
      fetchHistory,
      fetchColdStorage,
      fetchNotebook,
      fetchSummaries,
      fetchReminders,
      fetchObservations,
      fetchLearned,
      fetchQuestions,
      fetchGalleryImages,
      fetchBranches,
      fetchSyntheticMemories,
      fetchVoiceHistory,
      fetchTTSModel,
      fetchTTSCredits,
      fetchPricing,
      fetchPersonas,
    } = get();

    set({ isLoading: true });
    try {
      const coreFetches = [
        fetchState(),
        fetchHistory(),
        fetchPricing(),
        fetchPersonas(),
        fetchColdStorage(),
        fetchNotebook(),
        fetchSummaries(),
        fetchReminders(),
        fetchObservations(),
        fetchLearned(),
        fetchQuestions(),
      ];

      if (visitedTabs.has("media")) {
        coreFetches.push(fetchGalleryImages());
      }

      if (visitedTabs.has("editor")) {
        coreFetches.push(fetchBranches(), fetchSyntheticMemories());
      }

      if (visitedTabs.has("voice")) {
        coreFetches.push(
          fetchVoiceHistory(),
          fetchTTSModel(),
          fetchTTSCredits(),
        );
      }

      await Promise.all(coreFetches);
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * @description Fetch tab-specific data on first tab visit (lazy loading)
   *
   * Called from setActiveTab when a tab is visited for the first time.
   * Different tabs load different data:
   * - memory: cold storage, notebook, summaries, reminders, observations, learned, questions
   * - media: media images
   * - editor: branches, synthetic memories
   * - voice: voice history, TTS config/credits, glossary, transcriptions
   * - chat/settings/sim: no special fetch
   *
   * @upstream Called by: setActiveTab (on first visit), setActiveTab direct calls
   * @downstream Calls: Tab-specific fetch functions, addLog
   *
   * @param {string} tab - Tab identifier ('chat' | 'settings' | 'media' | 'memory' | 'editor' | 'voice' | 'sim')
   * @returns {Promise<void>}
   *
   * @tests apps/web/store/slices/__tests__/data.test.js
   *   - "fetchTabData - memory tab loads memory data"
   *   - "fetchTabData - media tab loads images"
   *   - "fetchTabData - editor tab loads branches"
   *   - "fetchTabData - chat/settings skip fetch"
   *   - "fetchTabData - unknown tab warns"
   *   - "fetchTabData - error handling"
   *
   * @example
   * // Called automatically by setActiveTab on first visit
   * setActiveTab('media'); // Triggers fetchTabData('media')
   */
  fetchTabData: async (tab: string) => {
    const {
      fetchColdStorage,
      fetchNotebook,
      fetchSummaries,
      fetchReminders,
      fetchObservations,
      fetchLearned,
      fetchQuestions,
      fetchGalleryImages,
      fetchBranches,
      fetchSyntheticMemories,
      fetchVoiceHistory,
      fetchTTSModel,
      fetchTTSCredits,
      fetchGlossary,
      fetchVoiceTranscriptions,
      addLog,
    } = get();

    try {
      switch (tab) {
        case "memory":
          addLog("📚 Loading memory data...");
          await Promise.all([
            fetchColdStorage(),
            fetchNotebook(),
            fetchSummaries(),
            fetchReminders(),
            fetchObservations(),
            fetchLearned(),
            fetchQuestions(),
          ]);
          break;

        case "media":
          addLog("🖼️ Loading media...");
          await fetchGalleryImages();
          break;

        case "editor":
          addLog("✏️ Loading editor data...");
          await Promise.all([fetchBranches(), fetchSyntheticMemories()]);
          break;

        case "voice":
          addLog("ðŸŽ¤ Loading voice tools...");
          await Promise.all([
            fetchVoiceHistory(),
            fetchTTSModel(),
            fetchTTSCredits(),
            fetchGlossary(),
            fetchVoiceTranscriptions(),
          ]);
          break;

        case "chat":
        case "settings":
        case "sim":
          break;

        default:
          console.warn(`Unknown tab: ${tab}`);
      }
    } catch (err: unknown) {
      console.error(
        `Failed to fetch ${tab} data:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  },

  // ===========================================================================
  // METER ACTIONS
  // ===========================================================================

  /**
   * Save batch meter changes via API.
   * Components call this store action instead of calling api directly.
   *
   * @param changes - Map of meter name to { from, to } values
   * @returns API result on success, undefined on failure
   */
  saveMeterChanges: async (
    changes: Record<string, { from: number; to: number }>,
  ) => {
    try {
      const result = await api.setMetersBatch(changes);
      return result;
    } catch (error: unknown) {
      console.error("Failed to save meter changes:", error);
      throw error;
    }
  },
});
