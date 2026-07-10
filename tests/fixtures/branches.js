/**
 * Branch and Override Fixtures
 *
 * @module tests/fixtures/branches
 * @description Factory functions for memory branches, overrides, and synthetic memories
 *
 * Covers memory manipulation tables:
 * - memory_branches: Branch metadata
 * - memory_overrides: Non-destructive edits
 * - synthetic_memories: Injected memories
 *
 * @upstream Called by: Test files needing branch/override data
 * @downstream Calls: None (pure data factories)
 *
 * @usage
 * import { createBranch, createOverride, createSyntheticMemory } from '../fixtures';
 */

let branchCounter = 0;
let overrideCounter = 0;
let syntheticCounter = 0;

/**
 * @description Create a memory branch
 *
 * @param {Object} overrides - Fields to override
 * @returns {Object} Branch entry
 *
 * @example
 * createBranch({ name: 'experiment-1', is_active: true })
 */
export function createBranch(overrides = {}) {
  branchCounter++;
  return {
    id: branchCounter,
    name: `branch-${branchCounter}`,
    description: `Test branch ${branchCounter}`,
    is_active: branchCounter === 1, // First branch is active by default
    parent_branch: null,
    created_at: new Date().toISOString().slice(0, -1),
    ...overrides,
  };
}

/**
 * @description Create the canonical (main) branch
 *
 * @param {Object} overrides - Fields to override
 * @returns {Object} Canonical branch entry
 */
export function createCanonicalBranch(overrides = {}) {
  return createBranch({
    name: 'canonical',
    description: 'Main timeline',
    is_active: true,
    parent_branch: null,
    ...overrides,
  });
}

/**
 * @description Create a memory override (non-destructive edit)
 *
 * @param {Object} overrides - Fields to override
 * @returns {Object} Override entry
 *
 * @example
 * createOverride({
 *   branch_id: 1,
 *   target_table: 'history',
 *   target_id: 42,
 *   override_type: 'exclude'
 * })
 */
export function createOverride(overrides = {}) {
  overrideCounter++;
  return {
    id: overrideCounter,
    branch_id: 1,
    target_table: 'history',
    target_id: 1,
    override_type: 'exclude', // exclude | edit | reorder
    override_data: null,
    created_at: new Date().toISOString().slice(0, -1),
    ...overrides,
  };
}

/**
 * @description Create an edit override with modified content
 *
 * @param {number} targetId - ID of the entry to edit
 * @param {string} newContent - New content value
 * @param {Object} overrides - Additional overrides
 * @returns {Object} Edit override entry
 */
export function createEditOverride(targetId, newContent, overrides = {}) {
  return createOverride({
    target_id: targetId,
    override_type: 'edit',
    override_data: JSON.stringify({ content: newContent }),
    ...overrides,
  });
}

/**
 * @description Create an exclude override
 *
 * @param {number} targetId - ID of the entry to exclude
 * @param {Object} overrides - Additional overrides
 * @returns {Object} Exclude override entry
 */
export function createExcludeOverride(targetId, overrides = {}) {
  return createOverride({
    target_id: targetId,
    override_type: 'exclude',
    override_data: null,
    ...overrides,
  });
}

/**
 * @description Create a synthetic memory
 *
 * @param {Object} overrides - Fields to override
 * @returns {Object} Synthetic memory entry
 */
export function createSyntheticMemory(overrides = {}) {
  syntheticCounter++;
  return {
    id: syntheticCounter,
    branch_id: 1,
    memory_type: 'thought',
    content: 'Injected synthetic memory',
    position_timestamp: new Date().toISOString().slice(0, -1),
    created_at: new Date().toISOString().slice(0, -1),
    ...overrides,
  };
}

/**
 * @description Reset all branch-related counters
 */
export function resetBranchCounters() {
  branchCounter = 0;
  overrideCounter = 0;
  syntheticCounter = 0;
}
