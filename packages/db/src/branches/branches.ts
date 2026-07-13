/**
 * Branch table database operations
 *
 * @module @persistence/db/branches/branches
 * @description CRUD operations for the memory_branches table.
 *
 * Branches represent different "views" of the memory timeline:
 * - The 'main' branch shows unmodified canonical history
 * - Other branches can have exclusions, edits, and synthetic memories
 * - Only ONE branch can be active at a time (is_active = 1)
 *
 * Key table: `memory_branches`
 * - id: Auto-incrementing primary key
 * - name: Branch name (unique)
 * - description: Optional description
 * - parent_branch: For inheritance tracking
 * - is_active: Only one branch active at a time
 * - created_at, updated_at: Timestamps
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/branches.js - API endpoints
 *   - platforms/cloudflare/src/index.js - buildSystemPrompt() context assembly
 * @downstream Calls:
 *   - Drizzle query builder operations
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import type { DrizzleD1 } from '../client';
import { getActivePersonaId, type PersonaOptions } from '../personas';
import { memoryBranches } from '../schema/memory-branches';
import { memoryOverrides } from '../schema/memory-overrides';
import { syntheticMemories } from '../schema/synthetic-memories';
import type { Branch } from './Branch';
import type { BranchResult } from './BranchResult';

async function resolvePersonaId(
  db: DrizzleD1,
  options: PersonaOptions = {},
): Promise<number> {
  return options.personaId ?? await getActivePersonaId(db);
}

/**
 * @description Get all memory branches
 *
 * Returns all branches ordered by creation date, with the active branch first.
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/branches.js - handleGetBranches
 * @downstream Calls:
 *   - Drizzle query builder SELECT
 *
 * @param db - Drizzle D1 client
 * @returns Array of branch objects
 *
 * @example
 * const branches = await getBranches(db);
 * // Returns: [{ id: 1, name: 'main', is_active: 1, ... }, ...]
 */
export async function getBranches(
  db: DrizzleD1,
  options: PersonaOptions = {},
): Promise<Branch[]> {
  const personaId = await resolvePersonaId(db, options);
  const rows = await db.select({
    id: memoryBranches.id,
    name: memoryBranches.name,
    description: memoryBranches.description,
    parent_branch: memoryBranches.parentBranch,
    is_active: memoryBranches.isActive,
    created_at: memoryBranches.createdAt,
    updated_at: memoryBranches.updatedAt,
  })
    .from(memoryBranches)
    .where(eq(memoryBranches.personaId, personaId))
    .orderBy(desc(memoryBranches.isActive), desc(memoryBranches.createdAt))
    .all();
  return rows as Branch[];
}

/**
 * @description Get the currently active branch
 *
 * There is always exactly one active branch (defaults to 'main').
 * The active branch determines how context is assembled for Claude.
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/index.js - assembleContext()
 *   - platforms/cloudflare/src/routes/branches.js - Various handlers
 * @downstream Calls:
 *   - Drizzle query builder SELECT
 *
 * @param db - Drizzle D1 client
 * @returns Active branch object or null
 *
 * @example
 * const activeBranch = await getActiveBranch(db);
 * // Returns: { id: 1, name: 'main', is_active: 1, ... } or null
 */
export async function getActiveBranch(
  db: DrizzleD1,
  options: PersonaOptions = {},
): Promise<Branch | null> {
  const personaId = await resolvePersonaId(db, options);
  const row = await db.select({
    id: memoryBranches.id,
    name: memoryBranches.name,
    description: memoryBranches.description,
    parent_branch: memoryBranches.parentBranch,
    is_active: memoryBranches.isActive,
    created_at: memoryBranches.createdAt,
    updated_at: memoryBranches.updatedAt,
  })
    .from(memoryBranches)
    .where(and(eq(memoryBranches.personaId, personaId), eq(memoryBranches.isActive, 1)))
    .limit(1)
    .get();
  return (row as Branch) ?? null;
}

/**
 * @description Get a branch by name
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/branches.js - Various handlers
 *   - activateBranch() - Validation before activation
 *   - createBranch() - Duplicate check and parent validation
 * @downstream Calls:
 *   - Drizzle query builder SELECT
 *
 * @param db - Drizzle D1 client
 * @param name - Branch name
 * @returns Branch object or null if not found
 *
 * @example
 * const branch = await getBranchByName(db, 'experimental-v1');
 */
