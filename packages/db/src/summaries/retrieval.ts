/**
 * Summary retrieval database operations
 *
 * @module @persistence/db/summaries/retrieval
 * @description Query functions for retrieving summaries by various criteria.
 *
 * The summary system uses a three-tier architecture:
 * - Cached: Pinned to stable context block (Anthropic cache-friendly)
 * - Tail: Dynamic context, most recent summaries
 * - Archived: Not in direct context, available via RAG
 *
 * These functions handle retrieval for context building and display.
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/index.js - runThinkingCycle(), buildSystemPrompt()
 *   - platforms/cloudflare/src/routes/summaries.js - API endpoints
 *   - platforms/cloudflare/src/telegram/commands/ - Status commands
 * @downstream Calls:
 *   - Drizzle query builder
 *   - @persistence/memory - rowToSummary mapper
 */

import { isNull, isNotNull, desc, asc, eq, and, sql } from 'drizzle-orm';
import type { DrizzleD1 } from '../client';
import { getActivePersonaId } from '../persona-scope';
import { scopedSelect } from '../scoped-query';
import { summaries } from '../schema/summaries';
import { rowToSummary, toSummaryRow, type Summary, type SummaryRow } from './mappers';

/**
 * @description Retrieves only ACTIVE (non-archived) summaries in tier-sorted order
 *
 * v25 sorting: tier first (cached=0, tail=1, else=2), then tier_position, then covered_start
 *
 * @param db - Drizzle D1 client
 * @returns Array of active summary objects with typed fields
 */
export async function getActiveSummaries(db: DrizzleD1): Promise<Summary[]> {
  const personaId = await getActivePersonaId(db);
  // Sort by tier (promoted first, then cached, then tail), then position, then date
  const results = await db.all(sql`
    SELECT * FROM summaries
    WHERE archived_at IS NULL
      AND persona_id = ${personaId}
    ORDER BY
      CASE tier
        WHEN 'promoted' THEN 0
        WHEN 'cached' THEN 1
        WHEN 'tail' THEN 2
        WHEN '2' THEN 0
        WHEN '3' THEN 1
        WHEN '4' THEN 2
        ELSE 3
      END,
      tier_position ASC NULLS LAST,
      COALESCE(covered_start, created_at) ASC
  `);

  // Raw SQL (db.all) returns real snake_case column names, so this cast is
  // truthful — unlike Drizzle-builder sites, which return camelCase schema
  // properties and must go through toSummaryRow().
  return (results as unknown as SummaryRow[]).map(row => rowToSummary(row));
}

/**
 * @description Retrieves the CONTEXT tier summaries - newest N non-archived summaries
 *
 * Returns them in chronological order (oldest first) for proper narrative flow.
 *
 * @param db - Drizzle D1 client
 * @param limit - Maximum summaries to include in context (default 5)
 * @returns Array of context summaries in chronological order
 */
export async function getContextSummaries(db: DrizzleD1, limit: number = 5): Promise<Summary[]> {
  const query = await scopedSelect(db, summaries);
  const results = await query.where(isNull(summaries.archivedAt))
    .orderBy(desc(summaries.id))
    .limit(limit)
    .all();

  // Reverse to chronological order (oldest first) for prompt narrative flow
  return results.reverse().map(row => rowToSummary(toSummaryRow(row as typeof summaries.$inferSelect)));
}

/**
 * @description Retrieves the TAIL tier summaries - summaries after context, awaiting consolidation
 *
 * Uses OFFSET to skip context summaries and LIMIT to cap buffer size.
 *
 * @param db - Drizzle D1 client
 * @param contextSize - Number of context summaries to skip (OFFSET)
 * @param bufferSize - Maximum buffer summaries to retrieve
 * @returns Array of buffer summaries in chronological order
 */
export async function getBufferSummaries(db: DrizzleD1, contextSize: number = 5, bufferSize: number = 5): Promise<Summary[]> {
  const query = await scopedSelect(db, summaries);
  const results = await query.where(isNull(summaries.archivedAt))
    .orderBy(desc(summaries.id))
    .limit(bufferSize)
    .offset(contextSize)
    .all();

  // Reverse to chronological order (oldest first) for consistency
  return results.reverse().map(row => rowToSummary(toSummaryRow(row as typeof summaries.$inferSelect)));
}

/**
 * @description Returns the count of active (non-archived) summaries
 *
 * @param db - Drizzle D1 client
 * @returns Count of non-archived summaries
 */
export async function getActiveCount(db: DrizzleD1): Promise<number> {
  const personaId = await getActivePersonaId(db);
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(summaries)
    .where(and(eq(summaries.personaId, personaId), isNull(summaries.archivedAt)))
    .get();

  return result?.count ?? 0;
}

/**
 * @description Gets all summaries promoted to Block 2 (stable context)
 *
 * Promoted summaries bypass the normal buffer system and are pinned directly
 * in the stable context block.
 *
 * @param db - Drizzle D1 client
 * @returns Array of promoted summaries in chronological order
 */
export async function getPromotedSummaries(db: DrizzleD1): Promise<Summary[]> {
  const query = await scopedSelect(db, summaries);
  const results = await query.where(and(eq(summaries.tier, '2'), isNull(summaries.archivedAt)))
    .orderBy(asc(summaries.createdAt))
    .all();

  return results.map(row => rowToSummary(toSummaryRow(row as typeof summaries.$inferSelect)));
}

// ═══════════════════════════════════════════════════════════════════════════
// RAG RETRIEVAL QUERIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Options for retrieving summaries with embeddings.
 */
export interface GetSummariesWithEmbeddingsOptions {
  /** Include archived summaries in results. Defaults to true. */
  includeArchived?: boolean;
}

/**
 * @description Retrieves summaries that have embeddings for RAG retrieval.
 *
 * @param db - Drizzle D1 client
 * @param options - Query options
 * @returns Array of raw summary rows with embeddings
 */
export async function getSummariesWithEmbeddings(
  db: DrizzleD1,
  options: GetSummariesWithEmbeddingsOptions = {}
): Promise<SummaryRow[]> {
  const { includeArchived = true } = options;

  const query = await scopedSelect(db, summaries);
  const whereCondition = includeArchived
    ? isNotNull(summaries.embedding)
    : and(isNotNull(summaries.embedding), isNull(summaries.archivedAt));

  const results = await query.where(whereCondition)
    .orderBy(asc(summaries.createdAt))
    .all();

  return results.map((row) => toSummaryRow(row as typeof summaries.$inferSelect));
}
