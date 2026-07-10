/**
 * Synthetic memory database operations
 *
 * @module @persistence/db/branches/synthetic
 * @description Operations for adding new memories that don't exist in canonical history.
 *
 * Synthetic memories only appear in the branch they're created for:
 * - Can be positioned by timestamp or after a specific canonical entry
 * - Useful for injecting test scenarios, hypotheticals, or corrections
 * - Have all the same fields as regular history entries
 *
 * Key table: `synthetic_memories`
 * - id: Auto-incrementing primary key
 * - branch_id: Foreign key to memory_branches
 * - memory_type: Type ('thought', 'message_to_user', etc.)
 * - content: Memory content
 * - internal: Optional internal/subthought field
 * - position_timestamp: Explicit timestamp for ordering
 * - position_after_id: Place after this canonical history entry
 * - created_at: Timestamp
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/branches.js - API endpoints
 *   - platforms/cloudflare/src/index.js - Context assembly with synthetics
 * @downstream Calls:
 *   - Drizzle query builder operations
 */

import { eq, sql, asc } from 'drizzle-orm';
import type { DrizzleD1 } from '../client';
import { syntheticMemories } from '../schema/synthetic-memories';
import { history } from '../schema/history';
import type { SyntheticMemory } from './SyntheticMemory';
import type { SyntheticResult } from './SyntheticResult';
import type { SyntheticPlacement } from './SyntheticPlacement';
import type { SyntheticUpdates } from './SyntheticUpdates';
import type { BranchResult } from './BranchResult';

/**
 * @description Get all synthetic memories for a branch
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/index.js - assembleContext()
 *   - platforms/cloudflare/src/routes/branches.js - Various handlers
 * @downstream Calls:
 *   - Drizzle query builder SELECT
 *
 * @param db - Drizzle D1 client
 * @param branchId - Branch ID
 * @returns Array of synthetic memory objects
 *
 * @example
 * const synthetics = await getSyntheticMemories(db, 1);
 * // Returns: [{ id: 1, branch_id: 1, memory_type: 'thought', ... }, ...]
 */
export async function getSyntheticMemories(db: DrizzleD1, branchId: number): Promise<SyntheticMemory[]> {
  const rows = await db.select({
    id: syntheticMemories.id,
    branch_id: syntheticMemories.branchId,
    memory_type: syntheticMemories.memoryType,
    content: syntheticMemories.content,
    internal: syntheticMemories.internal,
    position_timestamp: syntheticMemories.positionTimestamp,
    position_after_id: syntheticMemories.positionAfterId,
    created_at: syntheticMemories.createdAt,
  })
    .from(syntheticMemories)
    .where(eq(syntheticMemories.branchId, branchId))
    .orderBy(asc(sql`COALESCE(${syntheticMemories.positionTimestamp}, ${syntheticMemories.createdAt})`))
    .all();
  return rows as SyntheticMemory[];
}

/**
 * @description Add a synthetic memory to a branch
 *
 * Creates a new memory entry that only exists in this branch.
 * Can specify placement by timestamp or after a specific canonical entry ID.
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/branches.js - handleAddSyntheticMemory
 * @downstream Calls:
 *   - Drizzle query builder SELECT (for validation)
 *   - Drizzle query builder INSERT
 *
 * @param db - Drizzle D1 client
 * @param branchId - Branch ID
 * @param memoryType - Type ('thought', 'message_to_user', etc.)
 * @param content - Memory content
 * @param internal - Optional internal/subthought field
 * @param placement - {timestamp?: string} or {afterId?: number}
 * @returns Result with success and ID or error
 *
 * @example
 * const result = await addSyntheticMemory(db, 1, 'thought', 'Injected thought', null, { timestamp: '2026-01-27T12:00:00Z' });
 * // Returns: { success: true, id: 5 }
 */
export async function addSyntheticMemory(
  db: DrizzleD1,
  branchId: number,
  memoryType: string,
  content: string,
  internal: string | null = null,
  placement: SyntheticPlacement | null = null
): Promise<SyntheticResult> {
  const positionTimestamp = placement?.timestamp ?? null;
  const positionAfterId = placement?.afterId ?? null;

  // Validate position_after_id references an existing history entry
  if (positionAfterId !== null) {
    const referencedEntry = await db.select({ id: history.id })
      .from(history)
      .where(eq(history.id, positionAfterId))
      .get();
    if (!referencedEntry) {
      return { success: false, error: `Referenced history entry ${positionAfterId} does not exist` };
    }
  }

  await db.insert(syntheticMemories).values({
    branchId,
    memoryType,
    content,
    internal: internal ?? null,
    positionTimestamp,
    positionAfterId,
    createdAt: sql`datetime('now')`,
  });

  // Retrieve the last inserted ID (D1 doesn't support RETURNING)
  const lastRow = await db.select({ id: syntheticMemories.id })
    .from(syntheticMemories)
    .orderBy(sql`${syntheticMemories.id} DESC`)
    .limit(1)
    .get();

  return { success: true, id: lastRow?.id };
}

/**
 * @description Update a synthetic memory
 *
 * Modifies an existing synthetic memory's content or placement.
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/branches.js - handleUpdateSyntheticMemory
 * @downstream Calls:
 *   - Drizzle query builder UPDATE
 *
 * @param db - Drizzle D1 client
 * @param syntheticId - Synthetic memory ID
 * @param updates - Fields to update {memoryType?, content?, internal?, placement?}
 * @returns Result with success or error
 *
 * @example
 * const result = await updateSyntheticMemory(db, 5, { content: 'Updated content' });
 * // Returns: { success: true }
 */
export async function updateSyntheticMemory(
  db: DrizzleD1,
  syntheticId: number,
  updates: SyntheticUpdates
): Promise<BranchResult> {
  const setValues: Record<string, unknown> = {};

  if (updates.memoryType !== undefined) {
    setValues.memoryType = updates.memoryType;
  }
  if (updates.content !== undefined) {
    setValues.content = updates.content;
  }
  if (updates.internal !== undefined) {
    setValues.internal = updates.internal ?? null;
  }
  if (updates.placement?.timestamp !== undefined) {
    setValues.positionTimestamp = updates.placement.timestamp ?? null;
  }
  if (updates.placement?.afterId !== undefined) {
    setValues.positionAfterId = updates.placement.afterId ?? null;
  }

  if (Object.keys(setValues).length === 0) {
    return { success: false, error: 'No fields to update' };
  }

  await db.update(syntheticMemories)
    .set(setValues)
    .where(eq(syntheticMemories.id, syntheticId));

  return { success: true };
}

/**
 * @description Delete a synthetic memory
 *
 * Permanently removes a synthetic memory from the branch.
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/branches.js - handleDeleteSyntheticMemory
 * @downstream Calls:
 *   - Drizzle query builder DELETE
 *
 * @param db - Drizzle D1 client
 * @param syntheticId - Synthetic memory ID
 * @returns Result with success
 *
 * @example
 * const result = await deleteSyntheticMemory(db, 5);
 * // Returns: { success: true }
 */
export async function deleteSyntheticMemory(db: DrizzleD1, syntheticId: number): Promise<BranchResult> {
  await db.delete(syntheticMemories)
    .where(eq(syntheticMemories.id, syntheticId));
  return { success: true };
}
