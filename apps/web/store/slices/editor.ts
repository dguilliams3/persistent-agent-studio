/**
 * Editor Tab Slice
 *
 * @module store/slices/editor
 * @description Zustand store slice for the Editor tab providing memory management capabilities:
 *
 * **Memory Branches** (CRUD + switch):
 * - NON-DESTRUCTIVE branch management for experimental memory configurations
 * - Each branch can exclude, edit, or reorder memories
 * - Only one branch active at a time (main branch shows canonical history)
 *
 * **Memory Editing** (exclude/include/edit):
 * - Exclude memories from active branch context
 * - Include previously excluded memories
 * - Edit memory content/type via modal
 * - Delete memories permanently (requires password)
 *
 * **Synthetic Memories** (CRUD):
 * - Inject new memories that don't exist in canonical history
 * - Support text and image types (art_result, user_art)
 * - Per-branch isolation via memory_overrides table
 *
 * **Personality Export/Import**:
 * - Export current state snapshot (configurable tables/limits)
 * - Preview imports before applying (merge/branch/replace modes)
 * - Selective data recovery and experimentation
 *
 * Key concepts:
 * - Bulk operation queue prevents concurrent edits (startBulkOperation guard)
 * - Edit modal coordinates single active edit
 * - Synthetic form supports both text and image content
 *
 * @upstream Called by:
 *   - store/index.js - Spread into main store via createEditorSlice()
 *   - All Editor tab components (tabs/Editor/*)
 * @downstream Calls:
 *   - api/client.js - /branches/*, /memory/*, /personality/* endpoints
 *   - Store cross-slice dependencies: addLog, fetchBranches, fetchAll, fetchHistory, fetchSyntheticMemories
 *
 * @tests apps/web/store/slices/__tests__/editor.test.js
 *   - "branch actions" - switchBranch, createBranch, forkBranch, resetBranchToCanonical, deleteBranch
 *   - "bulk operation queue" - startBulkOperation concurrency guard, endBulkOperation cleanup
 *   - "memory editing" - excludeMemories, includeMemories, openEditModal/closeEditModal, saveMemoryEdit
 *   - "synthetic memories" - openSyntheticForm, openSyntheticEdit, closeSyntheticForm, saveSyntheticMemory, deleteSyntheticMemory
 *   - "export/import" - exportPersonality, previewImport, importPersonality, clearImport, readImportFile
 *   - "state setters" - Synchronous state mutations
 */

import type { StateCreator } from "zustand";
import type { AppState } from "../types";
import api from "../../api/client";

/** Memory reference used in bulk exclude/include operations */
interface MemoryRef {
  table: string;
  id: number;
}

/** Memory object used in the edit modal */
interface EditableMemory {
  id: number;
  table: string;
  content?: string;
  type?: string;
  internal?: string;
}

/** Synthetic memory object */
interface SyntheticMemory {
  id: number;
  type?: string;
  memory_type?: string;
  content?: string;
  internal?: string;
}

/** Export options configuration */
interface ExportOptions {
  includeHistory: boolean;
  historyLimit: number;
  includeAllHistory: boolean;
  includeSummaries: boolean;
  includeBranches: boolean;
  includeMedia: boolean;
  includeGallery: boolean;
}

/** Synthetic image state */
interface SyntheticImage {
  base64: string;
  name: string;
}

export interface EditorSlice {
  // STATE
  /** Currently active memory branch */
  activeBranch: string;
  /** Loading branches in progress */
  isLoadingBranches: boolean;
  /** New branch name input */
  newBranchName: string;
  /** Editor type filter ('all', 'history', 'cold_storage', etc.) */
  editorTypeFilter: string;
  /** Editor search query */
  editorSearch: string;
  /** Selected memory IDs for bulk operations */
  selectedMemories: Set<string>;
  /** Excluding memories in progress */
  isExcluding: boolean;
  /** Edit modal open state */
  editModalOpen: boolean;
  /** Memory currently being edited */
  editingMemory: EditableMemory | null;
  /** Edit modal - memory type */
  editType: string;
  /** Edit modal - memory content */
  editContent: string;
  /** Edit modal - internal/subthought content */
  editInternal: string;
  /** Saving edit in progress */
  isSavingEdit: boolean;
  /** Loading synthetic memories in progress */
  isLoadingSynthetics: boolean;
  /** Show synthetic memory form */
  showSyntheticForm: boolean;
  /** Synthetic memory being edited */
  editingSynthetic: SyntheticMemory | null;
  /** New synthetic memory type */
  syntheticType: string;
  /** New synthetic memory content */
  syntheticContent: string;
  /** New synthetic memory internal/subthought */
  syntheticInternal: string;
  /** Saving synthetic memory in progress */
  isSavingSynthetic: boolean;
  /** Synthetic memory image (for art types) */
  syntheticImage: SyntheticImage | null;
  /** Active bulk operations to prevent concurrent execution */
  activeOperations: Set<string>;
  /** Export name input */
  exportName: string;
  /** Export description input */
  exportDescription: string;
  /** Export options (which tables to include) */
  exportOptions: ExportOptions;
  /** Exporting in progress */
  isExporting: boolean;
  /** Import file */
  importFile: File | null;
  /** Import mode ('replace', 'merge', 'branch') */
  importMode: string;
  /** Import preview data */
  importPreview: Record<string, unknown> | null;
  /** Previewing import in progress */
  isPreviewing: boolean;
  /** Importing in progress */
  isImporting: boolean;

