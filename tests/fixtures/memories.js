/**
 * Memory Fixtures
 *
 * @module tests/fixtures/memories
 * @description Factory functions for cold storage, notebook, observations, and summaries
 *
 * Covers all memory-related tables in the D1 database:
 * - cold_storage: Permanent memories
 * - notebook: Saved notes
 * - observations: Observations about the user
 * - summaries: Compressed history summaries
 *
 * @upstream Called by: Test files needing memory data
 * @downstream Calls: None (pure data factories)
 *
 * @usage
 * import { createColdStorage, createNotebookEntry, createSummary } from '../fixtures';
 */

let coldStorageCounter = 0;
let notebookCounter = 0;
let observationCounter = 0;
let summaryCounter = 0;

/**
 * @description Create a cold storage entry
 *
 * @param {Object} overrides - Fields to override
 * @returns {Object} Cold storage entry
 */
export function createColdStorage(overrides = {}) {
  coldStorageCounter++;
  return {
    id: coldStorageCounter,
    content: 'A permanent memory worth preserving',
    context: 'Test context',
    created_at: new Date().toISOString().slice(0, -1),
    ...overrides,
  };
}

/**
 * @description Create a notebook entry
 *
 * @param {Object} overrides - Fields to override
 * @returns {Object} Notebook entry
 */
export function createNotebookEntry(overrides = {}) {
  notebookCounter++;
  return {
    id: notebookCounter,
    title: `Note ${notebookCounter}`,
    content: 'Test note content',
    summary: null,
    created_at: new Date().toISOString().slice(0, -1),
    ...overrides,
  };
}

/**
 * @description Create an observation about the user
 *
 * @param {Object} overrides - Fields to override
 * @returns {Object} Observation entry
 */
export function createObservation(overrides = {}) {
  observationCounter++;
  return {
    id: observationCounter,
    title: `Observation ${observationCounter}`,
    content: 'An observation about the user',
    summary: 'Brief summary',
    created_at: new Date().toISOString().slice(0, -1),
    deleted_at: null, // Soft delete support
    ...overrides,
  };
}

/**
 * @description Create a summary entry
 *
 * @param {Object} overrides - Fields to override
 * @returns {Object} Summary entry
 */
export function createSummary(overrides = {}) {
  summaryCounter++;
  return {
    id: summaryCounter,
    summary: 'Compressed history summary text',
    message_count: 10,
    covered_range: '2026-01-01 to 2026-01-02',
    created_at: new Date().toISOString().slice(0, -1),
    tier: overrides.tier || 'tail',
    tier_position: overrides.tier_position || null,
    ...overrides,
  };
}

/**
 * @description Create a reminder entry
 *
 * @param {Object} overrides - Fields to override
 * @returns {Object} Reminder entry
 */
export function createReminder(overrides = {}) {
  return {
    id: 1,
    content: 'Remember to check on something',
    condition: 'When the user returns',
    triggered: 0,
    created_at: new Date().toISOString().slice(0, -1),
    deleted_at: null,
    ...overrides,
  };
}

/**
 * @description Reset all counters (call in beforeEach for predictable IDs)
 */
export function resetMemoryCounters() {
  coldStorageCounter = 0;
  notebookCounter = 0;
  observationCounter = 0;
  summaryCounter = 0;
}
