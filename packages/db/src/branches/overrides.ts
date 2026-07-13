/**
 * Memory override database operations
 *
 * @module @persistence/db/branches/overrides
 * @description Operations for excluding, editing, or reordering canonical memories.
 *
 * Overrides are branch-specific and don't modify the original data:
 * - 'exclude' - Hide a memory from context
 * - 'edit' - Replace displayed content while preserving original
 * - 'reorder' - Change when a memory appears in timeline
 *
 * Key table: `memory_overrides`
 * - id: Auto-incrementing primary key
 * - branch_id: Foreign key to memory_branches
 * - target_table: Which table (history, cold_storage, etc.)
 * - target_id: ID in the target table
 * - override_type: 'exclude' | 'edit' | 'reorder'
 * - override_data: JSON for edit/reorder data
 * - created_at: Timestamp
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/branches.js - API endpoints
 *   - platforms/cloudflare/src/index.js - Context assembly with overrides
 * @downstream Calls:
 *   - Drizzle query builder operations
 */

import { eq, and, asc, sql } from 'drizzle-orm';
import type { DrizzleD1 } from '../client';
import { getActivePersonaId, type PersonaOptions } from '../personas';
import { memoryOverrides } from '../schema/memory-overrides';
import { syntheticMemories } from '../schema/synthetic-memories';
import type { MemoryOverride } from './MemoryOverride';
import type { EditData } from './EditData';
import type { ReorderData } from './ReorderData';
import type { BranchResult } from './BranchResult';
import type { ResetResult } from './ResetResult';

