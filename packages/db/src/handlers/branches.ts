/**
 * Memory branch management handler functions
 *
 * @module @persistence/db/handlers/branches
 * @description Pure handler functions for memory branching endpoints.
 * Accept typed params and db, return response-ready shapes.
 *
 * @upstream Called by: platforms/cloudflare/src/routes/registry.ts
 * @downstream Calls: @persistence/db branch functions
 */

import type { DrizzleD1 } from '../client';

import {
  getBranches,
  getActiveBranch,
  getBranchByName,
  createBranch,
  activateBranch,
  deleteBranch,
  forkBranch,
  resetBranch,
  excludeMemory,
  includeMemory,
  editMemory,
  reorderMemory,
  removeOverride,
  getOverrides,
  addSyntheticMemory,
  updateSyntheticMemory,
  deleteSyntheticMemory,
  getSyntheticMemories
} from '../index';

// --- Branch CRUD ---

/**
 * GET /branches - Returns all branches and indicates the active one
 *
 * @downstream getBranches — reads all rows from memory_branches table
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern read-only-query — no mutations; active branch resolved from is_active flag
 * @antipattern Do NOT hardcode 'main' as the active branch — always derive from is_active column
 */
export async function handleGetBranches(db: DrizzleD1) {
  const branches = await getBranches(db);
  const active = branches.find((branch: any) => branch.is_active === 1);
  return {
    branches,
    activeBranch: active?.name || 'main',
    count: branches.length
  };
}

/**
 * POST /branches - Creates a new memory branch
 *
 * @downstream createBranch — inserts into memory_branches table
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern non-destructive-branch — branch creation does not affect existing memory; overrides are per-branch
 * @antipattern Do NOT allow creating a branch named 'main' — main is the canonical immutable branch
 */
export async function handleCreateBranch(db: DrizzleD1, body: { name?: string; description?: string; parentBranch?: string }) {
  const { name, description, parentBranch } = body;
  if (!name) {
    return { error: 'Branch name is required', status: 400 };
  }
  if (name === 'main') {
    return { error: "Cannot create branch named 'main'", status: 400 };
  }
  return await createBranch(db, name, description || null, parentBranch || null);
}

/**
 * GET /branches/active - Returns the currently active branch
 *
 * @downstream getActiveBranch — reads memory_branches where is_active = 1
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern safe-default — falls back to { name: 'main', is_active: 1 } when no branch is active
 * @antipattern Do NOT assume a branch will always be set — always handle the null/no-active case
 */
export async function handleGetActiveBranch(db: DrizzleD1) {
  const branch = await getActiveBranch(db);
  return { branch: branch || { name: 'main', is_active: 1 } };
}

/**
 * POST /branches/:name/activate - Switches the active branch by name
 *
 * @downstream activateBranch — sets is_active = 1 on target, 0 on all others
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern exclusive-activation — only one branch can be active at a time
 * @antipattern Do NOT set is_active directly via raw SQL — use activateBranch to maintain exclusivity
 */
export async function handleActivateBranch(db: DrizzleD1, name: string) {
  if (!name) {
    return { error: 'Branch name is required', status: 400 };
  }
  return await activateBranch(db, name);
}

/**
 * DELETE /branches/:name - Deletes a memory branch and its overrides
 *
 * @downstream deleteBranch — removes branch row and cascades to memory_overrides
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern cascading-delete — deleting a branch removes all its overrides; underlying history is unaffected
 * @antipattern Do NOT delete the 'main' branch — main is the canonical view and has no branch record to delete
 */
export async function handleDeleteBranch(db: DrizzleD1, name: string) {
  if (!name) {
    return { error: 'Branch name is required', status: 400 };
  }
  return await deleteBranch(db, name);
}

/**
 * POST /branches/:name/fork - Forks an existing branch into a new named branch
 *
 * @downstream forkBranch — copies source branch overrides into a new branch row
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern non-destructive-branch — fork duplicates overrides; source branch is untouched
 * @antipattern Do NOT mutate the source branch during a fork — each branch maintains independent overrides
 */
export async function handleForkBranch(db: DrizzleD1, sourceName: string, body: { newName?: string; description?: string }) {
  const { newName, description } = body;
  if (!sourceName || !newName) {
    return { error: 'Source branch name and new name are required', status: 400 };
  }
  return await forkBranch(db, sourceName, newName, description || null);
}

/**
 * POST /branches/:name/reset - Clears all overrides from a branch without deleting it
 *
 * @downstream getBranchByName — resolves branch name to ID; resetBranch — deletes all memory_overrides for branch
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern non-destructive-reset — only overrides are removed; branch record and underlying history are preserved
 * @antipattern Do NOT delete the branch row to "reset" it — use resetBranch to preserve the branch identity
 */
