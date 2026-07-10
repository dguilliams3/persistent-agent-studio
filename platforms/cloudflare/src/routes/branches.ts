/**
 * Memory branch routes (platform re-export)
 *
 * @module routes/branches
 * @description Re-exports branch handler functions from @persistence/db/handlers/branches.
 */

export {
  handleGetBranches,
  handleCreateBranch,
  handleGetActiveBranch,
  handleActivateBranch,
  handleDeleteBranch,
  handleForkBranch,
  handleResetBranch,
  handleExcludeMemory,
  handleIncludeMemory,
  handleEditMemory,
  handleReorderMemory,
  handleRemoveOverride,
  handleGetSyntheticMemories,
  handleAddSyntheticMemory,
  handleUpdateSyntheticMemory,
  handleDeleteSyntheticMemory,
} from '@persistence/db/handlers/branches';
