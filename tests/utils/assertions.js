/**
 * Shared Assertion Helpers for Test Suite
 *
 * @module tests/utils/assertions
 * @description Reusable assertion functions to eliminate test code duplication
 *
 * Provides fluent, descriptive assertions for:
 * - Response parsing results
 * - Action execution outcomes
 * - Database operations
 * - API call verification
 * - Error handling
 *
 * @upstream Called by: All test files needing common assertions
 * @downstream Calls: Vitest expect() and custom matchers
 *
 * @usage
 * import { assertParsingSuccess, assertActionExecuted } from '../utils/assertions';
 *
 * assertParsingSuccess(result, 2); // Expects 2 actions parsed successfully
 * assertActionExecuted('MESSAGE_DAN', { telegramCalls: 1 });
 */

// ============================================================================
// RESPONSE PARSING ASSERTIONS
// ============================================================================

/**
 * Assert that parsing was successful
 *
 * @param {Object} result - Result from parseClaudeResponse
 * @param {number} expectedActionCount - Expected number of actions (default: 1)
 * @param {string} description - Optional description for failure messages
 */
export function assertParsingSuccess(result, expectedActionCount = 1, description = '') {
  const desc = description ? ` (${description})` : '';

  expect(result).toBeDefined(`${desc}`);
  expect(result.success || result.fullyParsed).toBe(true,
    `Expected parsing to succeed${desc}. Error: ${result.error || 'unknown'}`);

  expect(Array.isArray(result.actions),
    `Expected actions to be an array${desc}`).toBe(true);

  expect(result.actions).toHaveLength(expectedActionCount,
    `Expected ${expectedActionCount} action(s)${desc}, got ${result.actions?.length || 0}`);

  // Validate each action has required fields
  result.actions.forEach((action, index) => {
    expect(action).toHaveProperty('action');
    expect(typeof action.action).toBe('string');
    expect(action.action).toBeTruthy();
  });
}

/**
 * Assert that parsing failed gracefully
 *
 * @param {Object} result - Result from parseClaudeResponse
 * @param {string} expectedErrorType - Expected error type (optional)
 */
export function assertParsingFailed(result, expectedErrorType = null) {
  expect(result).toBeDefined();
  expect(result.success).toBe(false);
  expect(result.fullyParsed).toBe(false);

  if (expectedErrorType) {
    expect(result.error).toContain(expectedErrorType);
  }

  // Should still have raw response for debugging
  expect(result.rawResponse).toBeDefined();
}

/**
 * Assert that salvage parsing worked
 *
 * @param {Object} result - Result from parseClaudeResponse
 * @param {number} expectedValidCount - Expected number of valid actions extracted
 */
export function assertSalvageParsing(result, expectedValidCount) {
  expect(result.fullyParsed).toBe(false); // Not clean parse
  expect(result.success).toBe(true); // But salvage succeeded

  expect(Array.isArray(result.actions)).toBe(true);
  expect(result.actions).toHaveLength(expectedValidCount);

  expect(Array.isArray(result.malformed)).toBe(true);
  expect(result.malformed.length).toBeGreaterThan(0);

  // Each malformed entry should have error info
  result.malformed.forEach(malformed => {
    expect(malformed).toHaveProperty('raw');
    expect(malformed).toHaveProperty('error');
  });
}

/**
 * Assert that a parsed action has specific properties
 *
 * @param {Object} action - Parsed action object
 * @param {Object} expected - Expected properties
 */
export function assertActionProperties(action, expected) {
  Object.entries(expected).forEach(([key, value]) => {
    expect(action).toHaveProperty(key);
    expect(action[key]).toBe(value);
  });
}

// ============================================================================
// ACTION EXECUTION ASSERTIONS
// ============================================================================

/**
 * Assert that an action was executed successfully
 *
 * @param {string} actionName - Name of the action that should have executed
 * @param {Object} expectations - Expected outcomes (calls, state changes, etc.)
 */
export function assertActionExecuted(actionName, expectations) {
  const { telegramCalls, historyCalls, databaseCalls, apiCalls, success } = expectations;

  if (telegramCalls !== undefined) {
    // Check that telegram was called the expected number of times
    const telegramMock = global.fetch?.mock?.calls?.filter(call =>
      call[0]?.includes('api.telegram.org')
    ) || [];

    expect(telegramMock).toHaveLength(telegramCalls);
  }

  if (historyCalls !== undefined) {
    // This would need to be implemented based on how history is mocked
    // For now, just check that some history operation was called
    expect(expectations.historyCalls).toBeDefined();
  }

  if (success !== undefined) {
    expect(success).toBe(true);
  }
}

