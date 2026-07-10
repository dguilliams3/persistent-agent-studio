/**
 * Summary tier management database operations
 *
 * @module @persistence/db/summaries/tiers
 * @description Tier management for the v25 summary tier system.
 *
 * The three-tier system:
 * - **cached**: Pinned to stable context block (Anthropic cache-friendly)
 * - **tail**: Dynamic context, most recent summaries
 * - **archived**: Not in direct context, available via RAG
 *
 * Functions for:
 * - Setting tier and position
 * - Promoting/demoting between tiers
 * - Activating (un-archiving) and archiving
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/summaries.js - Tier management endpoints
 * @downstream Calls:
 *   - Drizzle query builder
 */

import { eq, and, isNull } from 'drizzle-orm';
import type { DrizzleD1 } from '../client';
import { scopedUpdate } from '../scoped-query';
import { summaries } from '../schema/summaries';
import type { SummaryTier } from './mappers';

/**
 * @description Sets the tier for a summary
 *
 * @pattern Valid tiers: 2 (PROMOTED), 3 (STABLE), 4 (FRESH), 'archived'
 * @antipattern Do NOT use string names ('promoted', 'cached', 'tail') - use numbers.
 *
 * @param db - Drizzle D1 client
 * @param summaryId - The summary ID to update
 * @param tier - The new tier: 2, 3, 4, or 'archived'
 * @returns Result with number of rows affected
 */
export async function setSummaryTier(
  db: DrizzleD1,
  summaryId: number,
  tier: SummaryTier
): Promise<{ changes: number }> {
  const validTiers = [2, 3, 4, 'archived'];
  if (!validTiers.includes(tier)) {
    throw new Error(`Invalid tier: ${tier}. Must be 2, 3, 4, or 'archived'`);
  }

  // Store as string in DB (TEXT column)
  const tierValue = typeof tier === 'number' ? String(tier) : tier;

  const update = await scopedUpdate(db, summaries);
  const result = await update.set({ tier: tierValue })
    .where(eq(summaries.id, summaryId))
    .returning({ id: summaries.id });

  return { changes: result.length };
}

/**
 * @description Sets the position within a tier for ordering
 *
 * @param db - Drizzle D1 client
 * @param summaryId - The summary ID to update
 * @param position - The new position (null to clear)
 * @returns Result with number of rows affected
 */
export async function setSummaryTierPosition(
  db: DrizzleD1,
  summaryId: number,
  position: number | null
): Promise<{ changes: number }> {
  const update = await scopedUpdate(db, summaries);
  const result = await update.set({ tierPosition: position ?? null })
    .where(eq(summaries.id, summaryId))
    .returning({ id: summaries.id });

  return { changes: result.length };
}

/**
 * @description Moves a summary to a different tier with a specific position
 *
 * Combines tier change and position setting in one atomic operation.
 *
 * @pattern Use this for drag-and-drop reordering between visible tiers.
 * @antipattern Do NOT use for archiving - use archiveSummaryById() instead.
 *
 * @param db - Drizzle D1 client
 * @param summaryId - The summary ID to move
 * @param tier - Target tier: 2 (Promoted), 3 (Cached), 4 (Tail)
 * @param position - Position within the tier (null for default ordering)
 * @returns Result with number of rows affected
 */
export async function moveSummary(
  db: DrizzleD1,
  summaryId: number,
  tier: 2 | 3 | 4,
  position: number | null
): Promise<{ changes: number }> {
  const validTiers = [2, 3, 4];
  if (!validTiers.includes(tier)) {
    throw new Error(`Invalid tier for move: ${tier}. Must be 2, 3, or 4`);
  }

  const update = await scopedUpdate(db, summaries);
  const result = await update.set({
    tier: String(tier),
    tierPosition: position ?? null,
  }).where(eq(summaries.id, summaryId))
    .returning({ id: summaries.id });

  return { changes: result.length };
}

/**
 * @description Promotes a summary to Block 2 (tier=2, BLOCK.PROMOTED)
 *
 * Promoted summaries always appear in Claude's prompt within Anthropic's
 * Prompt Caching block. Idempotent.
 *
 * @param db - Drizzle D1 client
 * @param summaryId - The summary ID to promote
 */
export async function promoteSummary(db: DrizzleD1, summaryId: number): Promise<void> {
  const update = await scopedUpdate(db, summaries);
  await update.set({ tier: '2' })
    .where(and(eq(summaries.id, summaryId), isNull(summaries.archivedAt)));
}

/**
 * @description Demotes a summary from Block 2 (tier=2) to Cached Block (tier=3)
 *
 * After demotion, the summary returns to the stable cached block. Idempotent.
 *
 * @param db - Drizzle D1 client
 * @param summaryId - The summary ID to demote
 */
export async function demoteSummary(db: DrizzleD1, summaryId: number): Promise<void> {
  const update = await scopedUpdate(db, summaries);
  await update.set({ tier: '3' })
    .where(and(eq(summaries.id, summaryId), isNull(summaries.archivedAt)));
}

/**
 * @description Activates (un-archives) a summary, moving it from RAG Archive to active tier
 *
 * Clears archived_at and replaced_by_id, sets tier to '4' (Dynamic Tail). Idempotent.
 *
 * @param db - Drizzle D1 client
 * @param summaryId - The summary ID to activate
 * @returns Result with number of rows affected
 */
export async function activateSummary(db: DrizzleD1, summaryId: number): Promise<{ changes: number }> {
  const update = await scopedUpdate(db, summaries);
  const result = await update.set({
    archivedAt: null,
    replacedById: null,
    tier: '4',
  }).where(eq(summaries.id, summaryId))
    .returning({ id: summaries.id });

  return { changes: result.length };
}

/**
 * @description Archives a summary by ID (manual archival, no replacement link)
 *
 * Sets archived_at and tier='archived'. This is the inverse of activateSummary().
 * Does NOT set replaced_by_id — use archiveSummaries() in crud.ts for that.
 *
 * @param db - Drizzle D1 client
 * @param summaryId - The summary ID to archive
 * @returns Result with number of rows affected
 */
export async function archiveSummaryById(db: DrizzleD1, summaryId: number): Promise<{ changes: number }> {
  const now = new Date().toISOString();
  const update = await scopedUpdate(db, summaries);
  const result = await update.set({
    archivedAt: now,
    tier: 'archived',
  }).where(eq(summaries.id, summaryId))
    .returning({ id: summaries.id });

  return { changes: result.length };
}
