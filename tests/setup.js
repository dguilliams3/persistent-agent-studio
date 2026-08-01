/**
 * Global Test Setup
 *
 * @module tests/setup
 * @description Runs before all test files to configure the test environment
 *
 * Responsibilities:
 * - Extends Vitest expect with React Testing Library matchers
 * - Sets up global fetch mock
 * - Resets all mocks between tests for isolation
 * - Configures any global test state
 *
 * @upstream Called by: Vitest (via setupFiles in vite.config.js)
 * @downstream Calls: @testing-library/jest-dom/matchers
 *
 * @note This file runs once per test file, not once per test.
 * Use beforeEach() for per-test setup.
 */

import { vi, expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with React Testing Library DOM matchers
// This enables assertions like: expect(element).toBeInTheDocument()
expect.extend(matchers);

// Mock fetch globally - tests can override this per-test
global.fetch = vi.fn();

// Reset all mocks between tests to ensure isolation
beforeEach(() => {
  vi.clearAllMocks();
});

// Clean up after each test to prevent memory leaks
afterEach(() => {
  vi.restoreAllMocks();
});