async function resolvePersonaId(
  db: DrizzleD1,
  options: PersonaOptions = {},
): Promise<number> {
  return options.personaId ?? await getActivePersonaId(db);
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
// Schema validation for override data to prevent corruption.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @description Validate edit override data
 *
 * @upstream Called by: editMemory()
 * @downstream Calls: None (pure validation)
 *
 * @param edits - The edits object to validate
 * @returns True if valid, false otherwise
 *
 * @example
 * const valid = validateEditData({ content: 'Updated text' }); // true
 * const invalid = validateEditData({ invalidField: true }); // false
 */
function validateEditData(edits: unknown): edits is EditData {
  if (typeof edits !== 'object' || edits === null) return false;

  const data = edits as Record<string, unknown>;

  // Check allowed fields
  const allowedFields = ['content', 'type', 'internal'];
  for (const key of Object.keys(data)) {
    if (!allowedFields.includes(key)) return false;
  }

  // Validate field types
  if (data.content !== undefined && typeof data.content !== 'string') return false;
  if (data.type !== undefined && typeof data.type !== 'string') return false;
  if (data.internal !== undefined && (typeof data.internal !== 'string' && data.internal !== null)) return false;

  return true;
}

/**
 * @description Validate reorder override data
 *
 * @upstream Called by: reorderMemory()
 * @downstream Calls: None (pure validation)
 *
 * @param position - The position object to validate
 * @returns True if valid, false otherwise
 *
 * @example
 * const valid = validateReorderData({ position: 5 }); // true
 * const invalid = validateReorderData({ position: 5, timestamp_override: 'now' }); // false (can't have both)
 */
function validateReorderData(position: unknown): position is ReorderData {
  if (typeof position !== 'object' || position === null) return false;

  const data = position as Record<string, unknown>;

  // Must have exactly one of position or timestamp_override
  const hasPosition = data.position !== undefined;
  const hasTimestamp = data.timestamp_override !== undefined;

  if (hasPosition && hasTimestamp) return false; // Can't have both
  if (!hasPosition && !hasTimestamp) return false; // Must have one

  // Validate types
  if (hasPosition && (typeof data.position !== 'number' || data.position < 0)) return false;
  if (hasTimestamp && typeof data.timestamp_override !== 'string') return false;

  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// QUERY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @description Get all overrides for a branch
 *
 * Returns all memory overrides (exclusions, edits, reorderings) for the specified branch.
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/index.js - assembleContext()
 *   - platforms/cloudflare/src/routes/branches.js - Various handlers
 * @downstream Calls:
 *   - Drizzle query builder SELECT
 *
 * @param db - Drizzle D1 client
 * @param branchId - Branch ID
 * @returns Array of override objects
 *
 * @example
 * const overrides = await getOverrides(db, 1);
 * // Returns: [{ id: 1, branch_id: 1, target_table: 'history', ... }, ...]
 */
export async function getOverrides(
  db: DrizzleD1,
  branchId: number,
  options: PersonaOptions = {},
): Promise<MemoryOverride[]> {
  const personaId = await resolvePersonaId(db, options);
  const rows = await db.select({
    id: memoryOverrides.id,
    branch_id: memoryOverrides.branchId,
    target_table: memoryOverrides.targetTable,
    target_id: memoryOverrides.targetId,
    override_type: memoryOverrides.overrideType,
    override_data: memoryOverrides.overrideData,
    created_at: memoryOverrides.createdAt,
  })
    .from(memoryOverrides)
    .where(and(eq(memoryOverrides.personaId, personaId), eq(memoryOverrides.branchId, branchId)))
    .orderBy(asc(memoryOverrides.createdAt))
    .all();
  return rows as MemoryOverride[];
}

/**
 * @description Get overrides for a specific memory entry
 *
 * @upstream Called by:
 *   - UI memory detail view
 * @downstream Calls:
 *   - Drizzle query builder SELECT
 *
 * @param db - Drizzle D1 client
 * @param branchId - Branch ID
 * @param targetTable - Table name ('history', 'cold_storage', etc.)
 * @param targetId - ID in the target table
 * @returns Array of overrides for this specific entry
 *
 * @example
 * const overrides = await getOverridesForEntry(db, 1, 'history', 42);
 */
export async function getOverridesForEntry(
  db: DrizzleD1,
  branchId: number,
  targetTable: string,
  targetId: number,
  options: PersonaOptions = {},
): Promise<MemoryOverride[]> {
  const personaId = await resolvePersonaId(db, options);
  const rows = await db.select({
    id: memoryOverrides.id,
    branch_id: memoryOverrides.branchId,
    target_table: memoryOverrides.targetTable,
    target_id: memoryOverrides.targetId,
    override_type: memoryOverrides.overrideType,
    override_data: memoryOverrides.overrideData,
    created_at: memoryOverrides.createdAt,
  })
    .from(memoryOverrides)
    .where(and(
      eq(memoryOverrides.personaId, personaId),
      eq(memoryOverrides.branchId, branchId),
      eq(memoryOverrides.targetTable, targetTable),
      eq(memoryOverrides.targetId, targetId)
    ))
    .orderBy(asc(memoryOverrides.createdAt))
    .all();
  return rows as MemoryOverride[];
}

// ═══════════════════════════════════════════════════════════════════════════
// MUTATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @description Exclude a memory entry from context (in the active branch)
 *
 * The canonical entry remains unchanged - an override record is created
 * that marks it as excluded for the current branch.
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/branches.js - handleExcludeMemory
 * @downstream Calls:
 *   - Drizzle query builder INSERT
 *
 * @param db - Drizzle D1 client
 * @param branchId - Branch ID
 * @param targetTable - Table name ('history', 'cold_storage', etc.)
 * @param targetId - ID in the target table
 * @returns Result with success or error
 *
 * @example
 * const result = await excludeMemory(db, 1, 'history', 42);
 * // Returns: { success: true }
 */
export async function excludeMemory(
  db: DrizzleD1,
  branchId: number,
  targetTable: string,
  targetId: number,
  options: PersonaOptions = {},
): Promise<BranchResult> {
  const personaId = await resolvePersonaId(db, options);
  try {
    await db.insert(memoryOverrides).values({
      personaId,
      branchId,
      targetTable,
      targetId,
      overrideType: 'exclude',
      overrideData: null,
      createdAt: sql`datetime('now')`,
    }).onConflictDoUpdate({
      target: [memoryOverrides.branchId, memoryOverrides.targetTable, memoryOverrides.targetId, memoryOverrides.overrideType],
      set: {
        overrideData: null,
        createdAt: sql`datetime('now')`,
      },
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * @description Include a previously excluded memory entry
 *
 * Removes the exclusion override, making the entry visible again.
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/branches.js - handleIncludeMemory
 * @downstream Calls:
 *   - Drizzle query builder DELETE
 *
 * @param db - Drizzle D1 client
 * @param branchId - Branch ID
 * @param targetTable - Table name
 * @param targetId - ID in the target table
 * @returns Result with success
 *
 * @example
 * const result = await includeMemory(db, 1, 'history', 42);
 * // Returns: { success: true }
 */
export async function includeMemory(
  db: DrizzleD1,
  branchId: number,
  targetTable: string,
  targetId: number,
  options: PersonaOptions = {},
): Promise<BranchResult> {
  const personaId = await resolvePersonaId(db, options);
  await db.delete(memoryOverrides)
    .where(and(
      eq(memoryOverrides.personaId, personaId),
      eq(memoryOverrides.branchId, branchId),
      eq(memoryOverrides.targetTable, targetTable),
      eq(memoryOverrides.targetId, targetId),
      eq(memoryOverrides.overrideType, 'exclude')
    ));
  return { success: true };
}

/**
 * @description Edit a memory entry's content (non-destructive)
 *
 * Creates an 'edit' override that replaces the displayed content.
 * Original canonical content remains unchanged in the source table.
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/branches.js - handleEditMemory
 * @downstream Calls:
 *   - validateEditData() - Schema validation
 *   - Drizzle query builder INSERT
 *
 * @param db - Drizzle D1 client
 * @param branchId - Branch ID
 * @param targetTable - Table name
 * @param targetId - ID in the target table
 * @param edits - Object with fields to override {content?, type?, internal?}
 * @returns Result with success or error
 *
 * @example
 * const result = await editMemory(db, 1, 'history', 42, { content: 'Updated text' });
 * // Returns: { success: true }
 */
export async function editMemory(
  db: DrizzleD1,
  branchId: number,
  targetTable: string,
  targetId: number,
  edits: EditData,
  options: PersonaOptions = {},
): Promise<BranchResult> {
  const personaId = await resolvePersonaId(db, options);
  // Validate edit data structure
  if (!validateEditData(edits)) {
    return { success: false, error: 'Invalid edit data structure. Allowed fields: content (string), type (string), internal (string|null)' };
  }

  const overrideData = JSON.stringify(edits);
  try {
    await db.insert(memoryOverrides).values({
      personaId,
      branchId,
      targetTable,
      targetId,
      overrideType: 'edit',
      overrideData,
      createdAt: sql`datetime('now')`,
    }).onConflictDoUpdate({
      target: [memoryOverrides.branchId, memoryOverrides.targetTable, memoryOverrides.targetId, memoryOverrides.overrideType],
      set: {
        overrideData,
        createdAt: sql`datetime('now')`,
      },
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * @description Reorder a memory entry in the timeline
 *
 * Creates a 'reorder' override that changes when the entry appears.
 * Can specify a position number or a timestamp override.
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/branches.js - handleReorderMemory
 * @downstream Calls:
 *   - validateReorderData() - Schema validation
 *   - Drizzle query builder INSERT
 *
 * @param db - Drizzle D1 client
 * @param branchId - Branch ID
 * @param targetTable - Table name
 * @param targetId - ID in the target table
 * @param position - {position?: number} or {timestamp_override?: string}
 * @returns Result with success or error
 *
 * @example
 * const result = await reorderMemory(db, 1, 'history', 42, { position: 10 });
 * // Returns: { success: true }
 */
export async function reorderMemory(
  db: DrizzleD1,
  branchId: number,
  targetTable: string,
  targetId: number,
  position: ReorderData,
  options: PersonaOptions = {},
): Promise<BranchResult> {
  const personaId = await resolvePersonaId(db, options);
  // Validate reorder data structure
  if (!validateReorderData(position)) {
    return { success: false, error: 'Invalid reorder data. Must have exactly one of: position (number >= 0) or timestamp_override (string)' };
  }

  const overrideData = JSON.stringify(position);
  try {
    await db.insert(memoryOverrides).values({
      personaId,
      branchId,
      targetTable,
      targetId,
      overrideType: 'reorder',
      overrideData,
      createdAt: sql`datetime('now')`,
    }).onConflictDoUpdate({
      target: [memoryOverrides.branchId, memoryOverrides.targetTable, memoryOverrides.targetId, memoryOverrides.overrideType],
      set: {
        overrideData,
        createdAt: sql`datetime('now')`,
      },
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * @description Remove an override (revert to canonical)
 *
 * Deletes a specific override, making the entry appear as it does in canonical history.
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/branches.js - handleRemoveOverride
 * @downstream Calls:
 *   - Drizzle query builder DELETE
 *
 * @param db - Drizzle D1 client
 * @param overrideId - Override ID to remove
 * @returns Result with success
 *
 * @example
 * const result = await removeOverride(db, 5);
 * // Returns: { success: true }
 */
export async function removeOverride(
  db: DrizzleD1,
  overrideId: number,
  options: PersonaOptions = {},
): Promise<BranchResult> {
  const personaId = await resolvePersonaId(db, options);
  await db.delete(memoryOverrides)
    .where(and(eq(memoryOverrides.personaId, personaId), eq(memoryOverrides.id, overrideId)));
  return { success: true };
}

/**
 * @description Reset branch to canonical (remove all overrides)
 *
 * Deletes ALL overrides and synthetic memories for a branch,
 * making it identical to viewing canonical history.
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/branches.js - handleResetBranch
 * @downstream Calls:
 *   - Drizzle query builder DELETE
 *
 * @param db - Drizzle D1 client
 * @param branchId - Branch ID
 * @returns Result with counts of removed items
 *
 * @example
 * const result = await resetBranch(db, 1);
 * // Returns: { success: true, overridesRemoved: 5, syntheticsRemoved: 2 }
 */
export async function resetBranch(
  db: DrizzleD1,
  branchId: number,
  options: PersonaOptions = {},
): Promise<ResetResult> {
  const personaId = await resolvePersonaId(db, options);
  // Count overrides before deleting
  const overrideCountResult = await db.select({ count: sql<number>`count(*)` })
    .from(memoryOverrides)
    .where(and(eq(memoryOverrides.personaId, personaId), eq(memoryOverrides.branchId, branchId)))
    .get();

  const syntheticCountResult = await db.select({ count: sql<number>`count(*)` })
    .from(syntheticMemories)
    .where(and(eq(syntheticMemories.personaId, personaId), eq(syntheticMemories.branchId, branchId)))
    .get();

  await db.delete(memoryOverrides)
    .where(and(eq(memoryOverrides.personaId, personaId), eq(memoryOverrides.branchId, branchId)));

  await db.delete(syntheticMemories)
    .where(and(eq(syntheticMemories.personaId, personaId), eq(syntheticMemories.branchId, branchId)));

  return {
    success: true,
    overridesRemoved: overrideCountResult?.count || 0,
    syntheticsRemoved: syntheticCountResult?.count || 0,
  };
}
