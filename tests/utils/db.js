/**
 * D1 Database Mock Utilities
 *
 * @module tests/utils/db
 * @description Mock utilities for testing D1 database operations
 *
 * Simulates the D1 prepare/bind/run pattern used by Cloudflare Workers.
 * Includes an in-memory storage for testing data persistence within a test.
 *
 * @upstream Called by: Worker tests, API route tests
 * @downstream Calls: vitest vi.fn()
 *
 * @usage
 * import { createMockD1, seedHistory, seedMemories } from '../utils/db';
 *
 * const db = createMockD1();
 * seedHistory(db, [createHistoryEntry()]);
 *
 * @note D1 accepts null but NOT undefined. Mock reflects this behavior.
 */

import { vi } from 'vitest';

/**
 * @description Create a mock D1 database instance
 *
 * The mock provides:
 * - prepare() → returns chainable bind/first/all/run methods
 * - batch() → batch execution
 * - exec() → raw SQL execution
 * - _storage → internal Map for seeding test data
 * - _seed() → helper to add data
 * - _clear() → helper to reset state
 *
 * @returns {Object} Mock D1 database
 *
 * @example
 * const db = createMockD1();
 * db._seed('history:1', { id: 1, content: 'test' });
 * const result = await db.prepare('SELECT * FROM history').all();
 */
export function createMockD1() {
  const storage = new Map();

  const createStatement = (sql) => ({
    bind: vi.fn((...args) => ({
      first: vi.fn(async () => {
        // Look for exact match first
        const key = `${sql}:${JSON.stringify(args)}`;
        if (storage.has(key)) return storage.get(key);

        // Try to find by ID if it looks like a select
        if (sql.toLowerCase().includes('where') && args.length > 0) {
          for (const [k, v] of storage.entries()) {
            if (v && v.id === args[0]) return v;
          }
        }
        return null;
      }),
      all: vi.fn(async () => ({
        results: [...storage.values()].filter(Boolean),
      })),
      run: vi.fn(async () => ({
        success: true,
        meta: { changes: 1, last_row_id: storage.size + 1 },
      })),
    })),
    first: vi.fn(async () => {
      const values = [...storage.values()].filter(Boolean);
      return values[0] || null;
    }),
    all: vi.fn(async () => ({
      results: [...storage.values()].filter(Boolean),
    })),
    run: vi.fn(async () => ({
      success: true,
      meta: { changes: 1 },
    })),
  });

  return {
    prepare: vi.fn((sql) => createStatement(sql)),

    batch: vi.fn(async (statements) =>
      statements.map(() => ({ success: true, meta: { changes: 1 } }))
    ),

    exec: vi.fn(async () => ({ success: true })),

    // Test helpers (prefixed with _ to indicate internal use)
    _storage: storage,

    /**
     * @description Seed a value into storage
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     */
    _seed: (key, value) => storage.set(key, value),

    /**
     * @description Clear all seeded data
     */
    _clear: () => storage.clear(),

    /**
     * @description Get all values as array
     * @returns {Array} All stored values
     */
    _getAll: () => [...storage.values()].filter(Boolean),
  };
}

/**
 * @description Seed history entries into the mock database
 *
 * @param {Object} db - Mock D1 database
 * @param {Array} entries - Array of history entries
 *
 * @example
 * const db = createMockD1();
 * seedHistory(db, createHistoryBatch(10));
 */
export function seedHistory(db, entries) {
  for (const entry of entries) {
    db._seed(`history:${entry.id}`, entry);
  }
}

/**
 * @description Seed cold storage entries
 *
 * @param {Object} db - Mock D1 database
 * @param {Array} entries - Array of cold storage entries
 */
export function seedColdStorage(db, entries) {
  for (const entry of entries) {
    db._seed(`cold_storage:${entry.id}`, entry);
  }
}

/**
 * @description Seed notebook entries
 *
 * @param {Object} db - Mock D1 database
 * @param {Array} entries - Array of notebook entries
 */
export function seedNotebook(db, entries) {
  for (const entry of entries) {
    db._seed(`notebook:${entry.id}`, entry);
  }
}

/**
 * @description Seed branch data
 *
 * @param {Object} db - Mock D1 database
 * @param {Array} branches - Array of branch entries
 */
export function seedBranches(db, branches) {
  for (const branch of branches) {
    db._seed(`branch:${branch.id}`, branch);
  }
}

/**
 * @description Create a mock Cloudflare Worker env object
 *
 * @param {Object} overrides - Override specific bindings
 * @returns {Object} Mock env object
 *
 * @example
 * const env = createMockEnv({ DB: customMockDb });
 */
export function createMockEnv(overrides = {}) {
  return {
    DB: createMockD1(),
    AI: {
      run: vi.fn(async () => ({ response: 'mock AI response' })),
    },
    ANTHROPIC_API_KEY: 'test-api-key',
    TELEGRAM_BOT_TOKEN: 'test-bot-token',
    DISCORD_WEBHOOK: 'https://discord.test/webhook',
    ADMIN_PASSWORD: 'test-password',
    ...overrides,
  };
}
