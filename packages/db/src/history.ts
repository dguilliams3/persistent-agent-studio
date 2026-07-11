/**
 * History table database operations
 *
 * The history table stores the conversation timeline - all messages,
 * thoughts, actions, and events between Claude and the user.
 *
 * History table is persona-scoped for multi-persona support.
 *
 * @module @persistence/db/history
 */

import { eq, and, isNull, desc, asc, sql, inArray } from 'drizzle-orm';
import type { DrizzleD1 } from './client';
import { getActivePersonaId } from './persona-scope';
import { history } from './schema/history';

export interface HistoryEntry {
  id: number;
  persona_id: number;
  type: string;
  content: string;
  internal: string | null;
  cycle_id: number | null;
  meter_snapshot: string | null;
  metadata: string | null;  // JSON blob for provider/model info, etc.
  created_at: string;
  summarized_at: string | null;
  blurred: number;
  vaulted: number;
}

/**
 * Maps a Drizzle row (camelCase schema properties) to the public
 * snake_case HistoryEntry contract.
 *
 * The Drizzle query-builder migration replaced raw SQL (which returned
 * snake_case column names) with the query builder (which returns camelCase
 * property names) and hid the shape change behind `as unknown as` casts.
 * Every consumer of the declared contract — the summarization pipeline
 * (`new Date(undefined)` → "Invalid time value"), UI timestamps, cycle
 * expansion — silently broke. This mapper restores the contract at the
 * boundary. It also intentionally DROPS `embedding`/`embedding_model`:
 * multi-KB vector blobs do not belong in chat/history responses.
 */
export function toHistoryEntry(row: typeof history.$inferSelect): HistoryEntry {
  return {
    id: row.id,
    persona_id: row.personaId,
    type: row.type,
    content: row.content ?? '',
    internal: row.internal,
    cycle_id: row.cycleId,
    meter_snapshot: row.meterSnapshot,
    metadata: row.metadata,
    created_at: row.createdAt ?? '',
    summarized_at: row.summarizedAt,
    blurred: row.blurred ?? 0,
    vaulted: row.vaulted ?? 0,
  };
}

/**
 * Options for persona-scoped history operations.
 */
export interface HistoryOptions {
  personaId?: number;
}

export interface AddHistoryOptions extends HistoryOptions {
  meterSnapshot?: string | null;
  /** JSON-serializable metadata (provider, model, tool, etc.) */
  metadata?: Record<string, unknown> | null;
}

/**
 * @description Retrieves conversation history entries in chronological order (oldest first)
 *
 * Fetches from most recent DESC, then reverses to get chronological order.
 * This is the main function for displaying history in the UI.
 *
 * @upstream Called by: /history endpoint, context building
 * @downstream Calls: Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @param limit - Maximum number of entries to retrieve
 * @param options - Optional settings
 * @returns History entries in chronological order
 */
export async function getHistory(
  db: DrizzleD1,
  limit = 50,
  options: HistoryOptions = {}
): Promise<HistoryEntry[]> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const results = await db.select()
    .from(history)
    .where(eq(history.personaId, personaId))
    .orderBy(desc(history.createdAt))
    .limit(limit)
    .all();

  return results.map(toHistoryEntry).reverse(); // chronological order
}

/**
 * @description Adds a new entry to the conversation history
 *
 * IMPORTANT: CONTENT ATTRIBUTION
 * =================================
 * It is CRITICAL to use the correct type to distinguish between:
 * - Content from the user (human-originated)
 * - Content from Claude (the AI)
 *
 * USER'S CONTENT (human-originated):
 * - 'user_message'   -> Messages user sends (text, with optional image in internal field)
 * - 'user_art'       -> Art user generates via /image command
 *
 * CLAUDE'S CONTENT (AI-originated):
 * - 'message_to_user' -> Messages Claude sends to the user
 * - 'thought'        -> Claude's private thoughts
 * - 'art_result'     -> Claude's generated art
 * - 'search_query'   -> Claude's web searches
 * - 'search_result'  -> Results from Claude's searches
 * - 'exist'          -> Claude's quiet existence moments
 * - 'curiosity'      -> Things Claude is wondering about
 * - 'cold_storage'   -> Memories Claude freezes
 * - 'note_saved'     -> Notes Claude saves
 *
 * @upstream Called by: All action handlers, message endpoints, cycle execution
 * @downstream Calls: Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @param type - The type of history entry (see attribution guide above)
 * @param content - The main content/message text
 * @param internal - Internal notes or reasoning, or image data URL for photos
 * @param cycleId - Optional ID of the parent cycle
 * @param options - Optional settings including meterSnapshot
 * @returns The ID of the inserted history entry
 *
 * @note D1 accepts null but NOT undefined - this function coalesces undefined to null
 */