export async function getBranchByName(
  db: DrizzleD1,
  name: string,
  options: PersonaOptions = {},
): Promise<Branch | null> {
  const personaId = await resolvePersonaId(db, options);
  const row = await db.select({
    id: memoryBranches.id,
    name: memoryBranches.name,
    description: memoryBranches.description,
    parent_branch: memoryBranches.parentBranch,
    is_active: memoryBranches.isActive,
    created_at: memoryBranches.createdAt,
    updated_at: memoryBranches.updatedAt,
  })
    .from(memoryBranches)
    .where(and(eq(memoryBranches.personaId, personaId), eq(memoryBranches.name, name)))
    .get();
  return (row as Branch) ?? null;
}

/**
 * @description Create a new memory branch
 *
 * Creates a new branch with optional description and parent branch for inheritance.
 * New branches are NOT active by default - use activateBranch to switch.
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/branches.js - handleCreateBranch
 * @downstream Calls:
 *   - getBranchByName() - Duplicate and parent validation
 *   - Drizzle query builder INSERT
 *
 * @param db - Drizzle D1 client
 * @param name - Branch name (must be unique)
 * @param description - Optional description
 * @param parentBranch - Optional parent branch name for inheritance
 * @returns Result with success or error
 *
 * @example
 * const result = await createBranch(db, 'experiment-1', 'Testing new features');
 * // Returns: { success: true, name: 'experiment-1' }
 */
export async function createBranch(
  db: DrizzleD1,
  name: string,
  description: string | null = null,
  parentBranch: string | null = null,
  options: PersonaOptions = {},
): Promise<BranchResult> {
  const personaId = await resolvePersonaId(db, options);
  // Check if branch already exists
  const existing = await getBranchByName(db, name, options);
  if (existing) {
    return { success: false, error: `Branch '${name}' already exists` };
  }

  // If parent specified, verify it exists
  if (parentBranch) {
    const parent = await getBranchByName(db, parentBranch, options);
    if (!parent) {
      return { success: false, error: `Parent branch '${parentBranch}' not found` };
    }
  }

  await db.insert(memoryBranches).values({
    personaId,
    name,
    description: description ?? null,
    parentBranch: parentBranch ?? null,
    isActive: 0,
    createdAt: sql`datetime('now')`,
    updatedAt: sql`datetime('now')`,
  });

  return { success: true, name };
}

/**
 * @description Activate a branch (deactivating all others)
 *
 * Switches the active branch. Only one branch can be active at a time.
 * The active branch determines what Claude sees in context.
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/branches.js - handleActivateBranch
 * @downstream Calls:
 *   - getBranchByName() - Validation
 *   - Drizzle query builder UPDATE
 *
 * @param db - Drizzle D1 client
 * @param name - Branch name to activate
 * @returns Result with success or error
 *
 * @example
 * const result = await activateBranch(db, 'experiment-1');
 * // Returns: { success: true, name: 'experiment-1' }
 */
export async function activateBranch(
  db: DrizzleD1,
  name: string,
  options: PersonaOptions = {},
): Promise<BranchResult> {
  const personaId = await resolvePersonaId(db, options);
  const branch = await getBranchByName(db, name, options);
  if (!branch) {
    return { success: false, error: `Branch '${name}' not found` };
  }

  // Deactivate all branches, then activate the specified one
  await db.update(memoryBranches)
    .set({ isActive: 0, updatedAt: sql`datetime('now')` })
    .where(eq(memoryBranches.personaId, personaId));

  await db.update(memoryBranches)
    .set({ isActive: 1, updatedAt: sql`datetime('now')` })
    .where(and(eq(memoryBranches.personaId, personaId), eq(memoryBranches.name, name)));

  return { success: true, name };
}

/**
 * @description Delete a branch (not allowed for 'main')
 *
 * Removes a branch and all its associated overrides and synthetic memories.
 * Cannot delete the 'main' branch.
 * If the deleted branch was active, 'main' becomes active.
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/branches.js - handleDeleteBranch
 * @downstream Calls:
 *   - getBranchByName() - Validation
 *   - Drizzle query builder DELETE
 *
 * @param db - Drizzle D1 client
 * @param name - Branch name to delete
 * @returns Result with success or error
 *
 * @example
 * const result = await deleteBranch(db, 'experiment-1');
 * // Returns: { success: true, wasActive: false, nowActive: null }
 */
