/**
 * Unit tests for editor slice
 *
 * @module tests/store/slices/editor
 * @description Tests for createEditorSlice - memory branch management, bulk operations,
 * memory editing, synthetic memories, and personality export/import.
 *
 * @covers apps/web/store/slices/editor.js
 *   - Branch actions: switchBranch, createBranch, forkBranch, resetBranchToCanonical, deleteBranch
 *   - Bulk operation queue: startBulkOperation, endBulkOperation (concurrency guard)
 *   - Memory editing: excludeMemories, includeMemories, openEditModal, closeEditModal, saveMemoryEdit, deleteMemoryPermanently
 *   - Synthetic memories: openSyntheticForm, openSyntheticEdit, closeSyntheticForm, saveSyntheticMemory, deleteSyntheticMemory
 *   - Export/Import: exportPersonality, previewImport, importPersonality, clearImport, readImportFile
 *
 * When editor.js changes, validate:
 * - Branch operations maintain active branch state correctly
 * - Bulk operation queue prevents concurrent edits
 * - Memory exclusions are non-destructive (use overrides)
 * - Synthetic form handles art types vs text types properly
 * - Export/import validates password for destructive modes
 * - FileReader mock handles async file reading correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { create } from 'zustand';
import { createEditorSlice } from '../editor';

// Mock API client
vi.mock('../../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '../../../api/client';

// Create a test store with editor slice and mock dependencies
const createTestStore = () => create((set, get) => ({
  ...createEditorSlice(set, get),
  // Mock cross-slice dependencies
  addLog: vi.fn(),
  fetchBranches: vi.fn(),
  fetchAll: vi.fn(),
  fetchHistory: vi.fn(),
  fetchSyntheticMemories: vi.fn(),
}));

describe('Editor Slice', () => {
  let store;

  beforeEach(() => {
    store = createTestStore();
    vi.clearAllMocks();
  });

  // =========================================================================
  // BRANCH ACTIONS
  // =========================================================================

  describe('branch actions', () => {
    describe('switchBranch', () => {
      it('activates branch and refetches data', async () => {
        const { getState } = store;
        const { switchBranch } = getState();
        const addLog = vi.fn();
        const fetchAll = vi.fn();
        store.setState({ addLog, fetchAll });

        api.put.mockResolvedValue({});

        await switchBranch('experimental');

        expect(api.put).toHaveBeenCalledWith('/branches/experimental/activate');
        expect(getState().activeBranch).toBe('experimental');
        expect(addLog).toHaveBeenCalledWith('✅ Switched to experimental');
        expect(fetchAll).toHaveBeenCalled();
      });

      it('handles switch errors', async () => {
        const { getState } = store;
        const { switchBranch } = getState();
        const addLog = vi.fn();
        const fetchAll = vi.fn();
        store.setState({ addLog, fetchAll });

        api.put.mockRejectedValue(new Error('Branch not found'));

        await switchBranch('nonexistent');

        expect(addLog).toHaveBeenCalledWith('❌ Branch switch failed: Branch not found');
        expect(fetchAll).not.toHaveBeenCalled();
      });
    });

    describe('createBranch', () => {
      it('rejects empty branch name', async () => {
        const { getState } = store;
        const { createBranch } = getState();
        const addLog = vi.fn();
        store.setState({ addLog, newBranchName: '' });

        await createBranch();

        expect(addLog).toHaveBeenCalledWith('❌ Branch name required');
        expect(api.post).not.toHaveBeenCalled();
      });

      it('uses parameter over state newBranchName', async () => {
        const { getState } = store;
        const { createBranch } = getState();
        const addLog = vi.fn();
        const fetchBranches = vi.fn();
        store.setState({ addLog, fetchBranches, newBranchName: 'state-name' });

        api.post.mockResolvedValue({});

        await createBranch('param-name', 'Test description');

        expect(api.post).toHaveBeenCalledWith('/branches', { name: 'param-name', description: 'Test description' });
        expect(addLog).toHaveBeenCalledWith('✅ Branch "param-name" created');
        expect(fetchBranches).toHaveBeenCalled();
      });

      it('uses state newBranchName if no parameter', async () => {
        const { getState } = store;
        const { createBranch } = getState();
        const addLog = vi.fn();
        const fetchBranches = vi.fn();
        store.setState({ addLog, fetchBranches, newBranchName: 'state-branch' });

        api.post.mockResolvedValue({});

        await createBranch();

        expect(api.post).toHaveBeenCalledWith('/branches', { name: 'state-branch', description: '' });
        expect(getState().newBranchName).toBe(''); // Cleared after creation
      });

      it('handles creation errors', async () => {
        const { getState } = store;
        const { createBranch } = getState();
        const addLog = vi.fn();
        const fetchBranches = vi.fn();
        store.setState({ addLog, fetchBranches, newBranchName: 'test' });

        api.post.mockRejectedValue(new Error('Branch exists'));

        await createBranch();

        expect(addLog).toHaveBeenCalledWith('❌ Branch creation failed: Branch exists');
      });
    });

    describe('forkBranch', () => {
      it('rejects empty new branch name', async () => {
        const { getState } = store;
        const { forkBranch } = getState();
        const addLog = vi.fn();
        store.setState({ addLog });

        await forkBranch('source', '');

        expect(addLog).toHaveBeenCalledWith('❌ New branch name required');
        expect(api.post).not.toHaveBeenCalled();
      });

      it('forks branch successfully', async () => {
        const { getState } = store;
        const { forkBranch } = getState();
        const addLog = vi.fn();
        const fetchBranches = vi.fn();
        store.setState({ addLog, fetchBranches });

        api.post.mockResolvedValue({});

        await forkBranch('experimental', 'experimental-v2');

        expect(api.post).toHaveBeenCalledWith('/branches/experimental/fork', { name: 'experimental-v2' });
        expect(addLog).toHaveBeenCalledWith('✅ Branch forked to "experimental-v2"');
        expect(fetchBranches).toHaveBeenCalled();
      });

      it('handles fork errors', async () => {
        const { getState } = store;
        const { forkBranch } = getState();
        const addLog = vi.fn();
        const fetchBranches = vi.fn();
        store.setState({ addLog, fetchBranches });

        api.post.mockRejectedValue(new Error('Source not found'));

        await forkBranch('missing', 'new-branch');

        expect(addLog).toHaveBeenCalledWith('❌ Fork failed: Source not found');
      });
    });

    describe('resetBranchToCanonical', () => {
      it('resets branch and refetches data', async () => {
        const { getState } = store;
        const { resetBranchToCanonical } = getState();
        const addLog = vi.fn();
        const fetchBranches = vi.fn();
        const fetchAll = vi.fn();
        store.setState({ addLog, fetchBranches, fetchAll });

        api.post.mockResolvedValue({});

        await resetBranchToCanonical('experimental');

        expect(api.post).toHaveBeenCalledWith('/branches/experimental/reset');
        expect(addLog).toHaveBeenCalledWith('✅ Branch "experimental" reset to canonical');
        expect(fetchBranches).toHaveBeenCalled();
        expect(fetchAll).toHaveBeenCalled();
      });

      it('handles reset errors', async () => {
        const { getState } = store;
        const { resetBranchToCanonical } = getState();
        const addLog = vi.fn();
        store.setState({ addLog });

        api.post.mockRejectedValue(new Error('Reset failed'));

        await resetBranchToCanonical('test');

        expect(addLog).toHaveBeenCalledWith('❌ Branch reset failed: Reset failed');
      });
    });

    describe('deleteBranch', () => {
      it('rejects without password', async () => {
        const { getState } = store;
        const { deleteBranch } = getState();
        const addLog = vi.fn();
        store.setState({ addLog });

        await deleteBranch('test-branch', '');

        expect(addLog).toHaveBeenCalledWith('❌ Password required for delete');
        expect(api.delete).not.toHaveBeenCalled();
      });

      it('deletes branch successfully', async () => {
        const { getState } = store;
        const { deleteBranch } = getState();
        const addLog = vi.fn();
        const fetchBranches = vi.fn();
        store.setState({ addLog, fetchBranches, activeBranch: 'main' });

        api.delete.mockResolvedValue({});

        await deleteBranch('old-branch', 'admin-password');

        expect(api.delete).toHaveBeenCalledWith('/branches/old-branch', { password: 'admin-password' });
        expect(addLog).toHaveBeenCalledWith('✅ Branch "old-branch" deleted');
        expect(fetchBranches).toHaveBeenCalled();
      });

      it('switches to main if deleting active branch', async () => {
        const { getState } = store;
        const { deleteBranch } = getState();
        const addLog = vi.fn();
        const fetchBranches = vi.fn();
        store.setState({ addLog, fetchBranches, activeBranch: 'experimental' });

        api.delete.mockResolvedValue({});

        await deleteBranch('experimental', 'admin-password');

        expect(getState().activeBranch).toBe('main'); // Fallback to main
      });

      it('handles delete errors', async () => {
        const { getState } = store;
        const { deleteBranch } = getState();
        const addLog = vi.fn();
        const fetchBranches = vi.fn();
        store.setState({ addLog, fetchBranches });

        api.delete.mockRejectedValue(new Error('Wrong password'));

        await deleteBranch('test', 'wrong');

        expect(addLog).toHaveBeenCalledWith('❌ Branch delete failed: Wrong password');
      });
    });
  });

  // =========================================================================
  // BULK OPERATION QUEUE
  // =========================================================================

  describe('bulk operation queue', () => {
    it('allows starting operation when not in progress', () => {
      const { getState } = store;
      const { startBulkOperation } = getState();

      const result = startBulkOperation('exclude');

      expect(result).toBe(true);
      expect(getState().activeOperations.has('exclude')).toBe(true);
    });

    it('prevents starting same operation twice', () => {
      const { getState } = store;
      const { startBulkOperation } = getState();

      startBulkOperation('exclude');
      const result = startBulkOperation('exclude');

      expect(result).toBe(false);
    });

    it('allows different operations concurrently', () => {
      const { getState } = store;
      const { startBulkOperation } = getState();

      const result1 = startBulkOperation('exclude');
      const result2 = startBulkOperation('include');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(getState().activeOperations.has('exclude')).toBe(true);
      expect(getState().activeOperations.has('include')).toBe(true);
    });

    it('releases operation lock', () => {
      const { getState } = store;
      const { startBulkOperation, endBulkOperation } = getState();

      startBulkOperation('exclude');
      expect(getState().activeOperations.has('exclude')).toBe(true);

      endBulkOperation('exclude');
      expect(getState().activeOperations.has('exclude')).toBe(false);
    });

    it('allows restarting after end', () => {
      const { getState } = store;
      const { startBulkOperation, endBulkOperation } = getState();

      startBulkOperation('exclude');
      endBulkOperation('exclude');
      const result = startBulkOperation('exclude');

      expect(result).toBe(true);
    });
  });

  // =========================================================================
  // MEMORY EDITING
  // =========================================================================

  describe('memory editing', () => {
    describe('excludeMemories', () => {
      it('rejects empty memories array', async () => {
        const { getState } = store;
        const { excludeMemories } = getState();
        const addLog = vi.fn();
        store.setState({ addLog });

        await excludeMemories([]);

        expect(addLog).toHaveBeenCalledWith('❌ No memories selected');
        expect(api.post).not.toHaveBeenCalled();
      });

      it('prevents concurrent exclude operations', async () => {
        const { getState } = store;
        const { excludeMemories, startBulkOperation } = getState();
        const addLog = vi.fn();
        store.setState({ addLog });

        // Start operation manually
        startBulkOperation('exclude');

        await excludeMemories([{ table: 'history', id: 1 }]);

        expect(addLog).toHaveBeenCalledWith('⚠️ Exclude operation already in progress, please wait...');
        expect(api.post).not.toHaveBeenCalled();
      });

      it('excludes multiple memories successfully', async () => {
        const { getState } = store;
        const { excludeMemories } = getState();
        const addLog = vi.fn();
        const clearSelectedMemories = vi.fn();
        const fetchAll = vi.fn();
        store.setState({ addLog, clearSelectedMemories, fetchAll });

        api.post.mockResolvedValue({});

        const memories = [
          { table: 'history', id: 1 },
          { table: 'cold_storage', id: 2 },
        ];

        await excludeMemories(memories);

        expect(api.post).toHaveBeenCalledTimes(2);
        expect(api.post).toHaveBeenCalledWith('/memory/exclude', { table: 'history', id: 1 });
        expect(api.post).toHaveBeenCalledWith('/memory/exclude', { table: 'cold_storage', id: 2 });
        expect(addLog).toHaveBeenCalledWith('✅ Excluded 2 memories');
        expect(clearSelectedMemories).toHaveBeenCalled();
        expect(fetchAll).toHaveBeenCalled();
        expect(getState().isExcluding).toBe(false);
        expect(getState().activeOperations.has('exclude')).toBe(false);
      });

      it('handles exclude errors and releases lock', async () => {
        const { getState } = store;
        const { excludeMemories } = getState();
        const addLog = vi.fn();
        const clearSelectedMemories = vi.fn();
        const fetchAll = vi.fn();
        store.setState({ addLog, clearSelectedMemories, fetchAll });

        api.post.mockRejectedValue(new Error('DB error'));

        await excludeMemories([{ table: 'history', id: 1 }]);

        expect(addLog).toHaveBeenCalledWith('❌ Exclude failed: DB error');
        expect(getState().isExcluding).toBe(false);
        expect(getState().activeOperations.has('exclude')).toBe(false);
      });
    });

    describe('includeMemories', () => {
      it('rejects empty memories array', async () => {
        const { getState } = store;
        const { includeMemories } = getState();
        const addLog = vi.fn();
        store.setState({ addLog });

        await includeMemories([]);

        expect(addLog).toHaveBeenCalledWith('❌ No memories selected');
        expect(api.post).not.toHaveBeenCalled();
      });

      it('prevents concurrent include operations', async () => {
        const { getState } = store;
        const { includeMemories, startBulkOperation } = getState();
        const addLog = vi.fn();
        store.setState({ addLog });

        startBulkOperation('include');

        await includeMemories([{ table: 'history', id: 1 }]);

        expect(addLog).toHaveBeenCalledWith('⚠️ Include operation already in progress, please wait...');
        expect(api.post).not.toHaveBeenCalled();
      });

      it('includes multiple memories successfully', async () => {
        const { getState } = store;
        const { includeMemories } = getState();
        const addLog = vi.fn();
        const clearSelectedMemories = vi.fn();
        const fetchAll = vi.fn();
        store.setState({ addLog, clearSelectedMemories, fetchAll });

        api.post.mockResolvedValue({});

        const memories = [
          { table: 'history', id: 1 },
          { table: 'cold_storage', id: 2 },
        ];

        await includeMemories(memories);

        expect(api.post).toHaveBeenCalledTimes(2);
        expect(addLog).toHaveBeenCalledWith('✅ Included 2 memories');
        expect(clearSelectedMemories).toHaveBeenCalled();
        expect(fetchAll).toHaveBeenCalled();
        expect(getState().activeOperations.has('include')).toBe(false);
      });

      it('handles include errors and releases lock', async () => {
        const { getState } = store;
        const { includeMemories } = getState();
        const addLog = vi.fn();
        store.setState({ addLog });

        api.post.mockRejectedValue(new Error('API error'));

        await includeMemories([{ table: 'history', id: 1 }]);

        expect(addLog).toHaveBeenCalledWith('❌ Include failed: API error');
        expect(getState().activeOperations.has('include')).toBe(false);
      });
    });

    describe('openEditModal', () => {
      it('loads memory data into edit state', () => {
        const { getState } = store;
        const { openEditModal } = getState();

        const memory = {
          id: 42,
          table: 'history',
          content: 'Test content',
          type: 'thought',
          internal: 'Internal note',
        };

        openEditModal(memory);

        expect(getState().editModalOpen).toBe(true);
        expect(getState().editingMemory).toEqual(memory);
        expect(getState().editContent).toBe('Test content');
        expect(getState().editType).toBe('thought');
        expect(getState().editInternal).toBe('Internal note');
      });

      it('handles missing fields gracefully', () => {
        const { getState } = store;
        const { openEditModal } = getState();

        const memory = { id: 1, table: 'history' };

        openEditModal(memory);

        expect(getState().editContent).toBe('');
        expect(getState().editType).toBe('');
        expect(getState().editInternal).toBe('');
      });
    });

    describe('closeEditModal', () => {
      it('clears all edit state', () => {
        const { getState } = store;
        const { openEditModal, closeEditModal } = getState();

        // Set up state
        openEditModal({ id: 1, table: 'history', content: 'Test', type: 'thought' });

        closeEditModal();

        expect(getState().editModalOpen).toBe(false);
        expect(getState().editingMemory).toBeNull();
        expect(getState().editContent).toBe('');
        expect(getState().editType).toBe('');
        expect(getState().editInternal).toBe('');
      });
    });

    describe('saveMemoryEdit', () => {
      it('rejects when no memory being edited', async () => {
        const { getState } = store;
        const { saveMemoryEdit } = getState();
        const addLog = vi.fn();
        store.setState({ addLog, editingMemory: null });

        await saveMemoryEdit();

        expect(addLog).toHaveBeenCalledWith('❌ No memory being edited');
        expect(api.post).not.toHaveBeenCalled();
      });

      it('saves edit and closes modal', async () => {
        const { getState } = store;
        const { saveMemoryEdit, openEditModal } = getState();
        const addLog = vi.fn();
        const fetchAll = vi.fn();
        store.setState({ addLog, fetchAll });

        openEditModal({ id: 42, table: 'history', content: 'Old' });
        store.setState({ editContent: 'New content', editType: 'observation', editInternal: 'Note' });

        api.post.mockResolvedValue({});

        await saveMemoryEdit();

        expect(api.post).toHaveBeenCalledWith('/memory/edit', {
          table: 'history',
          id: 42,
          content: 'New content',
          type: 'observation',
          internal: 'Note',
        });
        expect(addLog).toHaveBeenCalledWith('✅ Memory edited');
        expect(getState().editModalOpen).toBe(false);
        expect(fetchAll).toHaveBeenCalled();
      });

      it('handles save errors', async () => {
        const { getState } = store;
        const { saveMemoryEdit, openEditModal } = getState();
        const addLog = vi.fn();
        const fetchAll = vi.fn();
        store.setState({ addLog, fetchAll });

        openEditModal({ id: 42, table: 'history' });

        api.post.mockRejectedValue(new Error('Save failed'));

        await saveMemoryEdit();

        expect(addLog).toHaveBeenCalledWith('❌ Edit failed: Save failed');
        expect(getState().isSavingEdit).toBe(false);
      });
    });

    describe('deleteMemoryPermanently', () => {
      it('prompts for password and deletes', async () => {
        const { getState } = store;
        const { deleteMemoryPermanently } = getState();
        const addLog = vi.fn();
        const fetchHistory = vi.fn();
        store.setState({ addLog, fetchHistory });

        // Mock global prompt
        global.prompt = vi.fn().mockReturnValue('admin-password');

        api.delete.mockResolvedValue({});

        await deleteMemoryPermanently(42);

        expect(global.prompt).toHaveBeenCalledWith('Enter admin password to permanently delete:');
        expect(api.delete).toHaveBeenCalledWith('/history/42', { password: 'admin-password' });
        expect(addLog).toHaveBeenCalledWith('✅ History entry deleted');
        expect(fetchHistory).toHaveBeenCalled();
      });

      it('aborts if password not provided', async () => {
        const { getState } = store;
        const { deleteMemoryPermanently } = getState();
        const addLog = vi.fn();
        store.setState({ addLog });

        global.prompt = vi.fn().mockReturnValue(null);

        await deleteMemoryPermanently(42);

        expect(addLog).toHaveBeenCalledWith('❌ Password required for delete');
        expect(api.delete).not.toHaveBeenCalled();
      });

      it('handles delete errors', async () => {
        const { getState } = store;
        const { deleteMemoryPermanently } = getState();
        const addLog = vi.fn();
        const fetchHistory = vi.fn();
        store.setState({ addLog, fetchHistory });

        global.prompt = vi.fn().mockReturnValue('wrong');
        api.delete.mockRejectedValue(new Error('Wrong password'));

        await deleteMemoryPermanently(42);

        expect(addLog).toHaveBeenCalledWith('❌ Delete failed: Wrong password');
      });
    });
  });

  // =========================================================================
  // SYNTHETIC MEMORIES
  // =========================================================================

  describe('synthetic memories', () => {
    describe('openSyntheticForm', () => {
      it('initializes form with defaults', () => {
        const { getState } = store;
        const { openSyntheticForm } = getState();

        openSyntheticForm();

        expect(getState().showSyntheticForm).toBe(true);
        expect(getState().editingSynthetic).toBeNull();
        expect(getState().syntheticType).toBe('thought');
        expect(getState().syntheticContent).toBe('');
        expect(getState().syntheticInternal).toBe('');
      });
    });

    describe('openSyntheticEdit', () => {
      it('loads text memory into form', () => {
        const { getState } = store;
        const { openSyntheticEdit } = getState();

        const synthetic = {
          id: 5,
          type: 'thought',
          content: 'Test thought',
          internal: 'Note',
        };

        openSyntheticEdit(synthetic);

        expect(getState().showSyntheticForm).toBe(true);
        expect(getState().editingSynthetic).toEqual(synthetic);
        expect(getState().syntheticType).toBe('thought');
        expect(getState().syntheticContent).toBe('Test thought');
        expect(getState().syntheticInternal).toBe('Note');
        expect(getState().syntheticImage).toBeNull();
      });

      it('loads art memory as image', () => {
        const { getState } = store;
        const { openSyntheticEdit } = getState();

        const synthetic = {
          id: 5,
          type: 'art_result',
          content: 'data:image/png;base64,abc123',
        };

        openSyntheticEdit(synthetic);

        expect(getState().syntheticType).toBe('art_result');
        expect(getState().syntheticImage).toEqual({ base64: 'data:image/png;base64,abc123', name: 'existing-image' });
        expect(getState().syntheticContent).toBe('');
      });

      it('handles memory_type field name variation', () => {
        const { getState } = store;
        const { openSyntheticEdit } = getState();

        const synthetic = {
          id: 5,
          memory_type: 'observation',
          content: 'Observation text',
        };

        openSyntheticEdit(synthetic);

        expect(getState().syntheticType).toBe('observation');
      });
    });

    describe('closeSyntheticForm', () => {
      it('clears all synthetic state', () => {
        const { getState } = store;
        const { openSyntheticEdit, closeSyntheticForm } = getState();

        // Set up state
        openSyntheticEdit({ id: 5, type: 'thought', content: 'Test' });

        closeSyntheticForm();

        expect(getState().showSyntheticForm).toBe(false);
        expect(getState().editingSynthetic).toBeNull();
        expect(getState().syntheticContent).toBe('');
        expect(getState().syntheticType).toBe('thought');
        expect(getState().syntheticInternal).toBe('');
        expect(getState().syntheticImage).toBeNull();
      });
    });

    describe('saveSyntheticMemory', () => {
      it('creates new text synthetic memory', async () => {
        const { getState } = store;
        const { saveSyntheticMemory } = getState();
        const addLog = vi.fn();
        const fetchSyntheticMemories = vi.fn();
        store.setState({
          addLog,
          fetchSyntheticMemories,
          editingSynthetic: null,
          syntheticType: 'thought',
          syntheticContent: 'New thought',
          syntheticInternal: 'Note',
        });

        api.post.mockResolvedValue({});

        await saveSyntheticMemory();

        expect(api.post).toHaveBeenCalledWith('/memory/synthetic', {
          type: 'thought',
          content: 'New thought',
          internal: 'Note',
        });
        expect(addLog).toHaveBeenCalledWith('✅ Synthetic memory created');
        expect(getState().showSyntheticForm).toBe(false);
        expect(fetchSyntheticMemories).toHaveBeenCalled();
      });

      it('updates existing synthetic memory', async () => {
        const { getState } = store;
        const { saveSyntheticMemory } = getState();
        const addLog = vi.fn();
        const fetchSyntheticMemories = vi.fn();
        store.setState({
          addLog,
          fetchSyntheticMemories,
          editingSynthetic: { id: 42 },
          syntheticType: 'observation',
          syntheticContent: 'Updated content',
          syntheticInternal: '',
        });

        api.put.mockResolvedValue({});

        await saveSyntheticMemory();

        expect(api.put).toHaveBeenCalledWith('/memory/synthetic/42', {
          type: 'observation',
          content: 'Updated content',
          internal: null,
        });
        expect(addLog).toHaveBeenCalledWith('✅ Synthetic memory updated');
      });

      it('creates art-type synthetic memory', async () => {
        const { getState } = store;
        const { saveSyntheticMemory } = getState();
        const addLog = vi.fn();
        const fetchSyntheticMemories = vi.fn();
        store.setState({
          addLog,
          fetchSyntheticMemories,
          editingSynthetic: null,
          syntheticType: 'art_result',
          syntheticImage: { base64: 'data:image/png;base64,abc' },
          syntheticContent: '',
        });

        api.post.mockResolvedValue({});

        await saveSyntheticMemory();

        expect(api.post).toHaveBeenCalledWith('/memory/synthetic', {
          type: 'art_result',
          content: 'data:image/png;base64,abc',
          internal: null,
        });
      });

      it('rejects empty text content', async () => {
        const { getState } = store;
        const { saveSyntheticMemory } = getState();
        const addLog = vi.fn();
        store.setState({
          addLog,
          syntheticType: 'thought',
          syntheticContent: '',
        });

        await saveSyntheticMemory();

        expect(addLog).toHaveBeenCalledWith('❌ Content required');
        expect(api.post).not.toHaveBeenCalled();
      });

      it('rejects art type without image', async () => {
        const { getState } = store;
        const { saveSyntheticMemory } = getState();
        const addLog = vi.fn();
        store.setState({
          addLog,
          syntheticType: 'art_result',
          syntheticImage: null,
          syntheticContent: '',
        });

        await saveSyntheticMemory();

        expect(addLog).toHaveBeenCalledWith('❌ Image required');
        expect(api.post).not.toHaveBeenCalled();
      });

      it('handles save errors', async () => {
        const { getState } = store;
        const { saveSyntheticMemory } = getState();
        const addLog = vi.fn();
        store.setState({
          addLog,
          syntheticType: 'thought',
          syntheticContent: 'Test',
        });

        api.post.mockRejectedValue(new Error('Save failed'));

        await saveSyntheticMemory();

        expect(addLog).toHaveBeenCalledWith('❌ Save failed: Save failed');
        expect(getState().isSavingSynthetic).toBe(false);
      });
    });

    describe('deleteSyntheticMemory', () => {
      it('rejects without password', async () => {
        const { getState } = store;
        const { deleteSyntheticMemory } = getState();
        const addLog = vi.fn();
        store.setState({ addLog });

        await deleteSyntheticMemory(42, '');

        expect(addLog).toHaveBeenCalledWith('❌ Password required for delete');
        expect(api.delete).not.toHaveBeenCalled();
      });

      it('deletes synthetic memory successfully', async () => {
        const { getState } = store;
        const { deleteSyntheticMemory } = getState();
        const addLog = vi.fn();
        const fetchSyntheticMemories = vi.fn();
        store.setState({ addLog, fetchSyntheticMemories });

        api.delete.mockResolvedValue({});

        await deleteSyntheticMemory(42, 'admin-password');

        expect(api.delete).toHaveBeenCalledWith('/memory/synthetic/42', { password: 'admin-password' });
        expect(addLog).toHaveBeenCalledWith('🗑️ Synthetic memory deleted');
        expect(fetchSyntheticMemories).toHaveBeenCalled();
      });

      it('handles delete errors', async () => {
        const { getState } = store;
        const { deleteSyntheticMemory } = getState();
        const addLog = vi.fn();
        store.setState({ addLog });

        api.delete.mockRejectedValue(new Error('Delete failed'));

        await deleteSyntheticMemory(42, 'password');

        expect(addLog).toHaveBeenCalledWith('❌ Delete failed: Delete failed');
      });
    });
  });

  // =========================================================================
  // EXPORT/IMPORT
  // =========================================================================

  describe('export/import', () => {
    describe('exportPersonality', () => {
      it('rejects empty export name', async () => {
        const { getState } = store;
        const { exportPersonality } = getState();
        const addLog = vi.fn();
        store.setState({ addLog, exportName: '' });

        const result = await exportPersonality();

        expect(addLog).toHaveBeenCalledWith('❌ Export name required');
        expect(result).toBeNull();
        expect(api.post).not.toHaveBeenCalled();
      });

      it('exports successfully', async () => {
        const { getState } = store;
        const { exportPersonality } = getState();
        const addLog = vi.fn();
        store.setState({
          addLog,
          exportName: 'Test Export',
          exportDescription: 'Test description',
          exportOptions: { includeHistory: true, historyLimit: 50 },
        });

        const exportData = { name: 'Test Export', data: [] };
        api.post.mockResolvedValue(exportData);

        const result = await exportPersonality();

        expect(api.post).toHaveBeenCalledWith('/personality/export', {
          name: 'Test Export',
          description: 'Test description',
          includeHistory: true,
          historyLimit: 50,
        });
        expect(addLog).toHaveBeenCalledWith('✅ Export ready');
        expect(result).toEqual(exportData);
      });

      it('handles export errors', async () => {
        const { getState } = store;
        const { exportPersonality } = getState();
        const addLog = vi.fn();
        store.setState({ addLog, exportName: 'Test' });

        api.post.mockRejectedValue(new Error('Export failed'));

        const result = await exportPersonality();

        expect(addLog).toHaveBeenCalledWith('❌ Export failed: Export failed');
        expect(result).toBeNull();
        expect(getState().isExporting).toBe(false);
      });
    });

    describe('previewImport', () => {
      it('previews import successfully', async () => {
        const { getState } = store;
        const { previewImport } = getState();
        const addLog = vi.fn();
        store.setState({ addLog, importMode: 'merge' });

        const previewData = { changes: [], warnings: [] };
        api.post.mockResolvedValue(previewData);

        await previewImport({ name: 'Test', data: [] });

        expect(api.post).toHaveBeenCalledWith('/personality/preview', {
          name: 'Test',
          data: [],
          mode: 'merge',
        });
        expect(getState().importPreview).toEqual(previewData);
        expect(addLog).toHaveBeenCalledWith('✅ Preview ready');
      });

      it('handles preview errors', async () => {
        const { getState } = store;
        const { previewImport } = getState();
        const addLog = vi.fn();
        store.setState({ addLog });

        api.post.mockRejectedValue(new Error('Invalid snapshot'));

        await previewImport({ invalid: 'data' });

        expect(addLog).toHaveBeenCalledWith('❌ Preview failed: Invalid snapshot');
        expect(getState().importPreview).toBeNull();
      });
    });

    describe('importPersonality', () => {
      it('requires password for replace mode', async () => {
        const { getState } = store;
        const { importPersonality } = getState();
        const addLog = vi.fn();
        store.setState({ addLog, importMode: 'replace' });

        await importPersonality({ name: 'Test' }, '');

        expect(addLog).toHaveBeenCalledWith('❌ Password required for replace mode');
        expect(api.post).not.toHaveBeenCalled();
      });

      it('imports in replace mode with password', async () => {
        const { getState } = store;
        const { importPersonality } = getState();
        const addLog = vi.fn();
        const fetchAll = vi.fn();
        store.setState({ addLog, fetchAll, importMode: 'replace' });

        api.post.mockResolvedValue({});

        await importPersonality({ name: 'Test' }, 'admin-password');

        expect(api.post).toHaveBeenCalledWith('/personality/import?mode=replace', {
          name: 'Test',
          password: 'admin-password',
        });
        expect(addLog).toHaveBeenCalledWith('✅ Import complete');
        expect(getState().importPreview).toBeNull();
        expect(getState().importFile).toBeNull();
        expect(fetchAll).toHaveBeenCalled();
      });

      it('imports in merge mode without password', async () => {
        const { getState } = store;
        const { importPersonality } = getState();
        const addLog = vi.fn();
        const fetchAll = vi.fn();
        store.setState({ addLog, fetchAll, importMode: 'merge' });

        api.post.mockResolvedValue({});

        await importPersonality({ name: 'Test' });

        expect(api.post).toHaveBeenCalledWith('/personality/import?mode=merge', {
          name: 'Test',
        });
        expect(addLog).toHaveBeenCalledWith('✅ Import complete');
      });

      it('handles import errors', async () => {
        const { getState } = store;
        const { importPersonality } = getState();
        const addLog = vi.fn();
        store.setState({ addLog, importMode: 'merge' });

        api.post.mockRejectedValue(new Error('Import failed'));

        await importPersonality({ name: 'Test' });

        expect(addLog).toHaveBeenCalledWith('❌ Import failed: Import failed');
        expect(getState().isImporting).toBe(false);
      });
    });

    describe('clearImport', () => {
      it('clears all import state', () => {
        const { getState } = store;
        const { clearImport } = getState();

        store.setState({
          importFile: { name: 'test.json' },
          importPreview: { changes: [] },
          importMode: 'replace',
        });

        clearImport();

        expect(getState().importFile).toBeNull();
        expect(getState().importPreview).toBeNull();
        expect(getState().importMode).toBe('merge');
      });
    });

    describe('readImportFile', () => {
      it('reads JSON file successfully', async () => {
        const { getState } = store;
        const { readImportFile } = getState();
        const addLog = vi.fn();

        const fileContent = JSON.stringify({ name: 'Test', data: [] });
        const file = new Blob([fileContent], { type: 'application/json' });
        file.name = 'test.json';

        store.setState({ addLog, importFile: file });

        // Mock FileReader
        const mockReader = {
          onload: null,
          onerror: null,
          readAsText: vi.fn(function() {
            this.onload({ target: { result: fileContent } });
          }),
        };
        global.FileReader = function() {
          return mockReader;
        };

        const result = await readImportFile();

        expect(result).toEqual({ name: 'Test', data: [] });
      });

      it('handles invalid JSON', async () => {
        const { getState } = store;
        const { readImportFile } = getState();
        const addLog = vi.fn();

        const file = new Blob(['invalid json'], { type: 'application/json' });
        store.setState({ addLog, importFile: file });

        const mockReader = {
          onload: null,
          onerror: null,
          readAsText: vi.fn(function() {
            this.onload({ target: { result: 'invalid json' } });
          }),
        };
        global.FileReader = function() {
          return mockReader;
        };

        const result = await readImportFile();

        expect(result).toBeNull();
        expect(addLog).toHaveBeenCalledWith('❌ Invalid JSON file');
      });

      it('handles file read errors', async () => {
        const { getState } = store;
        const { readImportFile } = getState();
        const addLog = vi.fn();

        const file = new Blob(['content'], { type: 'application/json' });
        store.setState({ addLog, importFile: file });

        const mockReader = {
          onload: null,
          onerror: null,
          readAsText: vi.fn(function() {
            this.onerror();
          }),
        };
        global.FileReader = function() {
          return mockReader;
        };

        const result = await readImportFile();

        expect(result).toBeNull();
        expect(addLog).toHaveBeenCalledWith('❌ Failed to read file');
      });

      it('rejects if no file selected', async () => {
        const { getState } = store;
        const { readImportFile } = getState();
        const addLog = vi.fn();
        store.setState({ addLog, importFile: null });

        const result = await readImportFile();

        expect(result).toBeNull();
        expect(addLog).toHaveBeenCalledWith('❌ No file selected');
      });
    });
  });
});
