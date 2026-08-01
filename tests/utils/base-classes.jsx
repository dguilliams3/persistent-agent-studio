/**
 * Base Test Classes for Eliminating Test Setup Duplication
 *
 * @module tests/utils/base-classes
 * @description Reusable base classes for different test categories
 *
 * Provides common setup/teardown logic for:
 * - Pipeline tests (parsing, action execution, context assembly)
 * - API integration tests
 * - Component tests
 * - Database integration tests
 *
 * @upstream Called by: Test files extending these base classes
 * @downstream Calls: Vitest setup/teardown, mock utilities
 *
 * @usage
 * import { PipelineTestBase } from '../utils/base-classes';
 *
 * class ResponseParserTest extends PipelineTestBase {
 *   async testParsing() {
 *     // Common setup already done
 *     const result = parseClaudeResponse('...');
 *     // assertions
 *   }
 * }
 */

import { vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// PIPELINE TEST BASE CLASS
// ============================================================================

/**
 * Base class for pipeline-related tests (parsing, execution, context)
 * Handles common mocking and setup for pipeline components
 */
export class PipelineTestBase {
  constructor() {
    this.mocks = {
      database: this.createDatabaseMock(),
      telegram: this.createTelegramMock(),
      anthropic: this.createAnthropicMock(),
      cloudflare: this.createCloudflareMock(),
      elevenlabs: this.createElevenlabsMock()
    };
  }

  /**
   * Setup common mocks before each test
   */
  async setup() {
    // Mock external APIs
    this.setupGlobalFetchMock();
    this.setupDatabaseMocks();
    this.setupServiceMocks();

    // Clear any previous state
    vi.clearAllMocks();
  }

  /**
   * Clean up after each test
   */
  async teardown() {
    vi.restoreAllMocks();
  }

  /**
   * Create mock database with common operations
   */
  createDatabaseMock() {
    return {
      getState: vi.fn(),
      setState: vi.fn(),
      addHistory: vi.fn(),
      getHistory: vi.fn(),
      addColdStorage: vi.fn(),
      saveNote: vi.fn(),
      saveObservation: vi.fn(),
      addReminder: vi.fn()
    };
  }

  /**
   * Create mock Telegram API
   */
  createTelegramMock() {
    return {
      sendMessage: vi.fn().mockResolvedValue({ ok: true }),
      sendPhoto: vi.fn().mockResolvedValue({ ok: true }),
      sendDocument: vi.fn().mockResolvedValue({ ok: true }),
      sendVoice: vi.fn().mockResolvedValue({ ok: true })
    };
  }

  /**
   * Create mock Anthropic API
   */
  createAnthropicMock() {
    return {
      messages: vi.fn(),
      webSearch: vi.fn()
    };
  }

  /**
   * Create mock Cloudflare AI
   */
  createCloudflareMock() {
    return {
      generateImage: vi.fn(),
      transcribeAudio: vi.fn(),
      generateEmbedding: vi.fn()
    };
  }

  /**
   * Create mock ElevenLabs API
   */
  createElevenlabsMock() {
    return {
      textToSpeech: vi.fn()
    };
  }

  /**
   * Setup global fetch mock for API calls
   */
  setupGlobalFetchMock() {
    global.fetch = vi.fn();
  }

  /**
   * Setup database operation mocks
   *
   * NOTE: ES module exports are read-only - vi.spyOn() cannot mock them.
   * Tests using this class should use vi.mock() at the top level instead.
   * This method is now a no-op; mock objects are available via this.mocks.database
   */
  setupDatabaseMocks() {
    // No-op: Tests should use vi.mock() at top level for ES module mocking
    // Mock objects are available at this.mocks.database for direct use
  }

  /**
   * Setup service layer mocks
   *
   * NOTE: ES module exports are read-only - vi.spyOn() cannot mock them.
   * Tests using this class should use vi.mock() at the top level instead.
   * This method is now a no-op; mock objects are available via this.mocks.*
   */
  setupServiceMocks() {
    // No-op: Tests should use vi.mock() at top level for ES module mocking
    // Mock objects are available at this.mocks.telegram, this.mocks.cloudflare, etc.
  }

  /**
   * Configure mock responses for a test scenario
   * @param {Object} config - Mock configuration
   *
   * Supports two patterns:
   * 1. Pass a mock function: { database: { getState: vi.fn().mockResolvedValue('value') } }
   * 2. Pass a value: { database: { getState: 'value' } } → calls mockResolvedValue('value')
   */
  configureMocks(config) {
    Object.entries(config).forEach(([service, responses]) => {
      // Ensure the service exists in mocks
      if (!this.mocks[service]) {
        this.mocks[service] = {};
      }

      Object.entries(responses).forEach(([method, response]) => {
        // If response is already a mock function, use it directly
        if (typeof response === 'function' && response._isMockFunction) {
          this.mocks[service][method] = response;
        } else if (typeof response === 'function') {
          // If it's a regular function (like vi.fn()), use it directly
          this.mocks[service][method] = response;
        } else {
          // If it's a value, ensure mock exists and set the resolved value
          if (!this.mocks[service][method]) {
            this.mocks[service][method] = vi.fn();
          }
          this.mocks[service][method].mockResolvedValue(response);
        }
      });
    });
  }

  /**
   * Reset all mocks to default state
   */
  resetMocks() {
    Object.values(this.mocks).forEach(service => {
      Object.values(service).forEach(mock => {
        if (typeof mock.mockReset === 'function') {
          mock.mockReset();
        }
      });
    });
  }
}

// ============================================================================
// API TEST BASE CLASS
// ============================================================================

/**
 * Base class for API endpoint tests
 * Handles HTTP request mocking and response validation
 */
export class ApiTestBase {
  constructor() {
    this.app = null; // Would be set up in setup()
    this.request = this.createRequestMock();
    this.response = this.createResponseMock();
  }

  async setup() {
    // Setup worker environment mock
    this.setupWorkerEnvironment();
    vi.clearAllMocks();
  }

  async teardown() {
    vi.restoreAllMocks();
  }

  createRequestMock() {
    return {
      method: 'GET',
      url: 'http://localhost/test',
      headers: new Map(),
      json: vi.fn(),
      text: vi.fn()
    };
  }

  createResponseMock() {
    return {
      status: 200,
      headers: new Map(),
      json: vi.fn(),
      text: vi.fn()
    };
  }

  setupWorkerEnvironment() {
    // Mock Cloudflare Worker environment
    global.Request = vi.fn();
    global.Response = vi.fn();
  }

  /**
   * Create a mock request for testing
   * @param {string} method - HTTP method
   * @param {string} path - Request path
   * @param {Object} body - Request body
   * @param {Object} headers - Request headers
   */
  createMockRequest(method = 'GET', path = '/', body = null, headers = {}) {
    const url = `http://localhost${path}`;
    const request = new Request(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    // Add convenience methods
    request.json = vi.fn().mockResolvedValue(body);
    request.text = vi.fn().mockResolvedValue(JSON.stringify(body));

    return request;
  }

  /**
   * Assert API response matches expectations
   * @param {Response} response - API response
   * @param {Object} expected - Expected response properties
   */
  assertApiResponse(response, expected) {
    expect(response.status).toBe(expected.status || 200);

    if (expected.headers) {
      Object.entries(expected.headers).forEach(([key, value]) => {
        expect(response.headers.get(key)).toBe(value);
      });
    }

    if (expected.body) {
      expect(response.json).toHaveBeenCalled();
      // Additional body validation would go here
    }
  }
}

// ============================================================================
// COMPONENT TEST BASE CLASS
// ============================================================================

/**
 * Base class for React component tests
 * Handles rendering, user events, and cleanup
 */
export class ComponentTestBase {
  constructor() {
    this.user = null; // Set up in setup()
    this.container = null;
  }

  async setup() {
    // Import user-event setup
    const { setup } = await import('@testing-library/user-event');
    this.user = setup();

    vi.clearAllMocks();
  }

  async teardown() {
    // Clean up any mounted components
    if (this.container) {
      this.container.unmount();
      this.container = null;
    }

    vi.restoreAllMocks();
  }

  /**
   * Render a component with React Testing Library
   * @param {React.Component} Component - Component to render
   * @param {Object} props - Component props
   * @param {Object} options - Render options
   */
  async renderComponent(Component, props = {}, options = {}) {
    const { render } = await import('@testing-library/react');
    this.container = render(<Component {...props} />, options);
    return this.container;
  }

  /**
   * Perform user interaction
   * @param {Function} interaction - User interaction function
   */
  async interact(interaction) {
    await interaction(this.user);
  }

  /**
   * Wait for element to appear
   * @param {Function} query - Query function
   */
  async waitFor(query) {
    const { waitFor } = await import('@testing-library/react');
    return waitFor(query);
  }

  /**
   * Find element by various methods
   * @param {string} text - Text to find
   * @param {Object} options - Query options
   */
  getByText(text, options = {}) {
    return this.container.getByText(text, options);
  }

  /**
   * Query for element (returns null if not found)
   * @param {string} text - Text to query
   */
  queryByText(text) {
    return this.container.queryByText(text);
  }
}

// ============================================================================
// DATABASE TEST BASE CLASS
// ============================================================================

/**
 * Base class for database integration tests
 * Uses Miniflare for realistic D1 testing
 */
export class DatabaseTestBase {
  constructor() {
    this.db = null; // Miniflare D1 instance
    this.fixtures = {};
  }

  async setup() {
    // Setup Miniflare D1 database
    await this.setupMiniflare();
    await this.loadFixtures();
    vi.clearAllMocks();
  }

  async teardown() {
    await this.cleanupDatabase();
    vi.restoreAllMocks();
  }

  async setupMiniflare() {
    // Miniflare setup would go here
    // This is a placeholder for the actual implementation
    this.db = {}; // Mock for now
  }

  async loadFixtures() {
    // Load test data fixtures
    const { createHistoryEntry, createColdStorage } = await import('../fixtures');
    this.fixtures.history = createHistoryEntry();
    this.fixtures.coldStorage = createColdStorage();
  }

  async cleanupDatabase() {
    // Clean up test data
    // Implementation depends on Miniflare setup
  }

  /**
   * Insert test data
   * @param {string} table - Table name
   * @param {Object} data - Data to insert
   */
  async insertTestData(table, data) {
    // Implementation would use Miniflare D1
  }

  /**
   * Clear test data
   * @param {string} table - Table name
   */
  async clearTestData(table) {
    // Implementation would use Miniflare D1
  }
}

// ============================================================================
// TEST LIFECYCLE HELPERS
// ============================================================================

/**
 * Create a test suite with automatic setup/teardown
 * @param {string} name - Test suite name
 * @param {Class} BaseClass - Base test class to extend
 * @param {Function} testBody - Test suite body
 */
export function createTestSuite(name, BaseClass, testBody) {
  describe(name, () => {
    let testInstance;

    beforeEach(async () => {
      testInstance = new BaseClass();
      await testInstance.setup();
    });

    afterEach(async () => {
      await testInstance.teardown();
    });

    testBody(testInstance);
  });
}

/**
 * Run test with specific mock configuration
 * @param {string} testName - Test name
 * @param {Object} mockConfig - Mock configuration
 * @param {Function} testFn - Test function
 */
export function withMocks(testName, mockConfig, testFn) {
  test(testName, async () => {
    // Setup mocks according to config
    Object.entries(mockConfig).forEach(([service, config]) => {
      // Apply mock configuration
    });

    await testFn();
  });
}
