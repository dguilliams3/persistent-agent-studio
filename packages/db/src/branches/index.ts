/**
 * Memory branching system barrel file
 *
 * @module @persistence/db/branches
 * @description Centralized exports for the memory branching system.
 *
 * The branching system enables NON-DESTRUCTIVE memory manipulation:
 * - Canonical history remains immutable (the "main" branch)
 * - Other branches can exclude, edit, or reorder memories
 * - Synthetic memories can be inserted that don't exist in canonical history
 *
 * Re-exports all branching functions from individual modules for convenient importing:
 *   import { getBranches, getOverrides, getSyntheticMemories } from '@persistence/db/branches';
 *
 * Or import from specific modules for clarity:
 *   import { getBranches } from '@persistence/db/branches/branches';
 *
 * @upstream Called by:
 *   - packages/db/src/index.ts - Main barrel file re-exports
 *   - platforms/cloudflare/src/ - Routes and context assembly
 */

// =============================================================================
// TYPES
// =============================================================================
// One-type-per-file definitions for branches, overrides, and synthetic memories.
// =============================================================================
export type { Branch } from './Branch';
export type { BranchResult } from './BranchResult';
export type { MemoryOverride } from './MemoryOverride';
export type { EditData } from './EditData';
export type { ReorderData } from './ReorderData';
export type { ResetResult } from './ResetResult';
export type { SyntheticMemory } from './SyntheticMemory';
export type { SyntheticResult } from './SyntheticResult';
export type { SyntheticPlacement } from './SyntheticPlacement';
export type { SyntheticUpdates } from './SyntheticUpdates';

// =============================================================================
// BRANCH MANAGEMENT
// =============================================================================
// Core CRUD operations for memory branches. Branches represent different
// "views" of the memory timeline. Only one branch can be active at a time.
//
// @upstream: Route handlers, context assembly
// @downstream: D1 queries on memory_branches table
// =============================================================================
export {
  getBranches,
  getActiveBranch,
  getBranchByName,
  createBranch,
  activateBranch,
  deleteBranch,
  forkBranch,
} from './branches';

// =============================================================================
// MEMORY OVERRIDES
// =============================================================================
// Operations for excluding, editing, or reordering canonical memories.
// Overrides are branch-specific and don't modify the original data.
//
// @upstream: Route handlers for memory manipulation
// @downstream: D1 queries on memory_overrides table
// =============================================================================
export {
  getOverrides,
  getOverridesForEntry,
  excludeMemory,
  includeMemory,
  editMemory,
  reorderMemory,
  removeOverride,
  resetBranch,
} from './overrides';

// =============================================================================
// SYNTHETIC MEMORIES
// =============================================================================
// Operations for adding new memories that don't exist in canonical history.
// Synthetic memories only appear in the branch they're created for.
//
// @upstream: Route handlers for synthetic memory management
// @downstream: D1 queries on synthetic_memories table
// =============================================================================
export {
  getSyntheticMemories,
  addSyntheticMemory,
  updateSyntheticMemory,
  deleteSyntheticMemory,
} from './synthetic';