export async function handleResetBranch(db: DrizzleD1, name: string) {
  if (!name) {
    return { error: 'Branch name is required', status: 400 };
  }
  const branch = await getBranchByName(db, name);
  if (!branch) {
    return { error: `Branch '${name}' not found`, status: 404 };
  }
  return await resetBranch(db, branch.id);
}

// --- Memory Overrides ---

/**
 * POST /branches/active/exclude - Excludes a memory entry from the active branch's view
 *
 * @downstream getActiveBranch — resolves active branch ID; excludeMemory — inserts exclude override into memory_overrides
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern non-destructive-exclusion — the underlying history row is not deleted; the override hides it from branch view
 * @antipattern Do NOT delete history rows to hide entries — use excludeMemory to maintain append-only integrity
 */
export async function handleExcludeMemory(db: DrizzleD1, body: { table?: string; id?: number }) {
  const { table, id } = body;
  if (!table || !id) {
    return { error: 'Table and id are required', status: 400 };
  }
  const branch = await getActiveBranch(db);
  if (!branch) {
    return { error: 'No active branch found', status: 500 };
  }
  return await excludeMemory(db, branch.id, table, id);
}

/**
 * POST /branches/active/include - Re-includes a previously excluded memory in the active branch
 *
 * @downstream getActiveBranch — resolves active branch ID; includeMemory — removes exclude override from memory_overrides
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern override-removal — undoes a prior exclude by deleting the override row, restoring default visibility
 * @antipattern Do NOT re-insert a history row to "un-exclude" — remove the override with includeMemory
 */
export async function handleIncludeMemory(db: DrizzleD1, body: { table?: string; id?: number }) {
  const { table, id } = body;
  if (!table || !id) {
    return { error: 'Table and id are required', status: 400 };
  }
  const branch = await getActiveBranch(db);
  if (!branch) {
    return { error: 'No active branch found', status: 500 };
  }
  return await includeMemory(db, branch.id, table, id);
}

/**
 * POST /branches/active/edit - Applies a content/type/internal edit override to a memory entry
 *
 * @downstream getActiveBranch — resolves active branch ID; editMemory — upserts edit override into memory_overrides
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern non-destructive-edit — original history row is unchanged; the override shadows it in branch view
 * @antipattern Do NOT UPDATE the original history row — edits are branch-scoped overrides, not mutations
 */
/**
 * GET /memory/overrides — the branch audit trail.
 *
 * The override system could WRITE (edit/exclude/reorder) but nothing could
 * READ the trail back (F-04, RUN-20260711-1939): getOverrides had no route,
 * so no client could show what a branch changes. The chat surface needs it
 * to render edited/excluded entries truthfully.
 */
export async function handleGetOverrides(db: DrizzleD1) {
  const branch = await getActiveBranch(db);
  if (!branch) {
    return { overrides: [], branchId: null, branchName: null };
  }
  const overrides = await getOverrides(db, branch.id);
  return { overrides, branchId: branch.id, branchName: branch.name };
}

export async function handleEditMemory(db: DrizzleD1, body: { table?: string; id?: number; content?: string; type?: string; internal?: string }) {
  const { table, id, content, type, internal } = body;
  if (!table || !id) {
    return { error: 'Table and id are required', status: 400 };
  }
  if (content === undefined && type === undefined && internal === undefined) {
    return { error: 'At least one of content, type, or internal is required', status: 400 };
  }

  const branch = await getActiveBranch(db);
  if (!branch) {
    return { error: 'No active branch found', status: 500 };
  }

  const edits: Record<string, string> = {};
  if (content !== undefined) edits.content = content;
  if (type !== undefined) edits.type = type;
  if (internal !== undefined) edits.internal = internal;

  return await editMemory(db, branch.id, table, id, edits);
}

/**
 * POST /branches/active/reorder - Reorders a memory entry within the active branch view
 *
 * @downstream getActiveBranch — resolves active branch ID; reorderMemory — upserts position/timestamp override
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern non-destructive-reorder — original created_at is unchanged; override provides a branch-local sort key
 * @antipattern Do NOT UPDATE created_at on history rows — use reorderMemory overrides for branch-local ordering
 */
export async function handleReorderMemory(db: DrizzleD1, body: { table?: string; id?: number; position?: number; timestamp?: string }) {
  const { table, id, position, timestamp } = body;
  if (!table || !id) {
    return { error: 'Table and id are required', status: 400 };
  }
  if (position === undefined && timestamp === undefined) {
    return { error: 'Either position or timestamp is required', status: 400 };
  }

  const branch = await getActiveBranch(db);
  if (!branch) {
    return { error: 'No active branch found', status: 500 };
  }

  const positionData: Record<string, string | number> = {};
  if (position !== undefined) positionData.position = position;
  if (timestamp !== undefined) positionData.timestamp_override = timestamp;

  return await reorderMemory(db, branch.id, table, id, positionData);
}

