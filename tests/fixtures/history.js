/**
 * History Entry Fixtures
 *
 * @module tests/fixtures/history
 * @description Factory functions for creating history entry test data
 *
 * Factory functions generate isolated test data with sensible defaults.
 * Override any field by passing an object with the fields to customize.
 *
 * @upstream Called by: Test files needing history entries
 * @downstream Calls: None (pure data factories)
 *
 * @usage
 * import { createHistoryEntry, createThought, createHistoryBatch } from '../fixtures';
 *
 * const entry = createHistoryEntry({ type: 'thought', content: 'test' });
 * const thought = createThought('my thought');
 * const batch = createHistoryBatch(10, createThought);
 */

let idCounter = 0;

/**
 * @description Create a history entry with sensible defaults
 *
 * @param {Object} overrides - Fields to override
 * @returns {Object} History entry object
 *
 * @example
 * createHistoryEntry({ type: 'user_message', content: 'hello' })
 * // => { id: 1, type: 'user_message', content: 'hello', ... }
 */
export function createHistoryEntry(overrides = {}) {
  idCounter++;
  return {
    id: idCounter,
    type: 'thought',
    content: 'Default test content',
    internal: null,
    created_at: new Date().toISOString().slice(0, -1), // Remove Z for D1 format
    summarized_at: null,
    ...overrides,
  };
}

/**
 * @description Create a thought entry (shorthand)
 *
 * @param {string} content - Thought content
 * @param {Object} overrides - Additional overrides
 * @returns {Object} Thought history entry
 */
export function createThought(content, overrides = {}) {
  return createHistoryEntry({ type: 'thought', content, ...overrides });
}

/**
 * @description Create a message_to_dan entry
 *
 * @param {string} content - Message content
 * @param {Object} overrides - Additional overrides
 * @returns {Object} Message history entry
 */
export function createMessage(content, overrides = {}) {
  return createHistoryEntry({ type: 'message_to_dan', content, ...overrides });
}

/**
 * @description Create a user_message entry
 *
 * @param {string} content - the user's message content
 * @param {Object} overrides - Additional overrides
 * @returns {Object} user message history entry
 */
export function createUserMessage(content, overrides = {}) {
  return createHistoryEntry({ type: 'user_message', content, ...overrides });
}

/**
 * @description Create art_result entry
 *
 * @param {string} prompt - Art generation prompt
 * @param {Object} overrides - Additional overrides
 * @returns {Object} Art result history entry
 */
export function createArtResult(prompt, overrides = {}) {
  return createHistoryEntry({
    type: 'art_result',
    content: prompt,
    internal: 'data:image/jpeg;base64,/9j/mockBase64Data',
    ...overrides,
  });
}

/**
 * @description Create a batch of history entries
 *
 * @param {number} count - Number of entries to create
 * @param {Function} factory - Factory function to use (default: createThought)
 * @returns {Array} Array of history entries
 *
 * @example
 * const thoughts = createHistoryBatch(5, createThought);
 * const messages = createHistoryBatch(3, (i) => createMessage(`Message ${i}`));
 */
export function createHistoryBatch(count, factory = createThought) {
  return Array.from({ length: count }, (_, i) => {
    if (typeof factory === 'function' && factory.length === 0) {
      return factory();
    }
    return factory(`Entry ${i + 1}`);
  });
}

/**
 * @description Reset the ID counter between test suites
 *
 * Call this in beforeEach() if you need predictable IDs.
 */
export function resetIdCounter() {
  idCounter = 0;
}

/**
 * @description Get the current ID counter value (for assertions)
 * @returns {number} Current counter value
 */
export function getIdCounter() {
  return idCounter;
}
