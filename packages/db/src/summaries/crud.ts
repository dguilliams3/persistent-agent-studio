/**
 * Summary CRUD database operations
 *
 * @module @persistence/db/summaries/crud
 * @description Basic CRUD operations for the summaries table.
 *
 * Summaries are compressed batches of history entries. When history grows
 * too large, older entries are compressed into summaries to preserve context
 * while reducing token usage. Meta-summaries consolidate multiple summaries.
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/summaries.js - API endpoints
 *   - packages/memory/src/summarization/ - Summary creation
 * @downstream Calls:
 *   - Drizzle query builder
 *   - @persistence/db/persona-scope - getActivePersonaId
 *   - @persistence/memory - rowToSummary mapper
 */

import { eq, asc, and, inArray, isNull, isNotNull, sql } from 'drizzle-orm';
import type { DrizzleD1 } from '../client';
import { getActivePersonaId } from '../persona-scope';
import { scopedSelect, scopedUpdate } from '../scoped-query';
import { summaries } from '../schema/summaries';
import { rowToSummary, type Summary, type SummaryRow, type SummaryMetadata } from './mappers';

/**
 * @description Legacy function - retrieves all summaries (for backward compatibility)
 *
 * NOTE: This function returns ALL summaries including archived ones.
 * For new code, prefer getActiveSummaries() for context building.
 *
 * @deprecated Use getActiveSummaries() for context building, getAllSummaries() for queries
 *
 * @param db - Drizzle D1 client
 * @returns Array of all summary objects (including archived)
 */
export async function getSummaries(db: DrizzleD1): Promise<Summary[]> {
  const query = await scopedSelect(db, summaries);
  const results = await query.orderBy(asc(summaries.createdAt))
    .all();

  return results.map(row => rowToSummary(row as unknown as SummaryRow));
}

/**
 * @description Retrieves ALL summaries including archived ones
 *
 * @param db - Drizzle D1 client
 * @param options - Query options
 * @param options.includeArchived - Include archived summaries (default true)
 * @param options.archivedOnly - Only return archived summaries (default false)
 * @returns Array of summary objects
 */
export async function getAllSummaries(
  db: DrizzleD1,
  options: { includeArchived?: boolean; archivedOnly?: boolean } = {}
): Promise<Summary[]> {
  const { includeArchived = true, archivedOnly = false } = options;

  const query = await scopedSelect(db, summaries);
  let results;
  if (archivedOnly) {
    results = await query.where(isNotNull(summaries.archivedAt))
      .orderBy(asc(summaries.createdAt))
      .all();
  } else if (!includeArchived) {
    results = await query.where(isNull(summaries.archivedAt))
      .orderBy(asc(summaries.createdAt))
      .all();
  } else {
    results = await query.orderBy(asc(summaries.createdAt))
      .all();
  }

  return results.map(row => rowToSummary(row as unknown as SummaryRow));
}

/**
 * @description Retrieves a single summary by ID
 *
 * @param db - Drizzle D1 client
 * @param id - The summary ID to retrieve
 * @returns The summary object or null if not found
 */
export async function getSummaryById(db: DrizzleD1, id: number): Promise<Summary | null> {
  const scoped = await scopedSelect(db, summaries);
  const result = await scoped.where(eq(summaries.id, id)).get();

  return result ? rowToSummary(result as unknown as SummaryRow) : null;
}

/**
 * @description Adds a new summary entry with full metadata support
 *
 * Creates a summary from history entries or from consolidating other summaries.
 *
 * @param db - Drizzle D1 client
 * @param summary - The summarized content text
 * @param messageCount - Number of source entries (history or summaries)
 * @param coveredRange - Human-readable description of time/entry range
 * @param options - Additional fields
 * @returns The ID of the newly created summary
 *
 * @note Uses persona scoping via getActivePersonaId - persona_id auto-included
 * @note D1 accepts null but NOT undefined - all values use ?? null coalescing
 */
export async function addSummary(
  db: DrizzleD1,
  summaryText: string,
  messageCount: number,
  coveredRange: string,
  options: {
    sourceIds?: number[] | null;
    sourceType?: 'history' | 'summary';
    metadata?: SummaryMetadata;
    embedding?: ArrayBuffer | null;
    embeddingModel?: string | null;
    tokenCount?: number | null;
    tokenModel?: string | null;
    archivedAt?: string | null;
    personaId?: number;
  } = {}
): Promise<number> {
  const {
    sourceIds = null,
    sourceType = 'history',
    metadata = {},
    embedding = null,
    embeddingModel = null,
    tokenCount = null,
    tokenModel = null,
    archivedAt = null,
    personaId
  } = options;

  const resolvedPersonaId = personaId ?? await getActivePersonaId(db);
  const tier = archivedAt ? 'archived' : 'tail';

  try {
    const result = await db.insert(summaries).values({
      personaId: resolvedPersonaId,
      summary: summaryText,
      messageCount,
      coveredRange,
      sourceIds: sourceIds ? JSON.stringify(sourceIds) : null,
      sourceType,
      metadata: JSON.stringify(metadata),
      embedding: embedding ?? null,
      embeddingModel: embeddingModel ?? null,
      tokenCount: tokenCount ?? null,
      tokenModel: tokenModel ?? null,
      archivedAt: archivedAt ?? null,
      tier,
    }).returning({ id: summaries.id });

    return result[0].id;
  } catch (err) {
    console.error('[addSummary] INSERT failed:', (err as Error).message);
    throw err;
  }
}

/**
 * @description Archives summaries (soft delete) and links them to replacement
 *
 * @param db - Drizzle D1 client
 * @param summaryIds - Array of summary IDs to archive
 * @param replacedById - ID of the new summary that replaces these
 *
 * @note Cloudflare D1 has a limit of 100 bound variables per query
 */
export async function archiveSummaries(db: DrizzleD1, summaryIds: number[], replacedById: number): Promise<void> {
  if (!summaryIds || summaryIds.length === 0) return;

  const now = new Date().toISOString();
  const CHUNK_SIZE = 95;

  for (let chunkStart = 0; chunkStart < summaryIds.length; chunkStart += CHUNK_SIZE) {
    const chunk = summaryIds.slice(chunkStart, chunkStart + CHUNK_SIZE);
    const update = await scopedUpdate(db, summaries);
    await update.set({
      archivedAt: now,
      replacedById: replacedById,
      tier: 'archived',
    }).where(inArray(summaries.id, chunk));
  }
}

/**
 * @description Updates the embedding for an existing summary
 *
 * @param db - Drizzle D1 client
 * @param summaryId - The summary ID to update
 * @param embedding - The vector embedding blob
 * @param embeddingModel - Model identifier (e.g., 'bge-base-en-v1.5')
 */
export async function updateSummaryEmbedding(
  db: DrizzleD1,
  summaryId: number,
  embedding: ArrayBuffer,
  embeddingModel: string
): Promise<void> {
  const update = await scopedUpdate(db, summaries);
  await update.set({
    embedding,
    embeddingModel,
  }).where(eq(summaries.id, summaryId));
}

/**
 * @description Updates the metadata for an existing summary
 *
 * @param db - Drizzle D1 client
 * @param summaryId - The summary ID to update
 * @param metadata - The metadata object to store
 */
export async function updateSummaryMetadata(
  db: DrizzleD1,
  summaryId: number,
  metadata: SummaryMetadata
): Promise<void> {
  const update = await scopedUpdate(db, summaries);
  await update.set({ metadata: JSON.stringify(metadata) })
    .where(eq(summaries.id, summaryId));
}
