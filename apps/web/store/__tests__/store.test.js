/**
 * @module tests/store
 * @description Unit tests for Zustand global state store
 *
 * Test coverage:
 * - Initial state values
 * - Synchronous setters (UI state)
 * - Direct data setters (API response data)
 * - Async fetch functions (API calls)
 * - fetchAll parallel execution
 * - Error handling in async functions
 *
 * @covers src/store/index.js
 *   - useAppStore() - Store creation and hook export
 *   - Initial state: activeTab='chat', isThinking=false, isLoading=false, error=null
 *   - Sync setters: setActiveTab, setIsThinking, setIsLoading, setError, clearError
 *   - Data setters: setHistory, setColdStorage, setNotebook, setState, etc.
 *   - Async fetchers: fetchState, fetchHistory, fetchColdStorage, fetchNotebook
 *   - fetchAll: Parallel execution with isLoading state management
 *
 * @fixtures None (uses mock API)
 * @mocks src/api/client.js
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { act } from "@testing-library/react";

// Mock the API client before importing store
vi.mock("../../api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    fetchRaw: vi.fn(),
  },
}));

// Import after mocking
import { useAppStore, __migratePersistedState } from "../index";
import api from "../../api/client";

// =============================================================================
// TEST SETUP
// =============================================================================

/**
 * Reset store to initial state between tests
 * Zustand stores persist across tests, so we need to manually reset
 */
function resetStore() {
  useAppStore.setState({
    // Core data
    state: null,
    history: [],
    coldStorage: [],
    notebook: [],
    summaries: [],
    reminders: [],
    observations: [],
    learned: [],
    questions: [],
    galleryImages: [],
    branches: [],
    syntheticMemories: [],
    // UI state
    activeTab: "chat",
    isThinking: false,
    isLoading: false,
    error: null,
  });
}