export async function addHistory(
  db: DrizzleD1,
  type: string,
  content: string | null,
  internal: string | null = null,
  cycleId: number | null = null,
  options: AddHistoryOptions = {}
): Promise<{ id: number }> {
  const { meterSnapshot, metadata, ...restOptions } = options;
  const personaId = restOptions.personaId ?? await getActivePersonaId(db);

  // Serialize metadata to JSON string if provided
  const metadataJson = metadata ? JSON.stringify(metadata) : null;

  const result = await db.insert(history).values({
    personaId,
    type,
    content: content ?? null,
    internal: internal ?? null,
    cycleId: cycleId ?? null,
    meterSnapshot: meterSnapshot ?? null,
    metadata: metadataJson,
  }).returning({ id: history.id });

  return { id: result[0].id };
}

/**
 * @description Deletes the oldest history entries by count (hard delete)
 *
 * Use sparingly - prefer deleteHistoryByIds for soft delete.
 * Hard deletes are typically only used for emergency cleanup.
 *
 * @upstream Called by: Emergency cleanup, maintenance tasks
 * @downstream Calls: getActivePersonaId(), Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @param count - Number of oldest entries to delete
 * @param options - Optional settings
 */
export async function deleteOldestHistory(
  db: DrizzleD1,
  count: number,
  options: HistoryOptions = {}
): Promise<void> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  // Subquery to find oldest IDs, then delete them
  await db.run(sql`
    DELETE FROM history
    WHERE persona_id = ${personaId}
    AND id IN (
      SELECT id FROM history
      WHERE persona_id = ${personaId}
      ORDER BY created_at ASC
      LIMIT ${count}
    )
  `);
}

/**
 * @description Soft-deletes history entries by marking them as summarized
 *
 * Entries remain in DB for UI display but are excluded from Claude's context.
 * This is the preferred method for "deleting" history after summarization.
 *
 * @upstream Called by: Summarization process
 * @downstream Calls: Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @param ids - Array of history entry IDs to archive
 * @param options - Optional settings
 *
 * @note Empty array or null is handled gracefully (no-op)
 * @note Uses chunking for D1's 100 bound variable limit
 */
export async function deleteHistoryByIds(
  db: DrizzleD1,
  ids: number[] | null,
  options: HistoryOptions = {}
): Promise<void> {
  if (!ids || ids.length === 0) return;

  const personaId = options.personaId ?? await getActivePersonaId(db);

  // Cloudflare D1 has a limit of 100 bound variables per query
  const CHUNK_SIZE = 95;

  for (let chunkStart = 0; chunkStart < ids.length; chunkStart += CHUNK_SIZE) {
    const chunk = ids.slice(chunkStart, chunkStart + CHUNK_SIZE);
    await db.update(history)
      .set({ summarizedAt: sql`datetime('now')` })
      .where(and(
        eq(history.personaId, personaId),
        inArray(history.id, chunk)
      ));
  }
}

/**
 * @description Retrieves history entries that are still in Claude's context (not summarized)
 *
 * Used for building Claude's context window. Only returns entries without
 * a summarized_at timestamp, meaning they're still "active" in context.
 *
 * @upstream Called by: Context building for Claude API calls
 * @downstream Calls: Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @param limit - Maximum number of entries to retrieve
 * @param options - Optional settings
 * @returns History entries in chronological order
 */
export async function getHistoryForContext(
  db: DrizzleD1,
  limit = 50,
  options: HistoryOptions = {}
): Promise<HistoryEntry[]> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const results = await db.select()
    .from(history)
    .where(and(
      eq(history.personaId, personaId),
      isNull(history.summarizedAt)
    ))
    .orderBy(desc(history.createdAt))
    .limit(limit)
    .all();

  return results.map(toHistoryEntry).reverse(); // chronological order
}

/**
 * @description Retrieves the oldest history entries, primarily used for summarization
 *
 * Returns entries in chronological order (oldest first), filtered to only
 * include non-summarized entries. Used to select entries for summarization.
 *
 * @upstream Called by: Summarization process
 * @downstream Calls: Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @param limit - Maximum number of entries to retrieve
 * @param options - Optional settings
 * @returns History entries in oldest-first order
 */
export async function getOldestHistory(
  db: DrizzleD1,
  limit = 50,
  options: HistoryOptions = {}
): Promise<HistoryEntry[]> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const results = await db.select()
    .from(history)
    .where(and(
      eq(history.personaId, personaId),
      isNull(history.summarizedAt)
    ))
    .orderBy(asc(history.createdAt))
    .limit(limit)
    .all();

  return results.map(toHistoryEntry);
}

/**
 * @description Gets the total count of history entries in the database
 *
 * Includes both summarized and non-summarized entries. Used for
 * statistics display in the UI.
 *
 * @upstream Called by: /state endpoint, statistics display
 * @downstream Calls: Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @param options - Optional settings
 * @returns Number of active (unsummarized) history entries
 */
export async function getHistoryCount(
  db: DrizzleD1,
  options: HistoryOptions = {}
): Promise<number> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(history)
    .where(and(
      eq(history.personaId, personaId),
      isNull(history.summarizedAt)
    ))
    .get();

  return result?.count || 0;
}