  // SETTERS
  setActiveBranch: (branch: string) => void;
  setIsLoadingBranches: (loading: boolean) => void;
  setNewBranchName: (name: string) => void;
  setEditorTypeFilter: (filter: string) => void;
  setEditorSearch: (search: string) => void;
  setSelectedMemories: (memories: Set<string>) => void;
  toggleMemorySelection: (id: string) => void;
  clearSelectedMemories: () => void;
  setIsExcluding: (excluding: boolean) => void;
  setEditModalOpen: (open: boolean) => void;
  setEditingMemory: (memory: EditableMemory | null) => void;
  setEditType: (type: string) => void;
  setEditContent: (content: string) => void;
  setEditInternal: (internal: string) => void;
  setIsSavingEdit: (saving: boolean) => void;
  setIsLoadingSynthetics: (loading: boolean) => void;
  setShowSyntheticForm: (show: boolean) => void;
  setEditingSynthetic: (synthetic: SyntheticMemory | null) => void;
  setSyntheticType: (type: string) => void;
  setSyntheticContent: (content: string) => void;
  setSyntheticInternal: (internal: string) => void;
  setIsSavingSynthetic: (saving: boolean) => void;
  setSyntheticImage: (image: SyntheticImage | null) => void;
  setExportName: (name: string) => void;
  setExportDescription: (desc: string) => void;
  setExportOptions: (options: ExportOptions) => void;
  setIsExporting: (exporting: boolean) => void;
  setImportFile: (file: File | null) => void;
  setImportMode: (mode: string) => void;
  setImportPreview: (preview: Record<string, unknown> | null) => void;
  setIsPreviewing: (previewing: boolean) => void;
  setIsImporting: (importing: boolean) => void;

  // BRANCH ACTIONS
  switchBranch: (branchName: string) => Promise<void>;
  createBranch: (name?: string, description?: string) => Promise<void>;
  forkBranch: (sourceBranch: string, newName: string) => Promise<void>;
  resetBranchToCanonical: (branchName: string) => Promise<void>;
  deleteBranch: (branchName: string, password: string) => Promise<void>;

  // BULK OPERATION QUEUE
  startBulkOperation: (operationType: string) => boolean;
  endBulkOperation: (operationType: string) => void;

  // MEMORY EDIT ACTIONS
  excludeMemories: (memories: MemoryRef[]) => Promise<void>;
  includeMemories: (memories: MemoryRef[]) => Promise<void>;
  openEditModal: (memory: EditableMemory) => void;
  closeEditModal: () => void;
  saveMemoryEdit: () => Promise<void>;
  excludeMemory: (table: string, id: number) => Promise<void>;
  deleteMemoryPermanently: (id: number) => Promise<void>;

  // SYNTHETIC MEMORY ACTIONS
  openSyntheticForm: () => void;
  openSyntheticEdit: (synthetic: SyntheticMemory) => void;
  closeSyntheticForm: () => void;
  saveSyntheticMemory: () => Promise<void>;
  deleteSyntheticMemory: (id: number, password: string) => Promise<void>;

  // EXPORT/IMPORT ACTIONS
  exportPersonality: () => Promise<Record<string, unknown> | null>;
  previewImport: (fileContent: Record<string, unknown>) => Promise<void>;
  importPersonality: (
    fileContent: Record<string, unknown>,
    password?: string,
  ) => Promise<void>;
  clearImport: () => void;
  handleImportFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readImportFile: () => Promise<Record<string, unknown> | null>;
}

