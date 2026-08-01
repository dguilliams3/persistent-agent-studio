/**
 * Persona-scope contract tests for the branching layer (I5 / RUN-20260712-2013).
 *
 * Pins the regression net Delphi asked for: branch CRUD, overrides, and
 * synthetics must resolve and persist persona scope instead of behaving as one
 * global branch namespace.
 *
 * Tests: `packages/db/src/branches/branches.ts::{getBranches,getActiveBranch,createBranch,activateBranch}`
 * Tests: `packages/db/src/branches/overrides.ts::{getOverrides,excludeMemory}`
 * Tests: `packages/db/src/branches/synthetic.ts::{getSyntheticMemories,addSyntheticMemory}`
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getActivePersonaIdMock } = vi.hoisted(() => ({
  getActivePersonaIdMock: vi.fn<() => Promise<number>>(),
}));

vi.mock('./persona-scope', () => ({
  getActivePersonaId: getActivePersonaIdMock,
}));

import {
  activateBranch,
  addSyntheticMemory,
  createBranch,
  excludeMemory,
  getActiveBranch,
  getBranches,
  getOverrides,
  getSyntheticMemories,
} from './branches';

function createQueryChain() {
  const chain: Record<string, unknown> = {};
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.all = vi.fn(async () => []);
  chain.get = vi.fn(async () => undefined);
  return chain;
}

function createInsertChain() {
  return {
    values: vi.fn(() => ({
      onConflictDoUpdate: vi.fn(async () => undefined),
    })),
  };
}

function createUpdateChain() {
  const chain: Record<string, unknown> = {};
  chain.set = vi.fn(() => chain);
  chain.where = vi.fn(async () => undefined);
  return chain;
}

function createDeleteChain() {
  const chain: Record<string, unknown> = {};
  chain.where = vi.fn(async () => undefined);
  return chain;
}

function createMockDatabase() {
  const selectChain = createQueryChain();
  const insertChain = createInsertChain();
  const updateChain = createUpdateChain();
  const deleteChain = createDeleteChain();

  return {
    select: vi.fn(() => ({
      from: vi.fn(() => selectChain),
    })),
    insert: vi.fn(() => insertChain),
    update: vi.fn(() => updateChain),
    delete: vi.fn(() => deleteChain),
    selectChain,
    insertChain,
    updateChain,
    deleteChain,
  };
}

describe('branch layer persona scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getBranches resolves the active persona before listing branches', async () => {
    const db = createMockDatabase();
    getActivePersonaIdMock.mockResolvedValueOnce(1);

    await getBranches(db as never);

    expect(getActivePersonaIdMock).toHaveBeenCalledWith(db);
    expect(db.selectChain.where).toHaveBeenCalled();
  });

  it('getActiveBranch resolves the active persona before loading the active branch', async () => {
    const db = createMockDatabase();
    getActivePersonaIdMock.mockResolvedValueOnce(2);

    await getActiveBranch(db as never);

    expect(getActivePersonaIdMock).toHaveBeenCalledWith(db);
    expect(db.selectChain.where).toHaveBeenCalled();
  });

  it('createBranch stamps personaId on inserted branches', async () => {
    const db = createMockDatabase();
    getActivePersonaIdMock.mockResolvedValue(2);
    db.selectChain.get = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 7, name: 'experiment-b', is_active: 0 });

    await createBranch(db as never, 'experiment-b');

    expect(getActivePersonaIdMock).toHaveBeenCalledWith(db);
    expect(db.insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        personaId: 2,
        name: 'experiment-b',
      }),
    );
  });

  it('activateBranch scopes both deactivation and activation to the resolved persona', async () => {
    const db = createMockDatabase();
    getActivePersonaIdMock.mockResolvedValueOnce(2);
    db.selectChain.get = vi.fn().mockResolvedValueOnce({
      id: 8,
      name: 'experiment-b',
      is_active: 0,
    });

    await activateBranch(db as never, 'experiment-b');

    expect(getActivePersonaIdMock).toHaveBeenCalledWith(db);
    expect(db.update).toHaveBeenCalledTimes(2);
    expect(db.updateChain.where).toHaveBeenCalledTimes(2);
  });

  it('getOverrides resolves the active persona before listing branch overrides', async () => {
    const db = createMockDatabase();
    getActivePersonaIdMock.mockResolvedValueOnce(1);

    await getOverrides(db as never, 5);

    expect(getActivePersonaIdMock).toHaveBeenCalledWith(db);
    expect(db.selectChain.where).toHaveBeenCalled();
  });

  it('excludeMemory stamps personaId on override rows', async () => {
    const db = createMockDatabase();
    getActivePersonaIdMock.mockResolvedValueOnce(2);

    await excludeMemory(db as never, 9, 'history', 41);

    expect(getActivePersonaIdMock).toHaveBeenCalledWith(db);
    expect(db.insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        personaId: 2,
        branchId: 9,
      }),
    );
  });

  it('getSyntheticMemories resolves the active persona before listing synthetics', async () => {
    const db = createMockDatabase();
    getActivePersonaIdMock.mockResolvedValueOnce(2);

    await getSyntheticMemories(db as never, 4);

    expect(getActivePersonaIdMock).toHaveBeenCalledWith(db);
    expect(db.selectChain.where).toHaveBeenCalled();
  });

  it('addSyntheticMemory stamps personaId on synthetic rows', async () => {
    const db = createMockDatabase();
    getActivePersonaIdMock.mockResolvedValueOnce(2);
    db.selectChain.get = vi.fn().mockResolvedValueOnce({ id: 4 }).mockResolvedValueOnce({ id: 12 });

    await addSyntheticMemory(
      db as never,
      4,
      'thought',
      'Synthetic branch-only thought',
      null,
      { afterId: 99 },
    );

    expect(getActivePersonaIdMock).toHaveBeenCalledWith(db);
    expect(db.insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        personaId: 2,
        branchId: 4,
      }),
    );
  });
});