/**
 * DELETE /branches/overrides/:id - Removes a specific memory override by ID
 *
 * @downstream removeOverride — deletes the memory_overrides row by primary key
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern targeted-override-removal — removes one specific override; other overrides on same entry are unaffected
 * @antipattern Do NOT use this to reset an entire branch — use handleResetBranch for bulk override removal
 */
export async function handleRemoveOverride(db: DrizzleD1, overrideId: number) {
  if (!overrideId) {
    return { error: 'Override ID is required', status: 400 };
  }
  return await removeOverride(db, overrideId);
}

// --- Synthetic Memories ---

/**
 * GET /branches/active/synthetics - Returns synthetic memories injected into the active branch
 *
 * @downstream getActiveBranch — resolves active branch; getSyntheticMemories — reads synthetic rows for branch
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern safe-default — returns empty synthetics array when no branch is active rather than erroring
 * @antipattern Do NOT mix synthetic memories with real history rows — synthetics are branch-local and clearly flagged
 */
export async function handleGetSyntheticMemories(db: DrizzleD1) {
  const branch = await getActiveBranch(db);
  if (!branch) {
    return { synthetics: [], branchId: null };
  }
  const synthetics = await getSyntheticMemories(db, branch.id);
  return { synthetics, branchId: branch.id, branchName: branch.name };
}

/**
 * POST /branches/active/synthetics - Injects a synthetic memory into the active branch
 *
 * @downstream getActiveBranch — resolves active branch ID; addSyntheticMemory — inserts synthetic row with optional placement
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern branch-local-injection — synthetic memory is scoped to the active branch; does not affect other branches or main
 * @antipattern Do NOT insert directly into the history table as a workaround — synthetics belong in memory_overrides with is_synthetic flag
 */
export async function handleAddSyntheticMemory(db: DrizzleD1, body: { type?: string; content?: string; internal?: string; timestamp?: string; afterId?: number }) {
  const { type, content, internal, timestamp, afterId } = body;
  if (!type || !content) {
    return { error: 'Type and content are required', status: 400 };
  }

  const branch = await getActiveBranch(db);
  if (!branch) {
    return { error: 'No active branch found', status: 500 };
  }

  const placement: Record<string, string | number> = {};
  if (timestamp) placement.timestamp = timestamp;
  if (afterId) placement.afterId = afterId;

  return await addSyntheticMemory(db, branch.id, type, content, internal || null, Object.keys(placement).length > 0 ? placement : null);
}

/**
 * PUT /branches/synthetics/:id - Updates fields on an existing synthetic memory
 *
 * @downstream updateSyntheticMemory — patches synthetic row fields (type, content, internal, placement)
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern targeted-update — only explicitly provided fields are updated; omitted fields are unchanged
 * @antipattern Do NOT pass raw body directly — map body fields to update object to avoid injecting unexpected keys
 */
export async function handleUpdateSyntheticMemory(db: DrizzleD1, syntheticId: number, body: Record<string, unknown>) {
  if (!syntheticId) {
    return { error: 'Synthetic memory ID is required', status: 400 };
  }

  const updates: Record<string, unknown> = {};
  if (body.type !== undefined) updates.memoryType = body.type;
  if (body.content !== undefined) updates.content = body.content;
  if (body.internal !== undefined) updates.internal = body.internal;
  if (body.timestamp !== undefined || body.afterId !== undefined) {
    const placement: Record<string, unknown> = {};
    if (body.timestamp !== undefined) placement.timestamp = body.timestamp;
    if (body.afterId !== undefined) placement.afterId = body.afterId;
    updates.placement = placement;
  }

  if (Object.keys(updates).length === 0) {
    return { error: 'No fields to update', status: 400 };
  }

  return await updateSyntheticMemory(db, syntheticId, updates);
}

/**
 * DELETE /branches/synthetics/:id - Removes a synthetic memory by ID
 *
 * @downstream deleteSyntheticMemory — deletes synthetic row from memory_overrides
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern targeted-delete — removes one synthetic; other branch overrides are unaffected
 * @antipattern Do NOT use override removal (handleRemoveOverride) for synthetics — deleteSyntheticMemory is the correct path
 */
export async function handleDeleteSyntheticMemory(db: DrizzleD1, syntheticId: number) {
  if (!syntheticId) {
    return { error: 'Synthetic memory ID is required', status: 400 };
  }
  return await deleteSyntheticMemory(db, syntheticId);
}