export async function deleteBranch(
  db: DrizzleD1,
  name: string,
  options: PersonaOptions = {},
): Promise<BranchResult> {
  const personaId = await resolvePersonaId(db, options);
  if (name === 'main') {
    return { success: false, error: "Cannot delete the 'main' branch" };
  }

  const branch = await getBranchByName(db, name, options);
  if (!branch) {
    return { success: false, error: `Branch '${name}' not found` };
  }

  const wasActive = branch.is_active === 1;

  // Delete branch (cascades to overrides and synthetics via FK)
  await db.delete(memoryBranches)
    .where(and(eq(memoryBranches.personaId, personaId), eq(memoryBranches.name, name)));

  // If deleted branch was active, activate main
  if (wasActive) {
    await db.update(memoryBranches)
      .set({ isActive: 1, updatedAt: sql`datetime('now')` })
      .where(and(eq(memoryBranches.personaId, personaId), eq(memoryBranches.name, 'main')));
  }

  return { success: true, wasActive, nowActive: wasActive ? 'main' : null };
}

/**
 * @description Fork a branch to a new name
 *
 * Creates a copy of a branch including all its overrides and synthetic memories.
 * Useful for experimenting with modifications without losing the original.
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/branches.js - handleForkBranch
 * @downstream Calls:
 *   - getBranchByName() - Source and target validation
 *   - Drizzle query builder INSERT/SELECT
 *
 * @param db - Drizzle D1 client
 * @param sourceName - Branch to fork from
 * @param newName - Name for the new branch
 * @param description - Optional description for new branch
 * @returns Result with success or error
 *
 * @example
 * const result = await forkBranch(db, 'main', 'experiment-2', 'Fork of main for testing');
 * // Returns: { success: true, name: 'experiment-2', forkedFrom: 'main' }
 */
export async function forkBranch(
  db: DrizzleD1,
  sourceName: string,
  newName: string,
  description: string | null = null,
  options: PersonaOptions = {},
): Promise<BranchResult> {
  const personaId = await resolvePersonaId(db, options);
  const source = await getBranchByName(db, sourceName, options);
  if (!source) {
    return { success: false, error: `Source branch '${sourceName}' not found` };
  }

  const existing = await getBranchByName(db, newName, options);
  if (existing) {
    return { success: false, error: `Branch '${newName}' already exists` };
  }

  // Create new branch
  await db.insert(memoryBranches).values({
    personaId,
    name: newName,
    description: description ?? `Forked from ${sourceName}`,
    parentBranch: sourceName,
    isActive: 0,
    createdAt: sql`datetime('now')`,
    updatedAt: sql`datetime('now')`,
  });

  // Get new branch ID
  const newBranch = await getBranchByName(db, newName, options);
  if (!newBranch) {
    return { success: false, error: 'Failed to retrieve newly created branch' };
  }

  // Copy overrides from source branch
  const sourceOverrides = await db.select()
    .from(memoryOverrides)
    .where(and(eq(memoryOverrides.personaId, personaId), eq(memoryOverrides.branchId, source.id)))
    .all();

  for (const override of sourceOverrides) {
    await db.insert(memoryOverrides).values({
      personaId,
      branchId: newBranch.id,
      targetTable: override.targetTable,
      targetId: override.targetId,
      overrideType: override.overrideType,
      overrideData: override.overrideData,
      createdAt: sql`datetime('now')`,
    });
  }

  // Copy synthetic memories from source branch
  const sourceSynthetics = await db.select()
    .from(syntheticMemories)
    .where(and(eq(syntheticMemories.personaId, personaId), eq(syntheticMemories.branchId, source.id)))
    .all();

  for (const synthetic of sourceSynthetics) {
    await db.insert(syntheticMemories).values({
      personaId,
      branchId: newBranch.id,
      memoryType: synthetic.memoryType,
      content: synthetic.content,
      internal: synthetic.internal,
      positionTimestamp: synthetic.positionTimestamp,
      positionAfterId: synthetic.positionAfterId,
      createdAt: sql`datetime('now')`,
    });
  }

  return { success: true, name: newName, forkedFrom: sourceName };
}
