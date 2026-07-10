/**
 * Unit tests for persona-scoped query builders
 *
 * @module @persistence/db/scoped-query.test
 * @description Tests scopedSelect, scopedUpdate, scopedDelete to verify:
 *   1. Persona filter is always applied
 *   2. Additional .where() conditions are AND-ed with persona filter
 *   3. Error thrown for tables without personaId column
 *   4. Pass-through methods (.all, .get, .orderBy, .limit) work correctly
 *
 * @upstream Exercises: packages/db/src/scoped-query.ts
 * @downstream Mocks: getActivePersonaId from ./persona-scope (resolves to persona id 42)
 * @pattern mock-at-boundary — persona-scope is mocked at import time so tests are pure unit tests
 *   with no database dependency; the real getActivePersonaId integration is tested separately
 * @covers scoped-query.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getActivePersonaId before importing the module under test
vi.mock('./persona-scope', () => ({
  getActivePersonaId: vi.fn().mockResolvedValue(42),
}));

import { scopedSelect, scopedUpdate, scopedDelete } from './scoped-query';
import { getActivePersonaId } from './persona-scope';
import { eq, isNull } from 'drizzle-orm';

// =============================================================================
// Test fixtures — minimal table-like objects that mimic Drizzle table shape
// =============================================================================

/**
 * Creates a mock Drizzle query builder chain.
 * Each method returns a new object with all chainable methods,
 * allowing us to verify the full chain is called correctly.
 */
function createMockQueryChain() {
  const chain: Record<string, any> = {};
  const methodNames = ['where', 'orderBy', 'limit', 'offset', 'all', 'get', 'run', 'returning', 'from', 'set'];
  for (const method of methodNames) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  // .all() and .get() should resolve to results
  chain.all = vi.fn().mockResolvedValue([{ id: 1 }]);
  chain.get = vi.fn().mockResolvedValue({ id: 1 });
  chain.run = vi.fn().mockResolvedValue({ changes: 1 });
  chain.returning = vi.fn().mockResolvedValue([{ id: 1 }]);
  // .where(), .orderBy(), .limit(), .offset() return the chain for further chaining
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  return chain;
}

/**
 * Creates a mock DrizzleD1 db object.
 */
function createMockDatabase() {
  const selectChain = createMockQueryChain();
  const updateChain = createMockQueryChain();
  const deleteChain = createMockQueryChain();

  return {
    database: {
      select: vi.fn().mockReturnValue(selectChain),
      update: vi.fn().mockReturnValue(updateChain),
      delete: vi.fn().mockReturnValue(deleteChain),
    } as any,
    selectChain,
    updateChain,
    deleteChain,
  };
}

/** Mock persona-scoped table (has personaId column) */
const personaScopedTable = {
  personaId: { name: 'persona_id' },
  id: { name: 'id' },
  archivedAt: { name: 'archived_at' },
  createdAt: { name: 'created_at' },
} as any;

/** Mock non-persona table (no personaId column) */
const nonPersonaTable = {
  key: { name: 'key' },
  value: { name: 'value' },
} as any;

// =============================================================================
// scopedSelect
// =============================================================================

describe('scopedSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls getActivePersonaId to resolve persona', async () => {
    const { database } = createMockDatabase();
    await scopedSelect(database, personaScopedTable);
    expect(getActivePersonaId).toHaveBeenCalledWith(database);
  });

  it('calls db.select().from(table)', async () => {
    const { database, selectChain } = createMockDatabase();
    const scoped = await scopedSelect(database, personaScopedTable);
    await scoped.all();
    expect(database.select).toHaveBeenCalled();
    expect(selectChain.from).toHaveBeenCalledWith(personaScopedTable);
  });

  it('.all() applies persona filter and returns results', async () => {
    const { database, selectChain } = createMockDatabase();
    const scoped = await scopedSelect(database, personaScopedTable);
    const results = await scoped.all();

    expect(selectChain.where).toHaveBeenCalled();
    expect(selectChain.all).toHaveBeenCalled();
    expect(results).toEqual([{ id: 1 }]);
  });

  it('.get() applies persona filter and returns single result', async () => {
    const { database, selectChain } = createMockDatabase();
    const scoped = await scopedSelect(database, personaScopedTable);
    const result = await scoped.get();

    expect(selectChain.where).toHaveBeenCalled();
    expect(selectChain.get).toHaveBeenCalled();
    expect(result).toEqual({ id: 1 });
  });

  it('.where() applies persona filter AND-ed with caller condition', async () => {
    const { database, selectChain } = createMockDatabase();
    const scoped = await scopedSelect(database, personaScopedTable);
    const callerCondition = isNull(personaScopedTable.archivedAt);

    scoped.where(callerCondition);

    // where() should have been called with the merged condition
    expect(selectChain.where).toHaveBeenCalled();
    const whereArg = selectChain.where.mock.calls[0][0];
    // The arg should be an `and()` expression (SQL object), not just the caller condition
    expect(whereArg).toBeDefined();
  });

  it('.where(undefined) applies only persona filter', async () => {
    const { database, selectChain } = createMockDatabase();
    const scoped = await scopedSelect(database, personaScopedTable);

    scoped.where(undefined);

    expect(selectChain.where).toHaveBeenCalled();
    const whereArg = selectChain.where.mock.calls[0][0];
    expect(whereArg).toBeDefined();
  });

  it('.orderBy() chains correctly', async () => {
    const { database, selectChain } = createMockDatabase();
    const scoped = await scopedSelect(database, personaScopedTable);

    scoped.orderBy(personaScopedTable.createdAt);

    expect(selectChain.where).toHaveBeenCalled();
    expect(selectChain.orderBy).toHaveBeenCalledWith(personaScopedTable.createdAt);
  });

  it('.limit() chains correctly', async () => {
    const { database, selectChain } = createMockDatabase();
    const scoped = await scopedSelect(database, personaScopedTable);

    scoped.limit(10);

    expect(selectChain.where).toHaveBeenCalled();
    expect(selectChain.limit).toHaveBeenCalledWith(10);
  });

  it('throws for table without personaId column', async () => {
    const { database } = createMockDatabase();
    await expect(scopedSelect(database, nonPersonaTable)).rejects.toThrow(
      'Table does not have a personaId column'
    );
  });
});

