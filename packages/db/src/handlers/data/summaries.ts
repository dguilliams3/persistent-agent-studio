/**
 * Summary management handler functions
 *
 * @module @persistence/db/handlers/data/summaries
 * @description Handler functions for summary lifecycle: promote, demote, activate,
 * archive, tier, move, position, and backfill operations.
 *
 * @antipattern Do NOT import from @persistence/memory here — embeddingToBlob
 *   is injected as a parameter to avoid DAG violation (db cannot depend on memory).
 *
 * @upstream Called by: platforms/cloudflare/src/routes/registry.ts
 * @downstream Calls: @persistence/db/summaries functions, Drizzle query builder
 */

import { eq, isNull } from 'drizzle-orm';
import type { DrizzleD1 } from '../../client';
import { summaries } from '../../schema/summaries';

import {
  getActiveSummaries, getAllSummaries, getSummaryStats,
  promoteSummary, demoteSummary,
  activateSummary, archiveSummaryById,
  setSummaryPosition, backfillCoveredStart,
  setSummaryTier,
  moveSummary,
} from '../../index';

/**
 * GET /summaries - Returns compressed history summaries with filtering options
 */
export async function handleGetSummaries(db: DrizzleD1, searchParams: URLSearchParams | null = null) {
  const includeArchived = searchParams?.get('include_archived') === 'true';
  const archivedOnly = searchParams?.get('archived_only') === 'true';
  const includeStats = searchParams?.get('stats') !== 'false';

  const response: Record<string, unknown> = {};

  if (archivedOnly) {
    response.archived = await getAllSummaries(db, { archivedOnly: true });
  } else if (includeArchived) {
    response.active = await getActiveSummaries(db);
    response.archived = await getAllSummaries(db, { archivedOnly: true });
  } else {
    response.active = await getActiveSummaries(db);
  }

  if (includeStats) {
    response.stats = await getSummaryStats(db);
  }

  if (!archivedOnly) {
    response.summaries = response.active;
  }

  return response;
}

/**
 * POST /summaries/:id/promote - Promotes a summary to Block 2 (stable cached context)
 */
export async function handlePromoteSummary(db: DrizzleD1, summaryId: number) {
  const id = parseInt(String(summaryId));
  if (isNaN(id)) {
    return { error: 'Invalid summary ID', success: false };
  }

  try {
    await promoteSummary(db, id);
    return { success: true, promoted: true, id };
  } catch (error: unknown) {
    console.error(`[handlePromoteSummary] Error promoting summary ${id}:`, error instanceof Error ? error.message : String(error));
    return { error: 'Failed to promote summary', success: false };
  }
}

/**
 * POST /summaries/:id/demote - Demotes a summary from Block 2
 */
export async function handleDemoteSummary(db: DrizzleD1, summaryId: number) {
  const id = parseInt(String(summaryId));
  if (isNaN(id)) {
    return { error: 'Invalid summary ID', success: false };
  }

  try {
    await demoteSummary(db, id);
    return { success: true, promoted: false, id };
  } catch (error: unknown) {
    console.error(`[handleDemoteSummary] Error demoting summary ${id}:`, error instanceof Error ? error.message : String(error));
    return { error: 'Failed to demote summary', success: false };
  }
}

/**
 * POST /summaries/:id/activate - Activates (un-archives) a summary
 */
export async function handleActivateSummary(db: DrizzleD1, summaryId: number) {
  const id = parseInt(String(summaryId));
  if (isNaN(id)) {
    return { error: 'Invalid summary ID', success: false };
  }

  try {
    const result = await activateSummary(db, id);
    return { success: true, activated: true, id, changes: result.changes };
  } catch (error: unknown) {
    console.error(`[handleActivateSummary] Error activating summary ${id}:`, error instanceof Error ? error.message : String(error));
    return { error: 'Failed to activate summary', success: false };
  }
}

/**
 * POST /summaries/:id/archive - Archives a summary to RAG Archive
 */
export async function handleArchiveSummary(db: DrizzleD1, summaryId: number) {
  const id = parseInt(String(summaryId));
  if (isNaN(id)) {
    return { error: 'Invalid summary ID', success: false };
  }

  try {
    const result = await archiveSummaryById(db, id);
    return { success: true, archived: true, id, changes: result.changes };
  } catch (error: unknown) {
    console.error(`[handleArchiveSummary] Error archiving summary ${id}:`, error instanceof Error ? error.message : String(error));
    return { error: 'Failed to archive summary', success: false };
  }
}

/**
 * POST /summaries/:id/position - Set manual sort position for a summary
 */
export async function handleSetSummaryPosition(db: DrizzleD1, summaryId: number, position: number) {
  const id = parseInt(String(summaryId));
  if (isNaN(id)) {
    return { error: 'Invalid summary ID', success: false };
  }

  const positionValue = parseInt(String(position));
  if (isNaN(positionValue)) {
    return { error: 'Invalid position value', success: false };
  }

  try {
    await setSummaryPosition(db, id, positionValue);
    return { success: true, id, sort_position: positionValue };
  } catch (error: unknown) {
    console.error(`[handleSetSummaryPosition] Error setting position for summary ${id}:`, error instanceof Error ? error.message : String(error));
    return { error: 'Failed to set summary position', success: false };
  }
}

