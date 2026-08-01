/**
 * Fixtures Barrel Export
 *
 * @module tests/fixtures
 * @description Central export for all test fixtures and factory functions
 *
 * This barrel file provides convenient imports for all test data factories:
 * ```javascript
 * import { createHistoryEntry, createThought, createBranch } from '../fixtures';
 * ```
 *
 * @upstream Called by: Test files
 * @downstream Calls: Individual fixture modules
 *
 * @organization
 * - History: Timeline entries (thoughts, messages, art)
 * - Memories: Cold storage, notebook, observations, summaries
 * - Branches: Memory branches, overrides, synthetic memories
 */

// =============================================================================
// HISTORY FIXTURES
// =============================================================================
// Factory functions for history timeline entries.
// Use createHistoryEntry for full control, or shorthand functions for common types.

export {
  createHistoryEntry,
  createThought,
  createMessage,
  createUserMessage,
  createArtResult,
  createHistoryBatch,
  resetIdCounter,
  getIdCounter,
} from './history.js';

// =============================================================================
// MEMORY FIXTURES
// =============================================================================
// Factory functions for persistent memory types:
// cold storage, notebook, observations, summaries, reminders.

export {
  createColdStorage,
  createNotebookEntry,
  createObservation,
  createSummary,
  createReminder,
  resetMemoryCounters,
} from './memories.js';

// =============================================================================
// BRANCH FIXTURES
// =============================================================================
// Factory functions for memory manipulation system:
// branches, overrides (exclude/edit/reorder), synthetic memories.

export {
  createBranch,
  createCanonicalBranch,
  createOverride,
  createEditOverride,
  createExcludeOverride,
  createSyntheticMemory,
  resetBranchCounters,
} from './branches.js';

// =============================================================================
// ACTION FIXTURES
// =============================================================================
// Comprehensive fixtures for testing Claude action parsing and execution.
// Includes valid actions, malformed inputs, and execution test cases.

export {
  validActions,
  malformedInputs,
  actionTestCases,
  getAllValidActions,
  getAllMalformedInputs,
  createActionJson,
  createMalformedJson
} from './actions.js';

// =============================================================================
// UTILITY: RESET ALL
// =============================================================================

/**
 * @description Reset all fixture counters for complete test isolation
 *
 * Call in beforeEach() if you need predictable IDs across all fixtures.
 */
export function resetAllCounters() {
  const { resetIdCounter } = require('./history.js');
  const { resetMemoryCounters } = require('./memories.js');
  const { resetBranchCounters } = require('./branches.js');

  resetIdCounter();
  resetMemoryCounters();
  resetBranchCounters();
}
