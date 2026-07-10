/**
 * Unit tests for data fetching slice
 *
 * @module tests/store/slices/data
 * @description Tests for createDataSlice - all async data fetching and state
 * management for history, cold storage, notebook, summaries, reminders,
 * observations, learned, questions, gallery, branches, personas, etc.
 *
 * @covers apps/web/store/slices/data.js
 *   - Direct setters (setState, setHistory, etc.)
 *   - Fetch actions (fetchState, fetchHistory, etc.)
 *   - Async operations with error handling
 *   - Persona management (switchPersona, createPersona)
 *   - Coordinated fetching (fetchAll, fetchTabData)
 *
 * When data.js changes, validate:
 * - API calls use correct endpoints
 * - State updates match API response structure
 * - Error handling logs without throwing
 * - History pagination state is maintained
 * - fetchAll respects visitedTabs
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { create } from 'zustand';
import { createDataSlice } from '../data';

// Mock the api client
vi.mock('../../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  WORKER_URL: 'http://test.worker.dev',
}));

import api from '../../../api/client';

// Create a test store with data slice + minimal mocks
const createTestStore = () => create((set, get) => ({
  ...createDataSlice(set, get),
  // Mock dependencies from other slices
  visitedTabs: new Set(['chat']),
  addLog: vi.fn(),
  setError: vi.fn(),
}));

describe('Data Fetching Slice', () => {
  let store;

  beforeEach(() => {
    store = createTestStore();
    vi.clearAllMocks();
  });

  // =========================================================================
  // DIRECT SETTERS
  // =========================================================================

  describe('direct setters', () => {
    it('setState sets state object', () => {
      const { getState } = store;
      const { setState } = getState();

      const stateObj = { isRunning: true, loopCount: 5 };
      setState(stateObj);
      expect(getState().state).toEqual(stateObj);
    });

    it('setHistory sets history array', () => {
      const { getState } = store;
      const { setHistory } = getState();

      const history = [
        { id: 1, type: 'thought' },
        { id: 2, type: 'message' },
      ];
      setHistory(history);
      expect(getState().history).toEqual(history);
    });

    it('setColdStorage sets cold storage', () => {
      const { getState } = store;
      const { setColdStorage } = getState();

      const items = [{ id: 1, content: 'permanent memory' }];
      setColdStorage(items);
      expect(getState().coldStorage).toEqual(items);
    });

    it('setNotebook sets notebook entries', () => {
      const { getState } = store;
      const { setNotebook } = getState();

      const notebook = [{ id: 1, title: 'Note 1' }];
      setNotebook(notebook);
      expect(getState().notebook).toEqual(notebook);
    });

    it('setReminders sets reminders', () => {
      const { getState } = store;
      const { setReminders } = getState();

      const reminders = [{ id: 1, content: 'Reminder 1' }];
      setReminders(reminders);
      expect(getState().reminders).toEqual(reminders);
    });

    it('setPersonas sets personas', () => {
      const { getState } = store;
      const { setPersonas } = getState();

      const personas = [{ id: 1, name: 'Claude' }];
      setPersonas(personas);
      expect(getState().personas).toEqual(personas);
    });
  });

  // =========================================================================
  // FETCH STATE
  // =========================================================================

  describe('fetchState', () => {
    it('fetches state and updates store', async () => {
      const stateData = {
        isRunning: true,
        loopCount: 10,
        cycleIntervalSeconds: 60,
        summarizeThreshold: 30,
        selectedModel: 'claude-sonnet-4-6-20250514',
      };

      api.get.mockResolvedValueOnce(stateData);

      const { getState } = store;
      await getState().fetchState();

      expect(api.get).toHaveBeenCalledWith('/state');
      expect(getState().state).toEqual(stateData);
    });

    it('handles fetch errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      api.get.mockRejectedValueOnce(new Error('Network error'));

      const { getState } = store;
      await getState().fetchState();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch state:',
        'Network error'
      );

      consoleSpy.mockRestore();
    });
  });

  // =========================================================================
  // FETCH HISTORY
  // =========================================================================

  describe('fetchHistory', () => {
    it('fetches history with default limit', async () => {
      const historyData = {
        history: [{ id: 1, type: 'thought' }],
        total: 100,
        limit: 100,
        offset: 0,
        hasMore: false,
      };

      api.get.mockResolvedValueOnce(historyData);

      const { getState } = store;
      await getState().fetchHistory();

      expect(api.get).toHaveBeenCalledWith('/history?limit=100');
      expect(getState().history).toEqual(historyData.history);
      expect(getState().historyPagination.total).toBe(100);
      expect(getState().historyPagination.hasMore).toBe(false);
    });

    it('fetches history with custom limit', async () => {
      const historyData = {
        history: [{ id: 1 }],
        total: 200,
        limit: 50,
        offset: 0,
        hasMore: true,
      };

      api.get.mockResolvedValueOnce(historyData);

      const { getState } = store;
      await getState().fetchHistory(50);

      expect(api.get).toHaveBeenCalledWith('/history?limit=50');
      expect(getState().historyPagination.limit).toBe(50);
    });

    it('handles missing history data', async () => {
      api.get.mockResolvedValueOnce({});

      const { getState } = store;
      await getState().fetchHistory();

      expect(getState().history).toEqual([]);
      expect(getState().historyPagination.total).toBe(0);
    });
  });

  // =========================================================================
  // LOAD MORE HISTORY
  // =========================================================================

  describe('loadMoreHistory', () => {
    it('appends history when hasMore is true', async () => {
      const { getState } = store;

      // Setup initial history
      getState().setHistory([{ id: 1 }]);
      store.setState({
        historyPagination: {
          total: 200,
          limit: 50,
          offset: 0,
          hasMore: true,
        },
      });

      const newData = {
        history: [{ id: 51 }, { id: 52 }],
        total: 200,
        limit: 50,
        offset: 50,
        hasMore: true,
      };

      api.get.mockResolvedValueOnce(newData);

      await getState().loadMoreHistory();

      expect(getState().history).toHaveLength(3);
      expect(getState().history[0].id).toBe(1);
      expect(getState().history[2].id).toBe(52);
      expect(getState().historyPagination.offset).toBe(50);
    });

    it('does nothing when hasMore is false', async () => {
      const { getState } = store;

      store.setState({
        historyPagination: {
          total: 50,
          limit: 50,
          offset: 0,
          hasMore: false,
        },
      });

      await getState().loadMoreHistory();

      expect(api.get).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // FETCH DATA FUNCTIONS
  // =========================================================================

  describe('individual fetch functions', () => {
    it('fetchColdStorage fetches cold storage', async () => {
      const data = { coldStorage: [{ id: 1, content: 'memory' }] };
      api.get.mockResolvedValueOnce(data);

      const { getState } = store;
      await getState().fetchColdStorage();

      expect(api.get).toHaveBeenCalledWith('/cold-storage');
      expect(getState().coldStorage).toEqual(data.coldStorage);
    });

    it('fetchNotebook fetches notebook', async () => {
      const data = { notebook: [{ id: 1, title: 'Note' }] };
      api.get.mockResolvedValueOnce(data);

      const { getState } = store;
      await getState().fetchNotebook();

      expect(api.get).toHaveBeenCalledWith('/notebook');
      expect(getState().notebook).toEqual(data.notebook);
    });

    it('fetchSummaries separates active and archived', async () => {
      const data = {
        active: [{ id: 1, content: 'active summary' }],
        archived: [{ id: 2, content: 'archived summary' }],
      };
      api.get.mockResolvedValueOnce(data);

      const { getState } = store;
      await getState().fetchSummaries();

      expect(api.get).toHaveBeenCalledWith('/summaries?include_archived=true');
      expect(getState().summaries).toEqual(data.active);
      // Note: data.js doesn't set archivedSummaries, just summaries and checking the spread
    });

    it('fetchReminders fetches reminders', async () => {
      const data = { reminders: [{ id: 1, content: 'Reminder' }] };
      api.get.mockResolvedValueOnce(data);

      const { getState } = store;
      await getState().fetchReminders();

      expect(api.get).toHaveBeenCalledWith('/reminders');
      expect(getState().reminders).toEqual(data.reminders);
    });

    it('fetchObservations fetches observations', async () => {
      const data = { observations: [{ id: 1, title: 'Observation' }] };
      api.get.mockResolvedValueOnce(data);

      const { getState } = store;
      await getState().fetchObservations();

      expect(api.get).toHaveBeenCalledWith('/observations');
      expect(getState().observations).toEqual(data.observations);
    });

    it('fetchLearned fetches learned entries', async () => {
      const data = { learned: [{ id: 1, content: 'I know this' }] };
      api.get.mockResolvedValueOnce(data);

      const { getState } = store;
      await getState().fetchLearned();

      expect(api.get).toHaveBeenCalledWith('/learned');
      expect(getState().learned).toEqual(data.learned);
    });

    it('fetchQuestions fetches questions', async () => {
      const data = { questions: [{ id: 1, content: 'Question?' }] };
      api.get.mockResolvedValueOnce(data);

      const { getState } = store;
      await getState().fetchQuestions();

      expect(api.get).toHaveBeenCalledWith('/questions');
      expect(getState().questions).toEqual(data.questions);
    });
  });

  // =========================================================================
  // DELETE LEARNING
  // =========================================================================

  describe('deleteLearning', () => {
    beforeEach(() => {
      global.prompt = vi.fn();
    });

    it('deletes learning with password', async () => {
      const mockFetchLearned = vi.fn();
      store.setState({ fetchLearned: mockFetchLearned });

      global.prompt.mockReturnValueOnce('admin-password');
      api.delete.mockResolvedValueOnce({});

      const { getState } = store;
      const result = await getState().deleteLearning(123);

      expect(api.delete).toHaveBeenCalledWith('/learned/123', {
        password: 'admin-password',
      });
      expect(result).toBe(true);
      expect(mockFetchLearned).toHaveBeenCalled();
    });

    it('cancels without password', async () => {
      const mockAddLog = vi.fn();
      store.setState({ addLog: mockAddLog });

      global.prompt.mockReturnValueOnce(null);

      const { getState } = store;
      const result = await getState().deleteLearning(123);

      expect(result).toBe(false);
      expect(api.delete).not.toHaveBeenCalled();
      expect(mockAddLog).toHaveBeenCalledWith(
        '❌ Password required for delete'
      );
    });

    it('handles delete errors', async () => {
      const mockAddLog = vi.fn();
      store.setState({ addLog: mockAddLog });

      global.prompt.mockReturnValueOnce('wrong-password');
      api.delete.mockRejectedValueOnce(new Error('Unauthorized'));

      const { getState } = store;
      const result = await getState().deleteLearning(123);

      expect(result).toBe(false);
      expect(mockAddLog).toHaveBeenCalledWith(
        '❌ Delete failed: Unauthorized'
      );
    });
  });

  // =========================================================================
  // GALLERY & BRANCHES
  // =========================================================================

  describe('fetchGalleryImages', () => {
    it('maps API response to gallery format', async () => {
      const apiData = {
        images: [
          {
            id: 1,
            type: 'art',
            image: 'data:image/png;...',
            prompt: 'a sunset',
            createdAt: '2026-01-01',
            blurred: false,
            vaulted: false,
          },
        ],
      };

      api.get.mockResolvedValueOnce(apiData);

      const { getState } = store;
      await getState().fetchGalleryImages();

      const images = getState().galleryImages;
      expect(images[0].id).toBe(1);
      expect(images[0].type).toBe('art');
      expect(images[0].content).toBe(apiData.images[0].image);
      expect(images[0].internal).toBe('a sunset');
      expect(images[0]._lastUpdated).toBeDefined();
    });
  });

  describe('fetchBranches', () => {
    it('fetches memory branches', async () => {
      const data = { branches: [{ id: 1, name: 'main' }] };
      api.get.mockResolvedValueOnce(data);

      const { getState } = store;
      await getState().fetchBranches();

      expect(api.get).toHaveBeenCalledWith('/branches');
      expect(getState().branches).toEqual(data.branches);
    });
  });

  describe('fetchSyntheticMemories', () => {
    it('fetches synthetic memories', async () => {
      const data = { synthetics: [{ id: 1, content: 'synthetic' }] };
      api.get.mockResolvedValueOnce(data);

      const { getState } = store;
      await getState().fetchSyntheticMemories();

      expect(api.get).toHaveBeenCalledWith('/memory/synthetic');
      expect(getState().syntheticMemories).toEqual(data.synthetics);
    });
  });

  // =========================================================================
  // PERSONAS
  // =========================================================================

  describe('persona management', () => {
    it('fetchPersonas sets active persona', async () => {
      const data = {
        personas: [
          { id: 1, name: 'Persona A', isActive: false },
          { id: 2, name: 'Persona B', isActive: true },
        ],
      };

      api.get.mockResolvedValueOnce(data);

      const { getState } = store;
      await getState().fetchPersonas();

      expect(getState().personas).toEqual(data.personas);
      expect(getState().activePersona.id).toBe(2);
    });

    it('switchPersona activates and refreshes', async () => {
      const mockFetchPersonas = vi.fn();
      const mockFetchAll = vi.fn();
      const mockAddLog = vi.fn();

      store.setState({
        fetchPersonas: mockFetchPersonas,
        fetchAll: mockFetchAll,
        addLog: mockAddLog,
      });

      api.put.mockResolvedValueOnce({});

      const { getState } = store;
      const result = await getState().switchPersona(5);

      expect(api.put).toHaveBeenCalledWith('/personas/5/activate');
      expect(mockFetchPersonas).toHaveBeenCalled();
      expect(mockFetchAll).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('createPersona requires password', async () => {
      const mockAddLog = vi.fn();
      store.setState({ addLog: mockAddLog });

      const { getState } = store;
      const result = await getState().createPersona('Test', null);

      expect(result).toBeNull();
      expect(mockAddLog).toHaveBeenCalledWith(
        '❌ Password required to create persona'
      );
    });

    it('createPersona creates and fetches', async () => {
      const mockFetchPersonas = vi.fn();
      const mockAddLog = vi.fn();
      const persona = { id: 5, name: 'Test' };

      store.setState({
        fetchPersonas: mockFetchPersonas,
        addLog: mockAddLog,
      });

      api.post.mockResolvedValueOnce({ persona });

      const { getState } = store;
      const result = await getState().createPersona('Test', 'password');

      expect(api.post).toHaveBeenCalledWith('/personas', {
        name: 'Test',
        password: 'password',
      });
      expect(result).toEqual(persona);
      expect(mockFetchPersonas).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // PRICING
  // =========================================================================

  describe('fetchPricing', () => {
    it('fetches pricing config', async () => {
      const mockSetPricingConfig = vi.fn();
      store.setState({ setPricingConfig: mockSetPricingConfig });

      const pricingData = {
        models: { 'claude-3': { input: 3, output: 15 } },
      };

      api.get.mockResolvedValueOnce(pricingData);

      const { getState } = store;
      await getState().fetchPricing();

      expect(api.get).toHaveBeenCalledWith('/pricing');
      expect(mockSetPricingConfig).toHaveBeenCalledWith(pricingData);
    });
  });

  // =========================================================================
  // COORDINATED FETCH
  // =========================================================================

  describe('fetchAll', () => {
    it('fetches core data', async () => {
      const mockFetches = {
        fetchState: vi.fn(),
        fetchHistory: vi.fn(),
        fetchColdStorage: vi.fn(),
        fetchNotebook: vi.fn(),
        fetchSummaries: vi.fn(),
        fetchReminders: vi.fn(),
        fetchObservations: vi.fn(),
        fetchLearned: vi.fn(),
        fetchQuestions: vi.fn(),
        fetchGalleryImages: vi.fn(),
        fetchBranches: vi.fn(),
        fetchSyntheticMemories: vi.fn(),
        fetchPricing: vi.fn(),
        fetchPersonas: vi.fn(),
      };

      store.setState(mockFetches);

      const { getState } = store;
      await getState().fetchAll();

      expect(mockFetches.fetchState).toHaveBeenCalled();
      expect(mockFetches.fetchHistory).toHaveBeenCalled();
      expect(mockFetches.fetchPricing).toHaveBeenCalled();
      expect(mockFetches.fetchColdStorage).toHaveBeenCalled();
    });

    it('conditionally fetches media if visited', async () => {
      const mockFetchGalleryImages = vi.fn();
      const mockFetches = {
        visitedTabs: new Set(['chat', 'media']),
        fetchState: vi.fn(),
        fetchHistory: vi.fn(),
        fetchColdStorage: vi.fn(),
        fetchNotebook: vi.fn(),
        fetchSummaries: vi.fn(),
        fetchReminders: vi.fn(),
        fetchObservations: vi.fn(),
        fetchLearned: vi.fn(),
        fetchQuestions: vi.fn(),
        fetchGalleryImages: mockFetchGalleryImages,
        fetchBranches: vi.fn(),
        fetchSyntheticMemories: vi.fn(),
        fetchPricing: vi.fn(),
        fetchPersonas: vi.fn(),
      };

      store.setState(mockFetches);

      const { getState } = store;
      await getState().fetchAll();

      expect(mockFetchGalleryImages).toHaveBeenCalled();
    });

    it('conditionally fetches voice data if visited', async () => {
      const mockFetchVoiceHistory = vi.fn();
      const mockFetchTTSModel = vi.fn();
      const mockFetchTTSCredits = vi.fn();
      const mockFetches = {
        visitedTabs: new Set(['chat', 'voice']),
        fetchState: vi.fn(),
        fetchHistory: vi.fn(),
        fetchColdStorage: vi.fn(),
        fetchNotebook: vi.fn(),
        fetchSummaries: vi.fn(),
        fetchReminders: vi.fn(),
        fetchObservations: vi.fn(),
        fetchLearned: vi.fn(),
        fetchQuestions: vi.fn(),
        fetchGalleryImages: vi.fn(),
        fetchBranches: vi.fn(),
        fetchSyntheticMemories: vi.fn(),
        fetchVoiceHistory: mockFetchVoiceHistory,
        fetchTTSModel: mockFetchTTSModel,
        fetchTTSCredits: mockFetchTTSCredits,
        fetchPricing: vi.fn(),
        fetchPersonas: vi.fn(),
      };

      store.setState(mockFetches);

      const { getState } = store;
      await getState().fetchAll();

      expect(mockFetchVoiceHistory).toHaveBeenCalled();
      expect(mockFetchTTSModel).toHaveBeenCalled();
      expect(mockFetchTTSCredits).toHaveBeenCalled();
    });

    it('sets loading state', async () => {
      const mockFetches = {
        fetchState: vi.fn().mockResolvedValue(undefined),
        fetchHistory: vi.fn().mockResolvedValue(undefined),
        fetchColdStorage: vi.fn().mockResolvedValue(undefined),
        fetchNotebook: vi.fn().mockResolvedValue(undefined),
        fetchSummaries: vi.fn().mockResolvedValue(undefined),
        fetchReminders: vi.fn().mockResolvedValue(undefined),
        fetchObservations: vi.fn().mockResolvedValue(undefined),
        fetchLearned: vi.fn().mockResolvedValue(undefined),
        fetchQuestions: vi.fn().mockResolvedValue(undefined),
        fetchGalleryImages: vi.fn().mockResolvedValue(undefined),
        fetchBranches: vi.fn().mockResolvedValue(undefined),
        fetchSyntheticMemories: vi.fn().mockResolvedValue(undefined),
        fetchPricing: vi.fn().mockResolvedValue(undefined),
        fetchPersonas: vi.fn().mockResolvedValue(undefined),
      };

      store.setState(mockFetches);

      const { getState } = store;

      expect(getState().isLoading).toBe(false);

      const fetchPromise = getState().fetchAll();

      // Loading should be true during fetch
      expect(getState().isLoading).toBe(true);

      await fetchPromise;

      // Loading should be false after
      expect(getState().isLoading).toBe(false);
    });
  });

  // =========================================================================
  // TAB-SPECIFIC DATA LOADING
  // =========================================================================

  describe('fetchTabData', () => {
    it('memory tab loads memory data', async () => {
      const mockFetches = {
        fetchColdStorage: vi.fn(),
        fetchNotebook: vi.fn(),
        fetchSummaries: vi.fn(),
        fetchReminders: vi.fn(),
        fetchObservations: vi.fn(),
        fetchLearned: vi.fn(),
        fetchQuestions: vi.fn(),
        addLog: vi.fn(),
      };

      store.setState(mockFetches);

      const { getState } = store;
      await getState().fetchTabData('memory');

      expect(mockFetches.fetchColdStorage).toHaveBeenCalled();
      expect(mockFetches.fetchNotebook).toHaveBeenCalled();
      expect(mockFetches.fetchSummaries).toHaveBeenCalled();
      expect(mockFetches.addLog).toHaveBeenCalledWith('📚 Loading memory data...');
    });

    it('media tab loads media images', async () => {
      const mockFetches = {
        fetchGalleryImages: vi.fn(),
        addLog: vi.fn(),
      };

      store.setState(mockFetches);

      const { getState } = store;
      await getState().fetchTabData('media');

      expect(mockFetches.fetchGalleryImages).toHaveBeenCalled();
      expect(mockFetches.addLog).toHaveBeenCalledWith('🖼️ Loading media...');
    });

    it('editor tab loads branches and synthetics', async () => {
      const mockFetches = {
        fetchBranches: vi.fn(),
        fetchSyntheticMemories: vi.fn(),
        addLog: vi.fn(),
      };

      store.setState(mockFetches);

      const { getState } = store;
      await getState().fetchTabData('editor');

      expect(mockFetches.fetchBranches).toHaveBeenCalled();
      expect(mockFetches.fetchSyntheticMemories).toHaveBeenCalled();
    });

    it('voice tab loads voice tooling data', async () => {
      const mockFetches = {
        fetchVoiceHistory: vi.fn(),
        fetchTTSModel: vi.fn(),
        fetchTTSCredits: vi.fn(),
        fetchGlossary: vi.fn(),
        fetchVoiceTranscriptions: vi.fn(),
        addLog: vi.fn(),
      };

      store.setState(mockFetches);

      const { getState } = store;
      await getState().fetchTabData('voice');

      expect(mockFetches.fetchVoiceHistory).toHaveBeenCalled();
      expect(mockFetches.fetchTTSModel).toHaveBeenCalled();
      expect(mockFetches.fetchTTSCredits).toHaveBeenCalled();
      expect(mockFetches.fetchGlossary).toHaveBeenCalled();
      expect(mockFetches.fetchVoiceTranscriptions).toHaveBeenCalled();
      expect(mockFetches.addLog).toHaveBeenCalledWith('ðŸŽ¤ Loading voice tools...');
    });

    it('chat/settings/sim tabs skip fetch', async () => {
      const mockFetches = {
        fetchColdStorage: vi.fn(),
        addLog: vi.fn(),
      };

      store.setState(mockFetches);

      const { getState } = store;
      await getState().fetchTabData('chat');
      await getState().fetchTabData('settings');
      await getState().fetchTabData('sim');

      expect(mockFetches.fetchColdStorage).not.toHaveBeenCalled();
    });

    it('unknown tab warns', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      store.setState({ addLog: vi.fn() });

      const { getState } = store;
      await getState().fetchTabData('unknown-tab');

      expect(consoleSpy).toHaveBeenCalledWith('Unknown tab: unknown-tab');

      consoleSpy.mockRestore();
    });
  });
});