// =============================================================================
// scopedUpdate
// =============================================================================

describe('scopedUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls getActivePersonaId to resolve persona', async () => {
    const { database } = createMockDatabase();
    await scopedUpdate(database, personaScopedTable);
    expect(getActivePersonaId).toHaveBeenCalledWith(database);
  });

  it('calls db.update(table)', async () => {
    const { database } = createMockDatabase();
    const scoped = await scopedUpdate(database, personaScopedTable);
    scoped.set({ foo: 'bar' }).run();
    expect(database.update).toHaveBeenCalledWith(personaScopedTable);
  });

  it('.set().where() applies persona filter AND-ed with caller condition', async () => {
    const { database, updateChain } = createMockDatabase();
    const scoped = await scopedUpdate(database, personaScopedTable);
    const callerCondition = eq(personaScopedTable.id, 5);

    scoped.set({ archivedAt: 'now' }).where(callerCondition);

    expect(updateChain.set).toHaveBeenCalledWith({ archivedAt: 'now' });
    expect(updateChain.where).toHaveBeenCalled();
  });

  it('.set().run() applies persona filter', async () => {
    const { database, updateChain } = createMockDatabase();
    const scoped = await scopedUpdate(database, personaScopedTable);

    await scoped.set({ archivedAt: 'now' }).run();

    expect(updateChain.set).toHaveBeenCalled();
    expect(updateChain.where).toHaveBeenCalled();
    expect(updateChain.run).toHaveBeenCalled();
  });

  it('.set().returning() applies persona filter and returns rows', async () => {
    const { database, updateChain } = createMockDatabase();
    const scoped = await scopedUpdate(database, personaScopedTable);

    const result = await scoped.set({ archivedAt: 'now' }).returning();

    expect(updateChain.returning).toHaveBeenCalled();
    expect(result).toEqual([{ id: 1 }]);
  });

  it('throws for table without personaId column', async () => {
    const { database } = createMockDatabase();
    await expect(scopedUpdate(database, nonPersonaTable)).rejects.toThrow(
      'Table does not have a personaId column'
    );
  });
});

// =============================================================================
// scopedDelete
// =============================================================================

describe('scopedDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls getActivePersonaId to resolve persona', async () => {
    const { database } = createMockDatabase();
    await scopedDelete(database, personaScopedTable);
    expect(getActivePersonaId).toHaveBeenCalledWith(database);
  });

  it('calls db.delete(table)', async () => {
    const { database } = createMockDatabase();
    const scoped = await scopedDelete(database, personaScopedTable);
    scoped.run();
    expect(database.delete).toHaveBeenCalledWith(personaScopedTable);
  });

  it('.where() applies persona filter AND-ed with caller condition', async () => {
    const { database, deleteChain } = createMockDatabase();
    const scoped = await scopedDelete(database, personaScopedTable);
    const callerCondition = eq(personaScopedTable.id, 5);

    scoped.where(callerCondition);

    expect(deleteChain.where).toHaveBeenCalled();
  });

  it('.run() applies persona filter', async () => {
    const { database, deleteChain } = createMockDatabase();
    const scoped = await scopedDelete(database, personaScopedTable);

    await scoped.run();

    expect(deleteChain.where).toHaveBeenCalled();
    expect(deleteChain.run).toHaveBeenCalled();
  });

  it('.returning() applies persona filter and returns rows', async () => {
    const { database, deleteChain } = createMockDatabase();
    const scoped = await scopedDelete(database, personaScopedTable);

    const result = await scoped.returning();

    expect(deleteChain.where).toHaveBeenCalled();
    expect(deleteChain.returning).toHaveBeenCalled();
    expect(result).toEqual([{ id: 1 }]);
  });

  it('throws for table without personaId column', async () => {
    const { database } = createMockDatabase();
    await expect(scopedDelete(database, nonPersonaTable)).rejects.toThrow(
      'Table does not have a personaId column'
    );
  });
});
