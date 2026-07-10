/**
 * Unit tests for summaries slice
 *
 * @module tests/store/slices/summaries
 * @description Tests for createSummariesSlice - summary selection, meta-summarization,
 * manual summarization, tier operations (promote/demote/activate/archive), and positioning.
 *
 * @covers apps/web/store/slices/summaries.js
 *   - toggleSummarySelection() - toggle individual summary in/out of selection
 *   - clearSelectedSummaries() - clear all selections
 *   - triggerMetasummarize() - consolidate 2+ summaries, requires validation
 *   - triggerSummarize() - debounced manual summarization (3s min interval)
 *   - promoteSummary() - move to Block 2
 *   - demoteSummary() - remove from Block 2
 *   - activateSummary() - RAG Archive → Dynamic Tail
 *   - archiveSummary() - Dynamic Tail → RAG Archive
 *   - setSummaryPosition() - drag-and-drop positioning
 *
 * When summaries.js changes, validate:
 * - Selection state updates correctly (Set operations)
 * - Meta-summarization validates minimum 2 selections
 * - Summarization debounce enforces 3s interval
 * - Tier operations call correct endpoints and refresh data
 * - Position updates persist to backend
 * - All async operations handle errors gracefully
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { create } from 'zustand';
import { createSummariesSlice } from '../summaries';

// Mock the API client
vi.mock('../../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import api from '../../../api/client';

// Create a test store with just the summaries slice
const createTestStore = () => create((set, get) => ({
  ...createSummariesSlice(set, get),
  // Mock dependencies from other slices
  addLog: vi.fn(),
  fetchSummaries: vi.fn(),
  fetchHistory: vi.fn(),
  // Mock settings slice properties for triggerSummarize
  lastSummarizeTime: 0,
  setIsSummarizing: vi.fn(),
  setLastSummarizeTime: vi.fn(),
  setSummarizeSuccess: vi.fn(),
}));

describe('Summaries Slice', () => {
  let store;

  beforeEach(() => {
    store = createTestStore();
    vi.clearAllMocks();
  });

  // ===========================================================================
  // SELECTION STATE
  // ===========================================================================

  describe('toggleSummarySelection', () => {
    it('adds summary ID to selection', () => {
      const { getState } = store;
      const { toggleSummarySelection } = getState();

      toggleSummarySelection(42);

      const selected = getState().selectedSummaries;
      expect(selected.has(42)).toBe(true);
      expect(selected.size).toBe(1);
    });

    it('removes summary ID if already selected', () => {
      const { getState, setState } = store;
      const { toggleSummarySelection } = getState();

      setState({ selectedSummaries: new Set([42, 43]) });

      toggleSummarySelection(42);

      const selected = getState().selectedSummaries;
      expect(selected.has(42)).toBe(false);
      expect(selected.has(43)).toBe(true);
      expect(selected.size).toBe(1);
    });

    it('handles multiple toggles', () => {
      const { getState } = store;
      const { toggleSummarySelection } = getState();

      toggleSummarySelection(1);
      toggleSummarySelection(2);
      toggleSummarySelection(3);
      toggleSummarySelection(2); // Deselect 2

      const selected = getState().selectedSummaries;
      expect(selected.has(1)).toBe(true);
      expect(selected.has(2)).toBe(false);
      expect(selected.has(3)).toBe(true);
      expect(selected.size).toBe(2);
    });
  });

  describe('clearSelectedSummaries', () => {
    it('clears all selections', () => {
      const { getState, setState } = store;
      const { clearSelectedSummaries } = getState();

      setState({ selectedSummaries: new Set([1, 2, 3, 4, 5]) });

      clearSelectedSummaries();

      const selected = getState().selectedSummaries;
      expect(selected.size).toBe(0);
    });
  });

  // ===========================================================================
  // META-SUMMARIZATION
  // ===========================================================================

  describe('triggerMetasummarize', () => {
    it('requires at least 2 summaries selected', async () => {
      const { getState, setState } = store;
      const { triggerMetasummarize } = getState();

      // No selection
      await triggerMetasummarize();
      expect(api.post).not.toHaveBeenCalled();
      expect(getState().addLog).toHaveBeenCalledWith('❌ Select at least 2 summaries to consolidate');

      // Only 1 selected
      setState({ selectedSummaries: new Set([42]) });
      await triggerMetasummarize();
      expect(api.post).not.toHaveBeenCalled();
      expect(getState().addLog).toHaveBeenCalledWith('❌ Select at least 2 summaries to consolidate');
    });

    it('consolidates selected summaries', async () => {
      const { getState, setState } = store;
      const { triggerMetasummarize } = getState();

      setState({ selectedSummaries: new Set([1, 2, 3]) });

      const result = {
        newSummaryId: 100,
        landedIn: 'Dynamic Tail',
        archivedIds: [1, 2],
        archivedTo: 'RAG Archive',
        summariesBefore: 50,
        summariesAfter: 49,
        durationMs: 1234
      };

      api.post.mockResolvedValueOnce(result);

      await triggerMetasummarize();

      expect(api.post).toHaveBeenCalledWith('/metasummarize', { ids: [1, 2, 3] });
      expect(getState().addLog).toHaveBeenCalledWith('📊 Consolidating 3 summaries...');
      expect(getState().addLog).toHaveBeenCalledWith('✅ Created #100 → Dynamic Tail');
      expect(getState().addLog).toHaveBeenCalledWith('   Archived: [1, 2] → RAG Archive');
      expect(getState().addLog).toHaveBeenCalledWith('   Active: 50 → 49 (1234ms)');
      expect(getState().selectedSummaries.size).toBe(0); // Cleared
      expect(getState().fetchSummaries).toHaveBeenCalled();
      expect(getState().fetchHistory).toHaveBeenCalled();
    });

    it('sets loading state during consolidation', async () => {
      const { getState, setState } = store;
      const { triggerMetasummarize } = getState();

      setState({ selectedSummaries: new Set([1, 2]) });

      let loadingDuringCall = false;
      api.post.mockImplementation(async () => {
        loadingDuringCall = getState().isMetasummarizing;
        return { newSummaryId: 100, landedIn: 'Block 2', summariesBefore: 10, summariesAfter: 9, durationMs: 500 };
      });

      await triggerMetasummarize();

      expect(loadingDuringCall).toBe(true);
      expect(getState().isMetasummarizing).toBe(false); // Reset after
    });

    it('logs error on failure and clears loading', async () => {
      const { getState, setState } = store;
      const { triggerMetasummarize } = getState();

      setState({ selectedSummaries: new Set([1, 2]) });

      api.post.mockRejectedValueOnce(new Error('Consolidation failed'));

      await triggerMetasummarize();

      expect(getState().addLog).toHaveBeenCalledWith('❌ Consolidation failed: Consolidation failed');
      expect(getState().isMetasummarizing).toBe(false);
    });
  });

  // ===========================================================================
  // MANUAL SUMMARIZATION
  // ===========================================================================

  describe('triggerSummarize', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('enforces 3 second debounce', async () => {
      const { getState, setState } = store;
      const { triggerSummarize } = getState();

      const now = Date.now();
      setState({ lastSummarizeTime: now - 1000 }); // 1 second ago

      await triggerSummarize(50);

      expect(api.post).not.toHaveBeenCalled();
      expect(getState().addLog).toHaveBeenCalledWith(expect.stringContaining('Please wait'));
      expect(getState().addLog).toHaveBeenCalledWith(expect.stringContaining('2s before starting'));
    });

    it('allows summarization after 3 seconds', async () => {
      const { getState, setState } = store;
      const { triggerSummarize } = getState();

      const now = Date.now();
      setState({ lastSummarizeTime: now - 4000 }); // 4 seconds ago

      api.post.mockResolvedValueOnce({ success: true, count: 50 });

      await triggerSummarize(50);

      expect(api.post).toHaveBeenCalledWith('/summarize', { count: 50, force: false, notes: undefined });
      expect(getState().setIsSummarizing).toHaveBeenCalledWith(true);
      expect(getState().setLastSummarizeTime).toHaveBeenCalled();
    });

    it('handles successful summarization', async () => {
      const { getState, setState } = store;
      const { triggerSummarize } = getState();

      setState({ lastSummarizeTime: 0 });

      api.post.mockResolvedValueOnce({ success: true, count: 50 });

      await triggerSummarize(50);

      expect(getState().addLog).toHaveBeenCalledWith('📦 Starting summarization of 50 history entries...');
      expect(getState().addLog).toHaveBeenCalledWith('✅ SUCCESS: Summarized 50 entries into 1 summary');
      expect(getState().setSummarizeSuccess).toHaveBeenCalledWith(true);
      expect(getState().fetchHistory).toHaveBeenCalled();
      expect(getState().fetchSummaries).toHaveBeenCalled();

      // Auto-clear success after 3s
      vi.advanceTimersByTime(3000);
      expect(getState().setSummarizeSuccess).toHaveBeenCalledWith(false);
    });

    it('handles force flag and notes', async () => {
      const { getState, setState } = store;
      const { triggerSummarize } = getState();

      setState({ lastSummarizeTime: 0 });

      api.post.mockResolvedValueOnce({ success: true, count: 100 });

      await triggerSummarize(100, true, 'Focus on system behavior');

      expect(api.post).toHaveBeenCalledWith('/summarize', {
        count: 100,
        force: true,
        notes: 'Focus on system behavior'
      });
    });

    it('handles API error response', async () => {
      const { getState, setState } = store;
      const { triggerSummarize } = getState();

      setState({ lastSummarizeTime: 0 });

      api.post.mockResolvedValueOnce({ success: false, error: 'Not enough entries' });

      await triggerSummarize(50);

      expect(getState().addLog).toHaveBeenCalledWith('❌ FAILED: Summarization error: Not enough entries');
      expect(getState().setSummarizeSuccess).not.toHaveBeenCalledWith(true);
    });

    it('handles exception', async () => {
      const { getState, setState } = store;
      const { triggerSummarize } = getState();

      setState({ lastSummarizeTime: 0 });

      api.post.mockRejectedValueOnce(new Error('Network error'));

      await triggerSummarize(50);

      expect(getState().addLog).toHaveBeenCalledWith('❌ ERROR: Summarization failed: Network error');
    });

    it('clears loading state in finally block', async () => {
      const { getState, setState } = store;
      const { triggerSummarize } = getState();

      setState({ lastSummarizeTime: 0 });

      api.post.mockRejectedValueOnce(new Error('Test'));

      await triggerSummarize(50);

      expect(getState().setIsSummarizing).toHaveBeenCalledWith(false);
    });
  });

  // ===========================================================================
  // TIER OPERATIONS
  // ===========================================================================

  describe('promoteSummary', () => {
    it('promotes summary to Block 2', async () => {
      const { getState } = store;
      const { promoteSummary } = getState();

      api.post.mockResolvedValueOnce({ success: true });

      await promoteSummary(42);

      expect(api.post).toHaveBeenCalledWith('/summaries/42/promote');
      expect(getState().addLog).toHaveBeenCalledWith('⭐ Promoted summary #42 to Block 2');
      expect(getState().fetchSummaries).toHaveBeenCalled();
    });

    it('logs error and rethrows on failure', async () => {
      const { getState } = store;
      const { promoteSummary } = getState();

      api.post.mockRejectedValueOnce(new Error('Promote failed'));

      await expect(promoteSummary(42)).rejects.toThrow('Promote failed');
      expect(getState().addLog).toHaveBeenCalledWith('❌ Failed to promote summary: Promote failed');
    });
  });

  describe('demoteSummary', () => {
    it('demotes summary from Block 2', async () => {
      const { getState } = store;
      const { demoteSummary } = getState();

      api.post.mockResolvedValueOnce({ success: true });

      await demoteSummary(42);

      expect(api.post).toHaveBeenCalledWith('/summaries/42/demote');
      expect(getState().addLog).toHaveBeenCalledWith('↩️ Demoted summary #42 from Block 2');
      expect(getState().fetchSummaries).toHaveBeenCalled();
    });

    it('logs error and rethrows on failure', async () => {
      const { getState } = store;
      const { demoteSummary } = getState();

      api.post.mockRejectedValueOnce(new Error('Demote failed'));

      await expect(demoteSummary(42)).rejects.toThrow('Demote failed');
      expect(getState().addLog).toHaveBeenCalledWith('❌ Failed to demote summary: Demote failed');
    });
  });

  describe('activateSummary', () => {
    it('activates summary from RAG Archive', async () => {
      const { getState } = store;
      const { activateSummary } = getState();

      api.post.mockResolvedValueOnce({ success: true });

      await activateSummary(42);

      expect(api.post).toHaveBeenCalledWith('/summaries/42/activate');
      expect(getState().addLog).toHaveBeenCalledWith('📤 Activated summary #42 (moved from RAG Archive to Dynamic Tail)');
      expect(getState().fetchSummaries).toHaveBeenCalled();
    });

    it('logs error and rethrows on failure', async () => {
      const { getState } = store;
      const { activateSummary } = getState();

      api.post.mockRejectedValueOnce(new Error('Activate failed'));

      await expect(activateSummary(42)).rejects.toThrow('Activate failed');
      expect(getState().addLog).toHaveBeenCalledWith('❌ Failed to activate summary: Activate failed');
    });
  });

  describe('archiveSummary', () => {
    it('archives summary to RAG Archive', async () => {
      const { getState } = store;
      const { archiveSummary } = getState();

      api.post.mockResolvedValueOnce({ success: true });

      await archiveSummary(42);

      expect(api.post).toHaveBeenCalledWith('/summaries/42/archive');
      expect(getState().addLog).toHaveBeenCalledWith('📥 Archived summary #42 (moved from Dynamic Tail to RAG Archive)');
      expect(getState().fetchSummaries).toHaveBeenCalled();
    });

    it('logs error and rethrows on failure', async () => {
      const { getState } = store;
      const { archiveSummary } = getState();

      api.post.mockRejectedValueOnce(new Error('Archive failed'));

      await expect(archiveSummary(42)).rejects.toThrow('Archive failed');
      expect(getState().addLog).toHaveBeenCalledWith('❌ Failed to archive summary: Archive failed');
    });
  });

  // ===========================================================================
  // POSITIONING
  // ===========================================================================

  describe('setSummaryPosition', () => {
    it('updates summary position', async () => {
      const { getState } = store;
      const { setSummaryPosition } = getState();

      const position = 1707000000000;

      api.post.mockResolvedValueOnce({ success: true });

      await setSummaryPosition(42, position);

      expect(api.post).toHaveBeenCalledWith('/summaries/42/position', { position });
      expect(getState().addLog).toHaveBeenCalledWith(`🔄 Set summary #42 position to ${position}`);
      expect(getState().fetchSummaries).toHaveBeenCalled();
    });

    it('handles current timestamp', async () => {
      const { getState } = store;
      const { setSummaryPosition } = getState();

      const now = Date.now();

      api.post.mockResolvedValueOnce({ success: true });

      await setSummaryPosition(42, now);

      expect(api.post).toHaveBeenCalledWith('/summaries/42/position', { position: now });
    });

    it('logs error and rethrows on failure', async () => {
      const { getState } = store;
      const { setSummaryPosition } = getState();

      api.post.mockRejectedValueOnce(new Error('Position update failed'));

      await expect(setSummaryPosition(42, 123456)).rejects.toThrow('Position update failed');
      expect(getState().addLog).toHaveBeenCalledWith('❌ Failed to set summary position: Position update failed');
    });
  });
});