export const createEditorSlice: StateCreator<AppState, [], [], EditorSlice> = (
  set,
  get,
) => ({
  // ===========================================================================
  // STATE
  // ===========================================================================

  /** @type {string} Currently active memory branch */
  activeBranch: "main",

  /** @type {boolean} Loading branches in progress */
  isLoadingBranches: false,

  /** @type {string} New branch name input */
  newBranchName: "",

  /** @type {string} Editor type filter ('all', 'history', 'cold_storage', etc.) */
  editorTypeFilter: "all",

  /** @type {string} Editor search query */
  editorSearch: "",

  /** @type {Set<string>} Selected memory IDs for bulk operations */
  selectedMemories: new Set<string>(),

  /** @type {boolean} Excluding memories in progress */
  isExcluding: false,

  /** @type {boolean} Edit modal open state */
  editModalOpen: false,

  /** @type {Object|null} Memory currently being edited */
  editingMemory: null,

  /** @type {string} Edit modal - memory type */
  editType: "",

  /** @type {string} Edit modal - memory content */
  editContent: "",

  /** @type {string} Edit modal - internal/subthought content */
  editInternal: "",

  /** @type {boolean} Saving edit in progress */
  isSavingEdit: false,

  // Synthetic memories state
  /** @type {boolean} Loading synthetic memories in progress */
  isLoadingSynthetics: false,

  /** @type {boolean} Show synthetic memory form */
  showSyntheticForm: false,

  /** @type {Object|null} Synthetic memory being edited */
  editingSynthetic: null,

  /** @type {string} New synthetic memory type */
  syntheticType: "thought",

  /** @type {string} New synthetic memory content */
  syntheticContent: "",

  /** @type {string} New synthetic memory internal/subthought */
  syntheticInternal: "",

  /** @type {boolean} Saving synthetic memory in progress */
  isSavingSynthetic: false,

  /** @type {Object|null} Synthetic memory image (for art types) - { base64, name } */
  syntheticImage: null,

  // Operation queue to prevent race conditions
  /** @type {Set<string>} Active bulk operations to prevent concurrent execution */
  activeOperations: new Set(),

  // Personality export state
  /** @type {string} Export name input */
  exportName: "",

  /** @type {string} Export description input */
  exportDescription: "",

  /** @type {Object} Export options (which tables to include) */
  exportOptions: (() => {
    const stored =
      typeof window !== "undefined" && localStorage.getItem("exportOptions");
    const defaults: ExportOptions = {
      includeHistory: true,
      historyLimit: 100,
      includeAllHistory: false,
      includeSummaries: true,
      includeBranches: false,
      includeMedia: false,
      includeGallery: false,
    };
    return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
  })(),

  /** @type {boolean} Exporting in progress */
  isExporting: false,

  // Personality import state
  /** @type {File|null} Import file */
  importFile: null,

  /** @type {string} Import mode ('replace', 'merge', 'branch') */
  importMode: "merge",

  /** @type {Object|null} Import preview data */
  importPreview: null,

  /** @type {boolean} Previewing import in progress */
  isPreviewing: false,

  /** @type {boolean} Importing in progress */
  isImporting: false,

  // ===========================================================================
  // SETTERS
  // ===========================================================================

  setActiveBranch: (branch: string) => set({ activeBranch: branch }),
  setIsLoadingBranches: (loading: boolean) =>
    set({ isLoadingBranches: loading }),
  setNewBranchName: (name: string) => set({ newBranchName: name }),
  setEditorTypeFilter: (filter: string) => set({ editorTypeFilter: filter }),
  setEditorSearch: (search: string) => set({ editorSearch: search }),
  setSelectedMemories: (memories: Set<string>) =>
    set({ selectedMemories: memories }),
  toggleMemorySelection: (id: string) =>
    set((s) => {
      const newSet = new Set(s.selectedMemories);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return { selectedMemories: newSet };
    }),
  clearSelectedMemories: () => set({ selectedMemories: new Set() }),
  setIsExcluding: (excluding: boolean) => set({ isExcluding: excluding }),
  setEditModalOpen: (open: boolean) => set({ editModalOpen: open }),
  setEditingMemory: (memory: EditableMemory | null) =>
    set({ editingMemory: memory }),
  setEditType: (type: string) => set({ editType: type }),
  setEditContent: (content: string) => set({ editContent: content }),
  setEditInternal: (internal: string) => set({ editInternal: internal }),
  setIsSavingEdit: (saving: boolean) => set({ isSavingEdit: saving }),

  // Synthetic memory setters
  setIsLoadingSynthetics: (loading: boolean) =>
    set({ isLoadingSynthetics: loading }),
  setShowSyntheticForm: (show: boolean) => set({ showSyntheticForm: show }),
  setEditingSynthetic: (synthetic: SyntheticMemory | null) =>
    set({ editingSynthetic: synthetic }),
  setSyntheticType: (type: string) => set({ syntheticType: type }),
  setSyntheticContent: (content: string) => set({ syntheticContent: content }),
  setSyntheticInternal: (internal: string) =>
    set({ syntheticInternal: internal }),
  setIsSavingSynthetic: (saving: boolean) => set({ isSavingSynthetic: saving }),
  setSyntheticImage: (image: SyntheticImage | null) =>
    set({ syntheticImage: image }),

  // Export/Import setters
  setExportName: (name: string) => set({ exportName: name }),
  setExportDescription: (desc: string) => set({ exportDescription: desc }),
  setExportOptions: (options: ExportOptions) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("exportOptions", JSON.stringify(options));
    }
    set({ exportOptions: options });
  },
  setIsExporting: (exporting: boolean) => set({ isExporting: exporting }),
  setImportFile: (file: File | null) => set({ importFile: file }),
  setImportMode: (mode: string) => set({ importMode: mode }),
  setImportPreview: (preview: Record<string, unknown> | null) =>
    set({ importPreview: preview }),
  setIsPreviewing: (previewing: boolean) => set({ isPreviewing: previewing }),
  setIsImporting: (importing: boolean) => set({ isImporting: importing }),

  // ===========================================================================
  // BRANCH ACTIONS
  // ===========================================================================

  /**
   * @description Activate a different memory branch
   *
   * Switches the active branch, causing the context assembly to use that branch's
   * memory overrides. Fetches all data to reflect the new branch state.
   *
   * @upstream Called by: Editor tab UI, branch selector dropdown
   * @downstream Calls: api.put(/branches/:name/activate), setActiveBranch, fetchAll, addLog
   *
   * @param {string} branchName - Name of the branch to activate
   * @returns {Promise<void>}
   *
   * @example
   * await switchBranch('experimental-v2');
   * // Switches to 'experimental-v2', refetches context with new overrides
   *
   * @tests apps/web/store/slices/__tests__/editor.test.js
   *   - "branch actions - switchBranch" (success, error handling, state updates)
   *
   * @note Branch must exist; if it doesn't, API returns error which gets logged
   */
  switchBranch: async (branchName: string) => {
    const { addLog, setActiveBranch, fetchBranches, fetchAll } = get();
    addLog(`🔀 Switching to branch: ${branchName}`);
    try {
      await api.put(`/branches/${encodeURIComponent(branchName)}/activate`);
      setActiveBranch(branchName);
      addLog(`✅ Switched to ${branchName}`);
      await fetchAll();
    } catch (err: unknown) {
      addLog(
        `❌ Branch switch failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  /**
   * @description Create a new memory branch from canonical history
   *
   * Creates a new empty branch that starts as a copy of canonical history.
   * The branch can then be customized with memory overrides (exclusions, edits, reorderings).
   * Uses newBranchName from state if name parameter not provided.
   *
   * @upstream Called by: Editor tab "New Branch" UI, branch creation form
   * @downstream Calls: api.post(/branches), setNewBranchName, fetchBranches, addLog
   *
   * @param {string} [name] - Branch name (optional; uses state.newBranchName if not provided)
   * @param {string} [description=''] - Optional branch description
   * @returns {Promise<void>}
   *
   * @example
   * // Create via parameter
   * await createBranch('experimental-v2', 'Test memory ordering');
   *
   * // Create via state.newBranchName
   * setNewBranchName('test-branch');
   * await createBranch();
   *
   * @tests apps/web/store/slices/__tests__/editor.test.js
   *   - "branch actions - createBranch" (validation, success, error handling)
   *
   * @note Branch name must not be empty; validation happens before API call
   */
  createBranch: async (name?: string, description = "") => {
    const { addLog, newBranchName, setNewBranchName, fetchBranches } = get();
    const branchName = name || newBranchName;
    if (!branchName.trim()) {
      addLog("❌ Branch name required");
      return;
    }
    addLog(`🌿 Creating branch: ${branchName}`);
    try {
      await api.post("/branches", { name: branchName, description });
      addLog(`✅ Branch "${branchName}" created`);
      setNewBranchName("");
      await fetchBranches();
    } catch (err: unknown) {
      addLog(
        `❌ Branch creation failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  /**
   * @description Create a new branch as a copy of an existing branch
   *
   * Copies all memory overrides (exclusions, edits, reorderings, synthetics) from
   * source branch to new branch. Useful for iterating on experimental configurations.
   *
   * @upstream Called by: Editor tab branch context menu "Fork branch"
   * @downstream Calls: api.post(/branches/:name/fork), fetchBranches, addLog
   *
   * @param {string} sourceBranch - Name of branch to fork from
   * @param {string} newName - Name for the new forked branch
   * @returns {Promise<void>}
   *
   * @example
   * await forkBranch('experimental-v1', 'experimental-v2');
   * // Creates experimental-v2 with all overrides from experimental-v1
   *
   * @tests apps/web/store/slices/__tests__/editor.test.js
   *   - "branch actions - forkBranch" (validation, success, error handling)
   *
   * @note New branch name must not be empty; source branch must exist
   */
  forkBranch: async (sourceBranch: string, newName: string) => {
    const { addLog, fetchBranches } = get();
    if (!newName.trim()) {
      addLog("❌ New branch name required");
      return;
    }
    addLog(`🔀 Forking ${sourceBranch} → ${newName}`);
    try {
      await api.post(`/branches/${encodeURIComponent(sourceBranch)}/fork`, {
        name: newName,
      });
      addLog(`✅ Branch forked to "${newName}"`);
      await fetchBranches();
    } catch (err: unknown) {
      addLog(
        `❌ Fork failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  /**
   * @description Reset a branch to canonical history
   *
   * Clears all memory overrides for the branch (exclusions, edits, reorderings, synthetics).
   * The branch will then show unmodified canonical history like the 'main' branch.
   * Useful for undoing experimental changes without deleting the branch itself.
   *
   * @upstream Called by: Editor tab branch context menu "Reset to canonical"
   * @downstream Calls: api.post(/branches/:name/reset), fetchBranches, fetchAll, addLog
   *
   * @param {string} branchName - Name of branch to reset
   * @returns {Promise<void>}
   *
   * @example
   * await resetBranchToCanonical('experimental-v1');
   * // Removes all overrides from experimental-v1, shows canonical state
   *
   * @tests apps/web/store/slices/__tests__/editor.test.js
   *   - "branch actions - resetBranchToCanonical" (success, error handling, state refresh)
   *
   * @note Branch itself remains; only its overrides are deleted
   */
  resetBranchToCanonical: async (branchName: string) => {
    const { addLog, fetchBranches, fetchAll } = get();
    addLog(`🔄 Resetting branch: ${branchName}`);
    try {
      await api.post(`/branches/${encodeURIComponent(branchName)}/reset`);
      addLog(`✅ Branch "${branchName}" reset to canonical`);
      await Promise.all([fetchBranches(), fetchAll()]);
    } catch (err: unknown) {
      addLog(
        `❌ Branch reset failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  /**
   * @description Permanently delete a memory branch
   *
   * Removes the branch and all its overrides from the database.
   * Requires admin password. If the deleted branch was active,
   * switches to 'main' branch automatically.
   *
   * @upstream Called by: Editor tab branch context menu "Delete" (protected with password modal)
   * @downstream Calls: api.delete(/branches/:name), setActiveBranch, fetchBranches, addLog
   *
   * @param {string} branchName - Name of branch to delete
   * @param {string} password - Admin password (required)
   * @returns {Promise<void>}
   *
   * @example
   * await deleteBranch('experimental-v1', 'admin-password');
   * // Permanently removes experimental-v1 and all its overrides
   *
   * @tests apps/web/store/slices/__tests__/editor.test.js
   *   - "branch actions - deleteBranch" (password validation, active branch fallback, error handling)
   *
   * @note Cannot delete 'main' branch; password required for destructive operation
   */
  deleteBranch: async (branchName: string, password: string) => {
    const { addLog, activeBranch, setActiveBranch, fetchBranches } = get();
    if (!password) {
      addLog("❌ Password required for delete");
      return;
    }
    addLog(`🗑️ Deleting branch: ${branchName}`);
    try {
      await api.delete(`/branches/${encodeURIComponent(branchName)}`, {
        password,
      });
      addLog(`✅ Branch "${branchName}" deleted`);
      if (activeBranch === branchName) {
        setActiveBranch("main");
      }
      await fetchBranches();
    } catch (err: unknown) {
      addLog(
        `❌ Branch delete failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  // ===========================================================================
  // BULK OPERATION QUEUE
  // ===========================================================================

  /**
   * @description Attempt to start a bulk operation (prevent concurrent execution)
   *
   * Uses activeOperations Set to prevent concurrent execution of the same operation type.
   * Returns false if operation already in progress; caller should abort and log warning.
   * Must call endBulkOperation() in finally block to release the lock.
   *
   * @upstream Called by: excludeMemories, includeMemories (bulk edit operations)
   * @downstream Calls: No external calls; pure state management
   *
   * @param {string} operationType - Operation identifier (e.g., 'exclude', 'include')
   * @returns {boolean} true if operation can proceed, false if already in progress
   *
   * @example
   * if (!startBulkOperation('exclude')) {
   *   addLog('Operation already in progress');
   *   return;
   * }
   * try {
   *   await excludeMemories([...]);
   * } finally {
   *   endBulkOperation('exclude');
   * }
   *
   * @tests apps/web/store/slices/__tests__/editor.test.js
   *   - "bulk operation queue" (acquire lock, concurrent prevention, release)
   *
   * @note Critical for preventing race conditions in memory edit operations
   */
  startBulkOperation: (operationType: string) => {
    const { activeOperations } = get();
    if (activeOperations.has(operationType)) {
      return false;
    }
    set((state) => ({
      activeOperations: new Set([...state.activeOperations, operationType]),
    }));
    return true;
  },

  /**
   * @description Release a bulk operation lock
   *
   * Removes the operation type from activeOperations Set.
   * Should be called in finally block of bulk operation actions.
   *
   * @upstream Called by: excludeMemories, includeMemories (error handling/cleanup)
   * @downstream Calls: No external calls; pure state management
   *
   * @param {string} operationType - Operation identifier to release
   * @returns {void}
   *
   * @example
   * try {
   *   // Do work
   * } finally {
   *   endBulkOperation('exclude'); // Always called
   * }
   *
   * @tests apps/web/store/slices/__tests__/editor.test.js
   *   - "bulk operation queue" (lock release, state cleanup)
   *
   * @note Always call in finally block to prevent orphaned locks
   */
  endBulkOperation: (operationType: string) => {
    set((state) => {
      const newOperations = new Set(state.activeOperations);
      newOperations.delete(operationType);
      return { activeOperations: newOperations };
    });
  },

  // ===========================================================================
  // MEMORY EDIT ACTIONS
  // ===========================================================================

  /**
   * @description Exclude multiple memories from the active branch context
   *
   * Creates memory_overrides for each memory in the current active branch.
   * Excluded memories won't appear in context assembly or search.
   * Uses bulk operation queue to prevent concurrent exclude/include operations.
   *
   * @upstream Called by: Memory Editor UI, context menu bulk actions
   * @downstream Calls: api.post(/memory/exclude), clearSelectedMemories, fetchAll, startBulkOperation, endBulkOperation, addLog
   *
   * @param {Array<{table: string, id: number}>} memories - Memories to exclude (with table name and ID)
   * @returns {Promise<void>}
   *
   * @example
   * await excludeMemories([
   *   { table: 'history', id: 42 },
   *   { table: 'cold_storage', id: 15 }
   * ]);
   * // Excludes both memories from current branch
   *
   * @tests apps/web/store/slices/__tests__/editor.test.js
   *   - "memory editing - excludeMemories" (validation, concurrency guard, API calls, state updates)
   *
   * @note Non-destructive: memories remain in database, just hidden in this branch
   */
  excludeMemories: async (memories: MemoryRef[]) => {
    const {
      addLog,
      setIsExcluding,
      clearSelectedMemories,
      fetchAll,
      startBulkOperation,
      endBulkOperation,
    } = get();

    if (!startBulkOperation("exclude")) {
      addLog("⚠️ Exclude operation already in progress, please wait...");
      return;
    }

    if (!memories || memories.length === 0) {
      addLog("❌ No memories selected");
      endBulkOperation("exclude");
      return;
    }
    setIsExcluding(true);
    addLog(`🚫 Excluding ${memories.length} memories...`);
    try {
      await Promise.all(
        memories.map((m) =>
          api.post("/memory/exclude", { table: m.table, id: m.id }),
        ),
      );
      addLog(`✅ Excluded ${memories.length} memories`);
      clearSelectedMemories();
      await fetchAll();
    } catch (err: unknown) {
      addLog(
        `❌ Exclude failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsExcluding(false);
      endBulkOperation("exclude");
    }
  },

  /**
   * @description Re-include previously excluded memories in the active branch
   *
   * Removes memory_overrides (type: 'exclude') for each memory from the active branch.
   * Included memories will appear again in context assembly.
   * Uses bulk operation queue to prevent concurrent exclude/include operations.
   *
   * @upstream Called by: Memory Editor UI, context menu bulk actions
   * @downstream Calls: api.post(/memory/include), clearSelectedMemories, fetchAll, startBulkOperation, endBulkOperation, addLog
   *
   * @param {Array<{table: string, id: number}>} memories - Memories to include (with table name and ID)
   * @returns {Promise<void>}
   *
   * @example
   * await includeMemories([
   *   { table: 'history', id: 42 },
   *   { table: 'cold_storage', id: 15 }
   * ]);
   * // Re-includes both memories in current branch
   *
   * @tests apps/web/store/slices/__tests__/editor.test.js
   *   - "memory editing - includeMemories" (validation, concurrency guard, API calls, state updates)
   *
   * @note Inverse of excludeMemories; only works on previously excluded memories
   */
  includeMemories: async (memories: MemoryRef[]) => {
    const {
      addLog,
      clearSelectedMemories,
      fetchAll,
      startBulkOperation,
      endBulkOperation,
    } = get();

    if (!startBulkOperation("include")) {
      addLog("⚠️ Include operation already in progress, please wait...");
      return;
    }

    if (!memories || memories.length === 0) {
      addLog("❌ No memories selected");
      endBulkOperation("include");
      return;
    }
    addLog(`✅ Including ${memories.length} memories...`);
    try {
      await Promise.all(
        memories.map((m) =>
          api.post("/memory/include", { table: m.table, id: m.id }),
        ),
      );
      addLog(`✅ Included ${memories.length} memories`);
      clearSelectedMemories();
      await fetchAll();
    } catch (err: unknown) {
      addLog(
        `❌ Include failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      endBulkOperation("include");
    }
  },

  /**
   * @description Open memory editor modal with memory data pre-populated
   *
   * Loads memory fields (content, type, internal) into edit modal state.
   * Only one memory can be edited at a time.
   *
   * @upstream Called by: Memory Editor UI, memory context menu "Edit"
   * @downstream Calls: setEditingMemory, setEditContent, setEditType, setEditInternal, setEditModalOpen
   *
   * @param {Object} memory - Memory object with id, table, content, type, internal
   * @returns {void}
   *
   * @example
   * openEditModal({ id: 42, table: 'history', content: 'Old text', type: 'thought' });
   * // Modal opens with current memory loaded
   *
   * @tests apps/web/store/slices/__tests__/editor.test.js
   *   - "memory editing - openEditModal/closeEditModal" (state loading, modal open)
   */
  openEditModal: (memory: EditableMemory) => {
    const {
      setEditModalOpen,
      setEditingMemory,
      setEditContent,
      setEditType,
      setEditInternal,
    } = get();
    setEditingMemory(memory);
    setEditContent(memory.content || "");
    setEditType(memory.type || "");
    setEditInternal(memory.internal || "");
    setEditModalOpen(true);
  },

  /**
   * @description Close memory editor modal and clear edit state
   *
   * Clears all edit fields and closes the modal.
   * Used by save operations and cancel button.
   *
   * @upstream Called by: saveMemoryEdit, edit modal cancel button
   * @downstream Calls: setEditModalOpen, setEditingMemory, setEditContent, setEditType, setEditInternal
   *
   * @returns {void}
   *
   * @example
   * closeEditModal();
   * // Modal closes, all edit state cleared
   *
   * @tests apps/web/store/slices/__tests__/editor.test.js
   *   - "memory editing - openEditModal/closeEditModal" (state cleanup, modal close)
   */
  closeEditModal: () => {
    const {
      setEditModalOpen,
      setEditingMemory,
      setEditContent,
      setEditType,
      setEditInternal,
    } = get();
    setEditModalOpen(false);
    setEditingMemory(null);
    setEditContent("");
    setEditType("");
    setEditInternal("");
  },

  /**
   * @description Save edited memory fields
   *
   * Applies memory edits via memory_overrides (non-destructive).
   * Creates override record for content/type/internal edits in active branch.
   * Closes modal and refetches data on success.
   *
   * @upstream Called by: Edit modal save button
   * @downstream Calls: api.post(/memory/edit), closeEditModal, fetchAll, addLog
   *
   * @returns {Promise<void>}
   *
   * @example
   * setEditContent('New content');
   * setEditType('observation');
   * await saveMemoryEdit();
   * // Memory_override created, modal closed, data refetched
   *
   * @tests apps/web/store/slices/__tests__/editor.test.js
   *   - "memory editing - saveMemoryEdit" (validation, API call, modal close, state refresh)
   *
   * @note Non-destructive: original memory unchanged, override applies only to active branch
   */
  saveMemoryEdit: async () => {
    const {
      addLog,
      editingMemory,
      editContent,
      editType,
      editInternal,
      setIsSavingEdit,
      closeEditModal,
      fetchAll,
    } = get();
    if (!editingMemory) {
      addLog("❌ No memory being edited");
      return;
    }
    setIsSavingEdit(true);
    addLog("💾 Saving edit...");
    try {
      await api.post("/memory/edit", {
        table: editingMemory.table,
        id: editingMemory.id,
        content: editContent,
        type: editType,
        internal: editInternal,
      });
      addLog("✅ Memory edited");
      closeEditModal();
      await fetchAll();
    } catch (err: unknown) {
      addLog(
        `❌ Edit failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsSavingEdit(false);
    }
  },

  /**
   * @description Exclude a single memory (convenience wrapper)
   *
   * Single-memory convenience wrapper around excludeMemories().
   * Useful for context menu actions on individual memories.
   *
   * @upstream Called by: Memory context menu "Exclude" action
   * @downstream Calls: excludeMemories([{table, id}])
   *
   * @param {string} table - Table name (history, cold_storage, etc.)
   * @param {number} id - Memory ID
   * @returns {Promise<void>}
   *
   * @example
   * await excludeMemory('history', 42);
   * // Excludes history entry #42
   *
   * @tests apps/web/store/slices/__tests__/editor.test.js
   *   - "memory editing - excludeMemory" (wrapper validation, delegation)
   */
  excludeMemory: async (table: string, id: number) => {
    const { excludeMemories } = get();
    await excludeMemories([{ table, id }]);
  },

  /**
   * @description Permanently delete a memory entry from database
   *
   * Destructive operation that removes memory from all branches.
   * Prompts for admin password via browser prompt.
   * Only for history table entries.
   *
   * @upstream Called by: Memory context menu "Delete" action (requires password confirmation)
   * @downstream Calls: api.delete(/history/:id), fetchHistory, addLog
   *
   * @param {number} id - History entry ID to delete
   * @returns {Promise<void>}
   *
   * @example
   * await deleteMemoryPermanently(42);
   * // Prompts for password, then deletes history #42 permanently
   *
   * @tests apps/web/store/slices/__tests__/editor.test.js
   *   - "memory editing - deleteMemoryPermanently" (password validation, API call, history refresh)
   *
   * @note Uses browser prompt() for password entry (not ideal for security, but convenient)
   * @note Only for history table; other tables don't have destructive delete in UI
   */
  deleteMemoryPermanently: async (id: number) => {
    const { addLog, fetchHistory } = get();
    const password = prompt("Enter admin password to permanently delete:");
    if (!password) {
      addLog("❌ Password required for delete");
      return;
    }
    addLog(`🗑️ Deleting history #${id}...`);
    try {
      await api.delete(`/history/${id}`, { password });
      addLog("✅ History entry deleted");
      await fetchHistory();
    } catch (err: unknown) {
      addLog(
        `❌ Delete failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  // ===========================================================================
  // SYNTHETIC MEMORY ACTIONS
  // ===========================================================================

  /**
   * @description Open synthetic memory form for creating new memory
   *
   * Initializes form with defaults (type: 'thought', empty content).
   * Used when user clicks "Create Synthetic Memory" button.
   *
   * @upstream Called by: Synthetic memory creation UI button
   * @downstream Calls: setShowSyntheticForm, setEditingSynthetic, setSyntheticType, setSyntheticContent, setSyntheticInternal
   *
   * @returns {void}
   *
   * @example
   * openSyntheticForm();
   * // Form opens with defaults, user can fill in content
   *
   * @tests apps/web/store/slices/__tests__/editor.test.js
   *   - "synthetic memories - openSyntheticForm" (state initialization)
   */
  openSyntheticForm: () => {
    const {
      setShowSyntheticForm,
      setEditingSynthetic,
      setSyntheticType,
      setSyntheticContent,
      setSyntheticInternal,
    } = get();
    setEditingSynthetic(null);
    setSyntheticType("thought");
    setSyntheticContent("");
    setSyntheticInternal("");
    setShowSyntheticForm(true);
  },

  /**
   * @description Open synthetic memory form in edit mode
   *
   * Loads existing synthetic memory into form.
   * Handles art types specially: if content is data:image, loads as image instead of text.
   * Supports both 'type' and 'memory_type' field names (schema variations).
   *
   * @upstream Called by: Synthetic memory list "Edit" context menu
   * @downstream Calls: setShowSyntheticForm, setEditingSynthetic, setSyntheticType, setSyntheticContent, setSyntheticInternal, setSyntheticImage
   *
   * @param {Object} synthetic - Synthetic memory object with id, type/memory_type, content, internal
   * @returns {void}
   *
   * @example
   * openSyntheticEdit({ id: 5, type: 'art_result', content: 'data:image/png;base64,...' });
   * // Form opens in edit mode with image loaded as syntheticImage state
   *
   * @tests apps/web/store/slices/__tests__/editor.test.js
   *   - "synthetic memories - openSyntheticEdit" (art type detection, image loading)
   *
   * @note Art types (art_result, user_art) with base64 content are stored as image object in state
   */
  openSyntheticEdit: (synthetic: SyntheticMemory) => {
    const {
      setShowSyntheticForm,
      setEditingSynthetic,
      setSyntheticType,
      setSyntheticContent,
      setSyntheticInternal,
      setSyntheticImage,
    } = get();
    setEditingSynthetic(synthetic);
    const memType = synthetic.type || synthetic.memory_type || "thought";
    setSyntheticType(memType);
    const isArtType = memType === "art_result" || memType === "user_art";
    if (isArtType && synthetic.content?.startsWith("data:image")) {
      setSyntheticImage({ base64: synthetic.content, name: "existing-image" });
      setSyntheticContent("");
    } else {
      setSyntheticContent(synthetic.content || "");
      setSyntheticImage(null);
    }
    setSyntheticInternal(synthetic.internal || "");
    setShowSyntheticForm(true);
  },

  /**
   * @description Close synthetic memory form and clear state
   *
   * Clears all synthetic memory edit fields and closes the form.
   * Called by save operations, cancel button, or delete completion.
   *
   * @upstream Called by: saveSyntheticMemory, deleteSyntheticMemory, form cancel button
   * @downstream Calls: setShowSyntheticForm, setEditingSynthetic, setSyntheticContent, setSyntheticType, setSyntheticInternal, setSyntheticImage
   *
   * @returns {void}
   *
   * @example
   * closeSyntheticForm();
   * // Form closes, all state cleared
   *
   * @tests apps/web/store/slices/__tests__/editor.test.js
   *   - "synthetic memories - closeSyntheticForm" (state cleanup, form close)
   */
  closeSyntheticForm: () => {
    const {
      setShowSyntheticForm,
      setEditingSynthetic,
      setSyntheticContent,
      setSyntheticType,
      setSyntheticInternal,
      setSyntheticImage,
    } = get();
    setShowSyntheticForm(false);
    setEditingSynthetic(null);
    setSyntheticContent("");
    setSyntheticType("thought");
    setSyntheticInternal("");
    setSyntheticImage(null);
  },

  /**
   * @description Create or update a synthetic memory
   *
   * Synthetic memories are injected into a specific branch only (per-branch isolation).
   * For art types (art_result, user_art), uses syntheticImage.base64 as content.
   * For text types, uses syntheticContent.
   * Creates new synthetic if editingSynthetic is null, updates if it exists.
   *
   * @upstream Called by: Synthetic form save button
   * @downstream Calls: api.post(/memory/synthetic), api.put(/memory/synthetic/:id), closeSyntheticForm, fetchSyntheticMemories, addLog
   *
   * @returns {Promise<void>}
   *
   * @example
   * setSyntheticType('thought');
   * setSyntheticContent('New insight about memory management');
   * await saveSyntheticMemory();
   * // Creates synthetic memory in active branch
   *
   * // For art types:
   * setSyntheticType('art_result');
   * setSyntheticImage({ base64: 'data:image/png;...', name: 'generated.png' });
   * await saveSyntheticMemory();
   * // Creates synthetic memory with image content
   *
   * @tests apps/web/store/slices/__tests__/editor.test.js
   *   - "synthetic memories - saveSyntheticMemory" (validation, create vs update, art handling, state refresh)
   *
   * @note Content validation: art types require image, text types require non-empty string
   */
  saveSyntheticMemory: async () => {
    const {
      addLog,
      editingSynthetic,
      syntheticType,
      syntheticContent,
      syntheticInternal,
      syntheticImage,
      setIsSavingSynthetic,
      closeSyntheticForm,
      fetchSyntheticMemories,
    } = get();

    const isArtType =
      syntheticType === "art_result" || syntheticType === "user_art";
    const content = isArtType ? syntheticImage?.base64 : syntheticContent;

    if (!content || (typeof content === "string" && !content.trim())) {
      addLog(isArtType ? "❌ Image required" : "❌ Content required");
      return;
    }
    setIsSavingSynthetic(true);
    try {
      if (editingSynthetic) {
        await api.put(`/memory/synthetic/${editingSynthetic.id}`, {
          type: syntheticType,
          content: content,
          internal: syntheticInternal || null,
        });
        addLog("✅ Synthetic memory updated");
      } else {
        await api.post("/memory/synthetic", {
          type: syntheticType,
          content: content,
          internal: syntheticInternal || null,
        });
        addLog("✅ Synthetic memory created");
      }
      closeSyntheticForm();
      await fetchSyntheticMemories();
    } catch (err: unknown) {
      addLog(
        `❌ Save failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsSavingSynthetic(false);
    }
  },

  /**
   * @description Permanently delete a synthetic memory
   *
   * Removes synthetic memory from active branch.
   * Requires admin password for destructive operation.
   *
   * @upstream Called by: Synthetic memory list context menu "Delete" (protected by password)
   * @downstream Calls: api.delete(/memory/synthetic/:id), fetchSyntheticMemories, addLog
   *
   * @param {number} id - Synthetic memory ID to delete
   * @param {string} password - Admin password (required)
   * @returns {Promise<void>}
   *
   * @example
   * await deleteSyntheticMemory(42, 'admin-password');
   * // Permanently removes synthetic memory #42 from active branch
   *
   * @tests apps/web/store/slices/__tests__/editor.test.js
   *   - "synthetic memories - deleteSyntheticMemory" (password validation, API call, state refresh)
   *
   * @note Password required to prevent accidental deletion; only from active branch
   */
  deleteSyntheticMemory: async (id: number, password: string) => {
    const { addLog, fetchSyntheticMemories } = get();
    if (!password) {
      addLog("❌ Password required for delete");
      return;
    }
    try {
      await api.delete(`/memory/synthetic/${id}`, { password });
      addLog("🗑️ Synthetic memory deleted");
      await fetchSyntheticMemories();
    } catch (err: unknown) {
      addLog(
        `❌ Delete failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },

  // ===========================================================================
  // EXPORT/IMPORT ACTIONS
  // ===========================================================================

  exportPersonality: async () => {
    const {
      addLog,
      exportName,
      exportDescription,
      exportOptions,
      setIsExporting,
    } = get();
    if (!exportName.trim()) {
      addLog("❌ Export name required");
      return null;
    }
    setIsExporting(true);
    addLog("📦 Exporting personality...");
    try {
      const data = await api.post("/personality/export", {
        name: exportName,
        description: exportDescription,
        ...exportOptions,
      });
      addLog("✅ Export ready");
      return data as Record<string, unknown>;
    } catch (err: unknown) {
      addLog(
        `❌ Export failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    } finally {
      setIsExporting(false);
    }
  },

  previewImport: async (fileContent: Record<string, unknown>) => {
    const { addLog, importMode, setIsPreviewing, setImportPreview } = get();
    setIsPreviewing(true);
    addLog("🔍 Previewing import...");
    try {
      const data = await api.post("/personality/preview", {
        snapshot: fileContent,
        mode: importMode,
      });
      setImportPreview(data as Record<string, unknown>);
      addLog("✅ Preview ready");
    } catch (err: unknown) {
      addLog(
        `❌ Preview failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      setImportPreview(null);
    } finally {
      setIsPreviewing(false);
    }
  },

  importPersonality: async (
    fileContent: Record<string, unknown>,
    password?: string,
  ) => {
    const {
      addLog,
      importMode,
      setIsImporting,
      setImportPreview,
      setImportFile,
      fetchAll,
    } = get();
    if (importMode === "replace" && !password) {
      addLog("❌ Password required for replace mode");
      return;
    }
    setIsImporting(true);
    addLog(`📥 Importing (${importMode} mode)...`);
    try {
      await api.post("/personality/import", {
        snapshot: fileContent,
        mode: importMode,
        password: importMode === "replace" ? password : undefined,
      });
      addLog("✅ Import complete");
      setImportPreview(null);
      setImportFile(null);
      await fetchAll();
    } catch (err: unknown) {
      addLog(
        `❌ Import failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setIsImporting(false);
    }
  },

  clearImport: () => {
    const { setImportFile, setImportPreview, setImportMode } = get();
    setImportFile(null);
    setImportPreview(null);
    setImportMode("merge");
  },

  handleImportFileChange: (e: React.ChangeEvent<HTMLInputElement>) => {
    const { setImportFile, setImportPreview } = get();
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportPreview(null);
    }
  },

  readImportFile: async () => {
    const { importFile, addLog } = get();
    if (!importFile) {
      addLog("❌ No file selected");
      return null;
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        try {
          const content = JSON.parse(e.target?.result as string);
          resolve(content);
        } catch {
          addLog("❌ Invalid JSON file");
          resolve(null);
        }
      };
      reader.onerror = () => {
        addLog("❌ Failed to read file");
        resolve(null);
      };
      reader.readAsText(importFile);
    });
  },
});