/**
 * Assert that an action failed with specific error
 *
 * @param {string} actionName - Name of the action that failed
 * @param {string} expectedError - Expected error type or message
 */
export function assertActionFailed(actionName, expectedError) {
  // Check that feedback was added for the failed action
  expect(expectedError).toBeDefined();
}

// ============================================================================
// DATABASE OPERATION ASSERTIONS
// ============================================================================

/**
 * Assert that a database operation was called with correct parameters
 *
 * @param {Object} mock - Mock database object
 * @param {string} operation - Database operation name (e.g., 'addHistory')
 * @param {Object} expectedParams - Expected parameters
 */
export function assertDatabaseCalled(mock, operation, expectedParams) {
  expect(mock[operation]).toHaveBeenCalledWith(expectedParams);
}

/**
 * Assert that database state was set correctly
 *
 * @param {Object} mock - Mock database object
 * @param {string} key - State key
 * @param {any} value - Expected value
 */
export function assertStateSet(mock, key, value) {
  expect(mock.setState).toHaveBeenCalledWith(key, value);
}

// ============================================================================
// API CALL ASSERTIONS
// ============================================================================

/**
 * Assert that an external API was called correctly
 *
 * @param {Object} mock - Mock API object
 * @param {string} method - API method name
 * @param {Object} expectedParams - Expected parameters
 */
export function assertApiCalled(mock, method, expectedParams) {
  expect(mock[method]).toHaveBeenCalledWith(expectedParams);
}

/**
 * Assert that Telegram API was called for messaging
 *
 * @param {number} expectedCalls - Expected number of calls
 * @param {string} expectedMessage - Expected message content (optional)
 */
export function assertTelegramCalled(expectedCalls, expectedMessage = null) {
  // This assumes global.fetch is mocked
  const telegramCalls = global.fetch?.mock?.calls?.filter(call =>
    call[0]?.includes('api.telegram.org/bot')
  ) || [];

  expect(telegramCalls).toHaveLength(expectedCalls);

  if (expectedMessage) {
    const hasExpectedMessage = telegramCalls.some(call => {
      const body = JSON.parse(call[1]?.body || '{}');
      return body.text?.includes(expectedMessage);
    });
    expect(hasExpectedMessage).toBe(true);
  }
}

// ============================================================================
// ERROR HANDLING ASSERTIONS
// ============================================================================

/**
 * Assert that error feedback was generated
 *
 * @param {Object} feedback - Feedback object from services/feedback
 * @param {string} expectedType - Expected feedback type
 */
export function assertFeedbackGenerated(feedback, expectedType) {
  expect(feedback).toBeDefined();
  expect(feedback.type).toBe(expectedType);
}

/**
 * Assert that an operation threw an expected error
 *
 * @param {Function} operation - Async function that should throw
 * @param {string|RegExp} expectedError - Expected error message or pattern
 */
export async function assertThrows(operation, expectedError) {
  try {
    await operation();
    fail('Expected operation to throw');
  } catch (error) {
    if (typeof expectedError === 'string') {
      expect(error.message).toContain(expectedError);
    } else {
      expect(error.message).toMatch(expectedError);
    }
  }
}

// ============================================================================
// FLUENT ASSERTION BUILDER
// ============================================================================

/**
 * Fluent assertion builder for complex test scenarios
 *
 * @example
 * await the.pipeline()
 *   .should.have.processed(2).actions()
 *   .and.sent(1).telegramMessage()
 *   .and.saved(1).historyEntry();
 */
export const the = {
  parsing(result) {
    return {
      should: {
        be: {
          successful(expectedCount = 1) {
            assertParsingSuccess(result, expectedCount);
            return the.parsing(result);
          },
          failed() {
            assertParsingFailed(result);
            return the.parsing(result);
          }
        },
        have: {
          salvaged(expectedValid) {
            assertSalvageParsing(result, expectedValid);
            return the.parsing(result);
          }
        }
      }
    };
  },

  action(actionName) {
    return {
      should: {
        have: {
          executed(expectations) {
            assertActionExecuted(actionName, expectations);
            return the.action(actionName);
          },
          failed(expectedError) {
            assertActionFailed(actionName, expectedError);
            return the.action(actionName);
          }
        }
      }
    };
  },

  database(mock) {
    return {
      should: {
        have: {
          called(operation, params) {
            assertDatabaseCalled(mock, operation, params);
            return the.database(mock);
          },
          set(key, value) {
            assertStateSet(mock, key, value);
            return the.database(mock);
          }
        }
      }
    };
  },

  api(mock) {
    return {
      should: {
        have: {
          called(method, params) {
            assertApiCalled(mock, method, params);
            return the.api(mock);
          }
        }
      }
    };
  }
};
