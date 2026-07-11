/**
 * Observations database operations
 *
 * @module @persistence/db/memory/observations
 * @description Database operations for observations about the user.
 *
 * Observations are structured knowledge about the user that Claude discovers and maintains:
 * - Soft delete (deleted_at) for audit/recovery
 * - Support for restoration of previously deleted observations
 * - Case-insensitive, partial title matching
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/observations.js - API endpoint handlers
 *   - platforms/cloudflare/src/index.js - Context building, OBSERVATION actions
 * @downstream Calls:
 *   - Drizzle query builder
 *   - @persistence/db/persona-scope - getActivePersonaId
 *
 * @antipattern RAW_SQL_IN_HANDLER
 *   If you're writing raw SQL for observations operations in a handler, STOP.
 *   Import and use these functions instead. Handlers should orchestrate, not query.
 */

import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import type { DrizzleD1 } from '../client';
import { getActivePersonaId } from '../persona-scope';
import { observations } from '../schema/observations';
import type { ObservationEntry } from './ObservationEntry';
import type { SaveResult } from './SaveResult';
import type { DeleteResult } from './DeleteResult';

/**
 * Options for persona-scoped observation operations.
 */
interface ObservationOptions {
  personaId?: number;
}

/**
 * Maps a Drizzle row (camelCase properties) to the snake_case
 * ObservationEntry contract — same boundary repair as toHistoryEntry
 * (see packages/db/src/history.ts).
 */
function toObservationEntry(row: typeof observations.$inferSelect): ObservationEntry {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    summary: row.summary ?? '',
    created_at: row.createdAt ?? '',
    updated_at: row.updatedAt ?? '',
    deleted_at: row.deletedAt,
  };
}

/**
 * @description Retrieves all active (non-deleted) observations
 *
 * Observations use soft delete (deleted_at) for audit/recovery purposes.
 *
 * @param db - Drizzle D1 client
 * @param options - Optional settings
 * @returns Array of active observation entries
 */
export async function getObservations(db: DrizzleD1, options: ObservationOptions = {}): Promise<ObservationEntry[]> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const rows = await db.select()
    .from(observations)
    .where(and(
      eq(observations.personaId, personaId),
      isNull(observations.deletedAt)
    ))
    .orderBy(desc(observations.updatedAt))
    .all();

  return rows.map(toObservationEntry);
}

/**
 * @description Retrieves a lightweight index of observations (id, title, summary only - no full content)
 *
 * @param db - Drizzle D1 client
 * @param options - Optional settings
 * @returns Array of observation index entries (id, title, summary only)
 */
export async function getObservationIndex(db: DrizzleD1, options: ObservationOptions = {}): Promise<Partial<ObservationEntry>[]> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const rows = await db.select({
    id: observations.id,
    title: observations.title,
    summary: observations.summary,
  })
    .from(observations)
    .where(and(
      eq(observations.personaId, personaId),
      isNull(observations.deletedAt)
    ))
    .orderBy(desc(observations.updatedAt))
    .all();

  return rows as Partial<ObservationEntry>[];
}

/**
 * @description Retrieves a single observation by title, supporting exact and partial matching (excludes soft-deleted)
 *
 * INPUT TOLERANCE:
 * - Trims whitespace from query
 * - Case-insensitive matching
 * - Falls back to partial LIKE match if exact match fails
 *
 * @param db - Drizzle D1 client
 * @param titleQuery - The title to search for (case-insensitive, supports partial match)
 * @param options - Optional settings
 * @returns The observation object or null if not found
 *
 * @note SQLite LIKE patterns limited to ~50 chars to avoid SQLITE_ERROR
 */
export async function getObservation(
  db: DrizzleD1,
  titleQuery: string,
  options: ObservationOptions = {}
): Promise<ObservationEntry | null> {
  const normalized = titleQuery?.trim();
  if (!normalized) return null;

  const personaId = options.personaId ?? await getActivePersonaId(db);

  // Try exact match first (only non-deleted, scoped to persona)
  let result = await db.select()
    .from(observations)
    .where(and(
      eq(observations.personaId, personaId),
      sql`LOWER(title) = LOWER(${normalized})`,
      isNull(observations.deletedAt)
    ))
    .get();

  if (!result) {
    const searchTerm = normalized.slice(0, 50);
    result = await db.select()
      .from(observations)
      .where(and(
        eq(observations.personaId, personaId),
        sql`LOWER(title) LIKE LOWER(${`%${searchTerm}%`})`,
        isNull(observations.deletedAt)
      ))
      .get();
  }

  return result ? toObservationEntry(result) : null;
}

/**
 * @description Creates, updates, or restores an observation. Restores soft-deleted entries if same title exists
 *
 * @param db - Drizzle D1 client
 * @param title - The title of the observation
 * @param content - The full content/body of the observation
 * @param summary - A brief summary for the index view
 * @param options - Optional settings
 * @returns Object with action ('created', 'updated', or 'restored') and the observation ID
 */
export async function saveObservation(
  db: DrizzleD1,
  title: string,
  content: string,
  summary: string,
  options: ObservationOptions = {}
): Promise<SaveResult> {
  const safeTitle = title ?? 'Untitled';
  const safeContent = content ?? '';
  const safeSummary = summary ?? null;

  const personaId = options.personaId ?? await getActivePersonaId(db);

  // Check for existing (including soft-deleted, scoped to persona)
  const existing = await db.select({
    id: observations.id,
    deletedAt: observations.deletedAt,
  })
    .from(observations)
    .where(and(
      eq(observations.personaId, personaId),
      sql`LOWER(title) = LOWER(${safeTitle})`
    ))
    .get();

  if (existing) {
    // Update and restore if was deleted
    await db.update(observations)
      .set({
        content: safeContent,
        summary: safeSummary,
        updatedAt: sql`datetime("now")`,
        deletedAt: null,
      })
      .where(and(eq(observations.personaId, personaId), eq(observations.id, existing.id)));

    return { action: existing.deletedAt ? 'restored' : 'updated', id: existing.id };
  } else {
    const result = await db.insert(observations).values({
      personaId,
      title: safeTitle,
      content: safeContent,
      summary: safeSummary,
    }).returning({ id: observations.id });

    return { action: 'created', id: result[0].id };
  }
}

/**
 * @description Soft-deletes an observation by title
 *
 * @param db - Drizzle D1 client
 * @param titleQuery - The title to search for and delete
 * @param options - Optional settings
 * @returns Object with success flag and deleted title (if found)
 */
export async function deleteObservation(
  db: DrizzleD1,
  titleQuery: string,
  options: ObservationOptions = {}
): Promise<DeleteResult> {
  const observation = await getObservation(db, titleQuery, options);
  if (observation) {
    const personaId = options.personaId ?? await getActivePersonaId(db);
    await db.update(observations)
      .set({ deletedAt: sql`datetime("now")` })
      .where(and(eq(observations.personaId, personaId), eq(observations.id, observation.id)));

    return { success: true, title: observation.title };
  }
  return { success: false };
}

/**
 * @description Retrieves all observations including soft-deleted ones (for audit/recovery)
 *
 * @param db - Drizzle D1 client
 * @param options - Optional settings
 * @returns Array of all observation entries including soft-deleted
 */
export async function getAllObservationsIncludingDeleted(
  db: DrizzleD1,
  options: ObservationOptions = {}
): Promise<ObservationEntry[]> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const rows = await db.select()
    .from(observations)
    .where(eq(observations.personaId, personaId))
    .orderBy(desc(observations.updatedAt))
    .all();

  return rows.map(toObservationEntry);
}