/**
 * POST /summaries/backfill-covered-start - Backfill covered_start for all summaries
 */
export async function handleBackfillCoveredStart(db: DrizzleD1) {
  try {
    const result = await backfillCoveredStart(db);
    return {
      success: true,
      updated: result.updated,
      failed: result.failed,
      ...(result.errors?.length > 0 && { failures: result.errors })
    };
  } catch (error: unknown) {
    console.error('[handleBackfillCoveredStart] Error backfilling covered_start:', error instanceof Error ? error.message : String(error));
    return { error: 'Failed to backfill covered_start', success: false };
  }
}

/**
 * POST /summaries/backfill-embeddings - Generates embeddings for summaries missing them
 *
 * @param embeddingProvider - Object with generate(text) method
 * @param embeddingModel - Model identifier string
 * @param embeddingSerializer - Function to convert Float32Array to ArrayBuffer (injected to avoid @persistence/memory DAG violation)
 */
export async function handleBackfillEmbeddings(
  db: DrizzleD1,
  embeddingProvider: { generate: (text: string) => Promise<{ success: boolean; data?: Float32Array | number[]; error?: { message: string } }> },
  embeddingModel: string,
  embeddingSerializer: (embedding: Float32Array) => ArrayBuffer
) {
  try {
    const missing = await db.select({
      id: summaries.id,
      summary: summaries.summary,
    })
      .from(summaries)
      .where(isNull(summaries.embedding))
      .orderBy(summaries.id)
      .all();

    if (!missing.length) {
      return { success: true, updated: 0, failed: 0, total_missing: 0, message: 'No summaries missing embeddings' };
    }

    const totalMissing = missing.length;
    let updated = 0;
    let failed = 0;
    const failures: Array<{ id: unknown; error?: string }> = [];

    const batchSize = 10;
    for (let index = 0; index < missing.length; index += batchSize) {
      const batch = missing.slice(index, index + batchSize);

      for (const row of batch) {
        try {
          const embeddingResult = await embeddingProvider.generate(row.summary as string);
          if (embeddingResult.success && embeddingResult.data) {
            const float32 = embeddingResult.data instanceof Float32Array
              ? embeddingResult.data
              : new Float32Array(embeddingResult.data);
            const embedding = embeddingSerializer(float32);
            await db.update(summaries)
              .set({ embedding, embeddingModel })
              .where(eq(summaries.id, row.id));
            updated++;
          } else {
            failed++;
            failures.push({ id: row.id, error: embeddingResult.error?.message });
          }
        } catch (error: unknown) {
          failed++;
          failures.push({ id: row.id, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }

    return {
      success: true,
      updated,
      failed,
      total_missing: totalMissing,
      ...(failures.length > 0 && { failures })
    };
  } catch (error: unknown) {
    console.error('[handleBackfillEmbeddings] Error:', error instanceof Error ? error.message : String(error));
    return { error: 'Failed to backfill embeddings', success: false };
  }
}

/**
 * POST /summaries/:id/tier - Sets the tier for a summary
 */
export async function handleSetSummaryTier(db: DrizzleD1, summaryId: number, tier: number | string) {
  const validTiers: Array<number | string> = [2, 3, 4, 'archived'];
  if (tier === undefined || tier === null || !validTiers.includes(tier)) {
    return { error: 'tier must be 2, 3, 4, or "archived"', status: 400 };
  }

  const id = parseInt(String(summaryId));
  if (isNaN(id)) {
    return { error: 'Invalid summary ID', success: false, status: 400 };
  }

  try {
    const result = await setSummaryTier(db, id, tier as 2 | 3 | 4 | 'archived');
    return { success: true, changes: result.changes };
  } catch (error: unknown) {
    console.error(`[handleSetSummaryTier] Error setting tier for summary ${id}:`, error instanceof Error ? error.message : String(error));
    return { error: 'Failed to set summary tier', success: false, status: 500 };
  }
}

/**
 * POST /summaries/:id/move - Moves a summary to a tier with a specific position
 */
export async function handleMoveSummary(db: DrizzleD1, summaryId: number, tier: number, position: number | null = null) {
  const validTiers = [2, 3, 4];
  if (tier === undefined || tier === null || !validTiers.includes(tier)) {
    return { error: 'tier must be 2, 3, or 4', status: 400 };
  }

  const id = parseInt(String(summaryId));
  if (isNaN(id)) {
    return { error: 'Invalid summary ID', success: false, status: 400 };
  }

  try {
    const result = await moveSummary(db, id, tier as 2 | 3 | 4, position ?? null);
    return {
      success: true,
      changes: result.changes,
      tier,
      position: position ?? null
    };
  } catch (error: unknown) {
    console.error(`[handleMoveSummary] Error moving summary ${id}:`, error instanceof Error ? error.message : String(error));
    return { error: 'Failed to move summary', success: false, status: 500 };
  }
}
