/**
 * Test Utilities Barrel Export
 *
 * @module tests/utils
 * @description Central export for all test utility functions
 *
 * Provides convenient imports for test utilities:
 * ```javascript
 * import { createMockD1, mockApiResponse, render, screen } from '../utils';
 * ```
 *
 * @upstream Called by: Test files
 * @downstream Calls: Individual utility modules
 *
 * @organization
 * - Database: D1 mock, seeding functions, env mocks
 * - API: Fetch mocking, response helpers
 * - Render: React component testing, user events
 */

// =============================================================================
// DATABASE UTILITIES
// =============================================================================
// D1 database mocking for worker tests.
// createMockD1() provides prepare/bind/run pattern simulation.

export {
  createMockD1,
  seedHistory,
  seedColdStorage,
  seedNotebook,
  seedBranches,
  createMockEnv,
} from './db.js';

// =============================================================================
// API UTILITIES
// =============================================================================
// Fetch mocking for API client and hook tests.
// Use mockApiResponse() for quick success mocks.

export {
  mockFetch,
  mockApiResponse,
  mockApiError,
  mockNetworkError,
  mockFetchByUrl,
  mockFetchSequence,
  resetFetchMock,
} from './api.js';

// =============================================================================
// RENDER UTILITIES
// =============================================================================
// React component testing helpers.
// render() provides user event setup automatically.

export {
  render,
  renderHook,
  screen,
  waitFor,
  within,
  waitForLoadingToFinish,
  isVisible,
  createMockEvent,
} from './render.js';

// =============================================================================
// ASSERTION HELPERS
// =============================================================================
// Shared assertion functions to eliminate test code duplication.
// Provides fluent, descriptive assertions for parsing, execution, and API calls.

export {
  assertParsingSuccess,
  assertParsingFailed,
  assertSalvageParsing,
  assertActionProperties,
  assertActionExecuted,
  assertActionFailed,
  assertDatabaseCalled,
  assertStateSet,
  assertApiCalled,
  assertTelegramCalled,
  assertFeedbackGenerated,
  assertThrows,
  the, // Fluent assertion builder
} from './assertions.js';

// =============================================================================
// BASE TEST CLASSES
// =============================================================================
// Reusable base classes for different test categories.
// Provides common setup/teardown logic to eliminate duplication.

export {
  PipelineTestBase,
  ApiTestBase,
  ComponentTestBase,
  DatabaseTestBase,
  createTestSuite,
  withMocks,
} from './base-classes.jsx';

// =============================================================================
// PARAMETERIZED TESTING
// =============================================================================
// Utilities for creating parameterized tests to eliminate repetitive code.
// Supports scenario-based, matrix, and data-driven testing patterns.

export {
  describeScenarios,
  describeScenariosOnly,
  describeScenariosSkip,
  matrixTest,
  conditionalTest,
  environmentTest,
  csvTest,
  asyncTest,
  performanceTest,
  generateTests,
  testFactory,
} from './parameterized-tests.js';