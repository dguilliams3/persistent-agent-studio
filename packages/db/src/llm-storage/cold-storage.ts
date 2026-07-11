/**
 * Cold storage database operations
 *
 * @module @persistence/db/memory/cold-storage
 * @description Database operations for permanent memories (cold storage).
 *
 * Cold storage survives summarization - these are facts Claude deemed important
 * enough to "freeze" permanently. Unlike regular history entries that get
 * summarized and archived, cold storage entries persist in full in the context.
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/cold-storage.js - API endpoint handlers
 *   - platforms/cloudflare/src/index.js - Context building, COLD_STORAGE action
 * @downstream Calls:
 *   - Drizzle query builder
 *   - @persistence/db/persona-scope - getActivePersonaId
 */

import { eq, asc } from 'drizzle-orm';
import type { DrizzleD1 } from '../client';
import { getActivePersonaId } from '../persona-scope';
import { coldStorage } from '../schema/cold-storage';
import type { ColdStorageEntry } from './ColdStorageEntry';

interface ColdStorageOptions {
  personaId?: number;
}

/**
 * Maps a Drizzle row (camelCase properties) to the snake_case
 * ColdStorageEntry contract. The query-builder migration changed row
 * property names; the cast below hid it and consumers read undefined
 * created_at. See packages/db/src/history.ts toHistoryEntry for the
 * full account.
 */
export function toColdStorageEntry(row: typeof coldStorage.$inferSelect): ColdStorageEntry {
  return {
    id: row.id,
    content: row.content,
    reason: row.reason ?? '',
    created_at: row.createdAt ?? '',
  };
}

/**
 * @description Retrieves all cold storage entries (permanent memories)
 *
 * @param db - Drizzle D1 client
 * @param options - Optional settings (personaId for persona scoping)
 * @returns Array of cold storage entries
 */
export async function getColdStorage(db: DrizzleD1, options: ColdStorageOptions = {}): Promise<ColdStorageEntry[]> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const results = await db.select()
    .from(coldStorage)
    .where(eq(coldStorage.personaId, personaId))
    .orderBy(asc(coldStorage.createdAt))
    .all();

  return results.map(toColdStorageEntry);
}

/**
 * @description Adds a new entry to cold storage (permanent memory)
 *
 * @param db - Drizzle D1 client
 * @param content - The memory/fact to preserve permanently
 * @param reason - Why this memory is important enough to freeze
 * @param options - Optional settings (personaId for persona scoping)
 */
export async function addColdStorage(
  db: DrizzleD1,
  content: string,
  reason: string,
  options: ColdStorageOptions = {}
): Promise<void> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  await db.insert(coldStorage).values({
    personaId,
    content: content ?? '',
    reason: reason ?? null,
  });
}