describe("Zustand Store", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  // ===========================================================================
  // INITIAL STATE TESTS
  // ===========================================================================

  describe("initial state", () => {
    it("should have correct initial UI state values", () => {
      const state = useAppStore.getState();

      expect(state.activeTab).toBe("chat");
      expect(state.isThinking).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(null);
    });

    it("should have empty arrays for core data", () => {
      const state = useAppStore.getState();

      expect(state.history).toEqual([]);
      expect(state.coldStorage).toEqual([]);
      expect(state.notebook).toEqual([]);
      expect(state.summaries).toEqual([]);
      expect(state.reminders).toEqual([]);
      expect(state.observations).toEqual([]);
      expect(state.learned).toEqual([]);
      expect(state.questions).toEqual([]);
      expect(state.galleryImages).toEqual([]);
      expect(state.branches).toEqual([]);
      expect(state.syntheticMemories).toEqual([]);
    });

    it("should have null for state object initially", () => {
      const state = useAppStore.getState();
      expect(state.state).toBe(null);
    });

    it("should expose all expected actions", () => {
      const state = useAppStore.getState();

      // Sync actions
      expect(typeof state.setActiveTab).toBe("function");
      expect(typeof state.setIsThinking).toBe("function");
      // setIsLoading removed in Phase 3 — isLoading is set internally by fetchAll
      expect(typeof state.setError).toBe("function");
      expect(typeof state.clearError).toBe("function");

      // Data setters
      expect(typeof state.setHistory).toBe("function");
      expect(typeof state.setColdStorage).toBe("function");
      expect(typeof state.setNotebook).toBe("function");

      // Async actions
      expect(typeof state.fetchState).toBe("function");
      expect(typeof state.fetchHistory).toBe("function");
      expect(typeof state.fetchColdStorage).toBe("function");
      expect(typeof state.fetchNotebook).toBe("function");
      expect(typeof state.fetchAll).toBe("function");
    });
  });

  // ===========================================================================
  // SYNCHRONOUS SETTERS TESTS
  // ===========================================================================

  describe("synchronous setters - UI state", () => {
    describe("setActiveTab", () => {
      beforeEach(() => {
        useAppStore.setState({ fetchTabData: vi.fn() });
      });

      it("should update activeTab value", () => {
        const { setActiveTab } = useAppStore.getState();

        act(() => {
          setActiveTab("settings");
        });

        expect(useAppStore.getState().activeTab).toBe("settings");
      });

      it("should accept all valid tab values", () => {
        const { setActiveTab } = useAppStore.getState();
        // Legacy values ('gallery' etc) are normalized by setActiveTab; only current ActiveView here.
        const tabs = ["chat", "settings", "memory", "editor", "media", "voice", "sim"];

        tabs.forEach((tab) => {
          act(() => {
            setActiveTab(tab);
          });
          expect(useAppStore.getState().activeTab).toBe(tab);
        });
      });

      it("should normalize legacy and invalid tab ids at write site", () => {
        const { setActiveTab } = useAppStore.getState();

        act(() => {
          setActiveTab("gallery");
        });
        expect(useAppStore.getState().activeTab).toBe("media");

        act(() => {
          setActiveTab("voice");
        });
        expect(useAppStore.getState().activeTab).toBe("voice");

        act(() => {
          setActiveTab("monitor");
        });
        expect(useAppStore.getState().activeTab).toBe("sim");

        act(() => {
          setActiveTab("nonexistent-view");
        });
        expect(useAppStore.getState().activeTab).toBe("chat");
      });
    });

    describe("setIsThinking", () => {
      it("should set isThinking to true", () => {
        const { setIsThinking } = useAppStore.getState();

        act(() => {
          setIsThinking(true);
        });

        expect(useAppStore.getState().isThinking).toBe(true);
      });

      it("should set isThinking to false", () => {
        // First set to true
        useAppStore.setState({ isThinking: true });

        const { setIsThinking } = useAppStore.getState();

        act(() => {
          setIsThinking(false);
        });

        expect(useAppStore.getState().isThinking).toBe(false);
      });
    });

    // setIsLoading was removed in Phase 3 — isLoading is managed internally by fetchAll
    // See fetchAll tests for isLoading behavior coverage

    describe("setError / clearError", () => {
      it("should set error message", () => {
        const { setError } = useAppStore.getState();

        act(() => {
          setError("Something went wrong");
        });

        expect(useAppStore.getState().error).toBe("Something went wrong");
      });

      it("should clear error with null", () => {
        useAppStore.setState({ error: "Previous error" });
        const { setError } = useAppStore.getState();

        act(() => {
          setError(null);
        });

        expect(useAppStore.getState().error).toBe(null);
      });

      it("should clear error with clearError()", () => {
        useAppStore.setState({ error: "Previous error" });
        const { clearError } = useAppStore.getState();

        act(() => {
          clearError();
        });

        expect(useAppStore.getState().error).toBe(null);
      });
    });
  });

  // ===========================================================================
  // DATA SETTERS TESTS
  // ===========================================================================

  describe("data setters", () => {
    it("should set history array", () => {
      const { setHistory } = useAppStore.getState();
      const mockHistory = [
        { id: 1, type: "thought", content: "Test" },
        { id: 2, type: "user_message", content: "Hello" },
      ];

      act(() => {
        setHistory(mockHistory);
      });

      expect(useAppStore.getState().history).toEqual(mockHistory);
    });

    it("should set coldStorage array", () => {
      const { setColdStorage } = useAppStore.getState();
      const mockColdStorage = [
        { id: 1, content: "Memory 1" },
        { id: 2, content: "Memory 2" },
      ];

      act(() => {
        setColdStorage(mockColdStorage);
      });

      expect(useAppStore.getState().coldStorage).toEqual(mockColdStorage);
    });

    it("should set notebook array", () => {
      const { setNotebook } = useAppStore.getState();
      const mockNotebook = [{ id: 1, title: "Note 1", content: "Content 1" }];

      act(() => {
        setNotebook(mockNotebook);
      });

      expect(useAppStore.getState().notebook).toEqual(mockNotebook);
    });

    it("should set state object", () => {
      const { setState: setStoreState } = useAppStore.getState();
      const mockState = {
        isRunning: true,
        loopCount: 42,
        intervalSeconds: 60,
      };

      act(() => {
        setStoreState(mockState);
      });

      expect(useAppStore.getState().state).toEqual(mockState);
    });

    it("should set branches array", () => {
      const { setBranches } = useAppStore.getState();
      const mockBranches = [
        { id: 1, name: "canonical", is_active: true },
        { id: 2, name: "experiment", is_active: false },
      ];

      act(() => {
        setBranches(mockBranches);
      });

      expect(useAppStore.getState().branches).toEqual(mockBranches);
    });

    it("should replace entire arrays, not merge", () => {
      const { setHistory } = useAppStore.getState();

      act(() => {
        setHistory([{ id: 1 }, { id: 2 }]);
      });
      expect(useAppStore.getState().history).toHaveLength(2);

      act(() => {
        setHistory([{ id: 3 }]);
      });
      expect(useAppStore.getState().history).toHaveLength(1);
      expect(useAppStore.getState().history[0].id).toBe(3);
    });
  });

  // ===========================================================================
  // ASYNC FETCH FUNCTIONS TESTS
  // ===========================================================================

  describe("async fetch functions", () => {
    describe("fetchState", () => {
      it("should fetch and set state from API", async () => {
        const mockStateData = {
          isRunning: true,
          loopCount: 100,
          intervalSeconds: 60,
        };
        api.get.mockResolvedValue(mockStateData);

        const { fetchState } = useAppStore.getState();
        await fetchState();

        expect(api.get).toHaveBeenCalledWith("/state");
        expect(useAppStore.getState().state).toEqual(mockStateData);
      });

      it("should log error on API failure without throwing", async () => {
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});
        api.get.mockRejectedValue(new Error("Network error"));

        const { fetchState } = useAppStore.getState();
        await fetchState(); // Should not throw

        expect(consoleSpy).toHaveBeenCalledWith(
          "Failed to fetch state:",
          "Network error",
        );
        expect(useAppStore.getState().state).toBe(null); // Unchanged

        consoleSpy.mockRestore();
      });
    });

    describe("fetchHistory", () => {
      it("should fetch history with default limit", async () => {
        const mockHistoryData = {
          history: [{ id: 1, type: "thought" }],
        };
        api.get.mockResolvedValue(mockHistoryData);

        const { fetchHistory } = useAppStore.getState();
        await fetchHistory();

        expect(api.get).toHaveBeenCalledWith("/history?limit=100");
        expect(useAppStore.getState().history).toEqual(mockHistoryData.history);
      });

      it("should fetch history with custom limit", async () => {
        api.get.mockResolvedValue({ history: [] });

        const { fetchHistory } = useAppStore.getState();
        await fetchHistory(50);

        expect(api.get).toHaveBeenCalledWith("/history?limit=50");
      });

      it("should handle missing history property in response", async () => {
        api.get.mockResolvedValue({}); // No history property

        const { fetchHistory } = useAppStore.getState();
        await fetchHistory();

        expect(useAppStore.getState().history).toEqual([]);
      });

      it("should log error on API failure", async () => {
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});
        api.get.mockRejectedValue(new Error("Server error"));

        const { fetchHistory } = useAppStore.getState();
        await fetchHistory();

        expect(consoleSpy).toHaveBeenCalledWith(
          "Failed to fetch history:",
          "Server error",
        );

        consoleSpy.mockRestore();
      });
    });

    describe("fetchColdStorage", () => {
      it("should fetch and set cold storage", async () => {
        const mockData = {
          coldStorage: [{ id: 1, content: "Important memory" }],
        };
        api.get.mockResolvedValue(mockData);

        const { fetchColdStorage } = useAppStore.getState();
        await fetchColdStorage();

        expect(api.get).toHaveBeenCalledWith("/cold-storage");
        expect(useAppStore.getState().coldStorage).toEqual(
          mockData.coldStorage,
        );
      });

      it("should handle empty response", async () => {
        api.get.mockResolvedValue({});

        const { fetchColdStorage } = useAppStore.getState();
        await fetchColdStorage();

        expect(useAppStore.getState().coldStorage).toEqual([]);
      });
    });

    describe("fetchNotebook", () => {
      it("should fetch and set notebook entries", async () => {
        const mockData = {
          notebook: [{ id: 1, title: "Note", content: "Content" }],
        };
        api.get.mockResolvedValue(mockData);

        const { fetchNotebook } = useAppStore.getState();
        await fetchNotebook();

        expect(api.get).toHaveBeenCalledWith("/notebook");
        expect(useAppStore.getState().notebook).toEqual(mockData.notebook);
      });
    });
  });

  // ===========================================================================
  // FETCH ALL TESTS
  // ===========================================================================

  describe("fetchAll", () => {
    it("should set isLoading true during fetch", async () => {
      // Track isLoading state during fetch
      let loadingDuringFetch = false;

      api.get.mockImplementation(() => {
        loadingDuringFetch = useAppStore.getState().isLoading;
        return Promise.resolve({});
      });

      const { fetchAll } = useAppStore.getState();
      await fetchAll();

      expect(loadingDuringFetch).toBe(true);
    });

    it("should set isLoading false after fetch completes", async () => {
      api.get.mockResolvedValue({});

      const { fetchAll } = useAppStore.getState();
      await fetchAll();

      expect(useAppStore.getState().isLoading).toBe(false);
    });

    it("should call all fetch functions in parallel", async () => {
      api.get.mockResolvedValue({});

      // Ensure visitedTabs includes media/editor so fetchAll includes those calls (see data.ts conditional)
      useAppStore.setState({ visitedTabs: new Set(["chat", "media", "editor"]) });

      const { fetchAll } = useAppStore.getState();
      await fetchAll();

      // Core data fetches (always loaded)
      expect(api.get).toHaveBeenCalledWith("/state");
      expect(api.get).toHaveBeenCalledWith("/history?limit=100");
      expect(api.get).toHaveBeenCalledWith("/pricing");
      expect(api.get).toHaveBeenCalledWith("/personas");
      // Memory tab fetches
      expect(api.get).toHaveBeenCalledWith("/cold-storage");
      expect(api.get).toHaveBeenCalledWith("/notebook");
      expect(api.get).toHaveBeenCalledWith("/summaries?include_archived=true");
      expect(api.get).toHaveBeenCalledWith("/reminders");
      expect(api.get).toHaveBeenCalledWith("/observations");
      expect(api.get).toHaveBeenCalledWith("/learned");
      expect(api.get).toHaveBeenCalledWith("/questions");
      // Gallery tab fetches
      expect(api.get).toHaveBeenCalledWith(
        "/gallery?limit=100&include_vaulted=true",
      );
      // Editor tab fetches
      expect(api.get).toHaveBeenCalledWith("/branches");
      expect(api.get).toHaveBeenCalledWith("/memory/synthetic");
      expect(api.get).toHaveBeenCalledTimes(14);
    });

    it("should set isLoading false even if some fetches fail", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      api.get.mockImplementation((url) => {
        if (url === "/state") {
          return Promise.reject(new Error("State error"));
        }
        return Promise.resolve({});
      });

      const { fetchAll } = useAppStore.getState();
      await fetchAll();

      expect(useAppStore.getState().isLoading).toBe(false);

      consoleSpy.mockRestore();
    });

    it("should populate multiple state values", async () => {
      api.get.mockImplementation((url) => {
        switch (url) {
          case "/state":
            return Promise.resolve({ isRunning: true, loopCount: 5 });
          case "/history?limit=100":
            return Promise.resolve({ history: [{ id: 1 }] });
          case "/cold-storage":
            return Promise.resolve({ coldStorage: [{ id: 2 }] });
          case "/notebook":
            return Promise.resolve({ notebook: [{ id: 3 }] });
          default:
            return Promise.resolve({});
        }
      });

      const { fetchAll } = useAppStore.getState();
      await fetchAll();

      const state = useAppStore.getState();
      expect(state.state).toEqual({ isRunning: true, loopCount: 5 });
      expect(state.history).toEqual([{ id: 1 }]);
      expect(state.coldStorage).toEqual([{ id: 2 }]);
      expect(state.notebook).toEqual([{ id: 3 }]);
    });
  });

  // ===========================================================================
  // STORE SUBSCRIPTION TESTS
  // ===========================================================================

  describe("store subscriptions", () => {
    it("should notify subscribers on state change", () => {
      const listener = vi.fn();
      const unsubscribe = useAppStore.subscribe(listener);

      act(() => {
        useAppStore.getState().setActiveTab("media");
      });

      expect(listener).toHaveBeenCalled();

      unsubscribe();
    });

    it("should allow selective subscriptions with subscribeWithSelector", () => {
      // Zustand v4 subscribe() only takes a listener function
      // Selective subscriptions require the subscribeWithSelector middleware
      // or manual comparison in the listener. We test basic subscription works.
      let callCount = 0;
      let lastActiveTab = null;

      const unsubscribe = useAppStore.subscribe((state) => {
        // Manual selector pattern
        if (state.activeTab !== lastActiveTab) {
          lastActiveTab = state.activeTab;
          callCount++;
        }
      });

      // Change activeTab - should trigger our manual selector
      act(() => {
        useAppStore.getState().setActiveTab("settings");
      });

      expect(callCount).toBe(1);
      expect(lastActiveTab).toBe("settings");

      // Change something else - should NOT increment callCount (activeTab unchanged)
      act(() => {
        useAppStore.getState().setIsThinking(true);
      });

      expect(callCount).toBe(1); // Still 1, activeTab didn't change

      unsubscribe();
    });
  });

  // ===========================================================================
  // PERSIST MIGRATION TESTS
  // ===========================================================================

  describe("persist migration (legacy activeTab)", () => {
    it("should map legacy persisted activeTab values via migrate", () => {
      // Simulate what zustand persist migrate receives for old partial state
      let persisted;

      persisted = { activeTab: "gallery" };
      let result = __migratePersistedState(persisted, 0);
      expect(result.activeTab).toBe("media");

      persisted = { activeTab: "voice" };
      result = __migratePersistedState(persisted, 0);
      expect(result.activeTab).toBe("voice");

      persisted = { activeTab: "monitor" };
      result = __migratePersistedState(persisted, 0);
      expect(result.activeTab).toBe("sim");

      persisted = { activeTab: "weird-old-value" };
      result = __migratePersistedState(persisted, 0);
      expect(result.activeTab).toBe("chat");

      // valid stays
      persisted = { activeTab: "media" };
      result = __migratePersistedState(persisted, 1);
      expect(result.activeTab).toBe("media");

      // falsy becomes chat
      persisted = { activeTab: null };
      result = __migratePersistedState(persisted, 0);
      expect(result.activeTab).toBe("chat");
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe("edge cases", () => {
    it("should handle setting empty arrays", () => {
      // First populate with data
      useAppStore.setState({
        history: [{ id: 1 }],
        coldStorage: [{ id: 2 }],
      });

      const { setHistory, setColdStorage } = useAppStore.getState();

      act(() => {
        setHistory([]);
        setColdStorage([]);
      });

      expect(useAppStore.getState().history).toEqual([]);
      expect(useAppStore.getState().coldStorage).toEqual([]);
    });

    it("should handle rapid sequential updates", () => {
      const { setActiveTab } = useAppStore.getState();

      act(() => {
        setActiveTab("chat");
        setActiveTab("settings");
        setActiveTab("media");
        setActiveTab("memory");
        setActiveTab("editor");
      });

      expect(useAppStore.getState().activeTab).toBe("editor");
    });

    it("should preserve other state when updating one value", () => {
      useAppStore.setState({
        activeTab: "media",
        isThinking: true,
        error: "Some error",
      });

      const { setActiveTab } = useAppStore.getState();

      act(() => {
        setActiveTab("chat");
      });

      const state = useAppStore.getState();
      expect(state.activeTab).toBe("chat");
      expect(state.isThinking).toBe(true);
      expect(state.error).toBe("Some error");
    });
  });
});
