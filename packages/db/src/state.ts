/**
 * State table database operations
 *
 * The state table stores key-value pairs for persistent configuration
 * and runtime state (loop_count, is_running, interval, model, etc.)
 *
 * State table has composite PK (key, persona_id) for multi-persona support.
 *
 * @module @persistence/db/state
 */

import { eq, sql, and } from 'drizzle-orm';
import type { DrizzleD1 } from './client';
import { getActivePersonaId } from './persona-scope';
import { state } from './schema/state';

/**
 * Options for persona-scoped state operations.
 * Mirrors the subset of PersonaOptions used by state functions.
 */
export interface StateOptions {
  personaId?: number;
}

/**
 * @description Retrieves a value from the state table by key
 *
 * Common keys: loop_count, is_running, cycle_interval_seconds, model,
 * max_completion_tokens, streaming_enabled, sleep_mode, user_status, etc.
 *
 * @upstream Called by: Most route handlers and the main cron trigger
 * @downstream Calls: getActivePersonaId() for persona resolution, Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @param key - The key to look up in the state table
 * @param options - Optional settings
 * @returns The value associated with the key, or undefined if not found
 *
 * @note Uses persona scoping via getActivePersonaId — state table has composite PK (key, persona_id)
 */
export async function getState(
  db: DrizzleD1,
  key: string,
  options: StateOptions = {}
): Promise<string | undefined> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const result = await db.select({ value: state.value })
    .from(state)
    .where(and(
      eq(state.key, key),
      eq(state.personaId, personaId)
    ))
    .get();
  return result?.value ?? undefined;
}

/**
 * @description Sets or updates a value in the state table with automatic timestamp
 *
 * Uses INSERT ... ON CONFLICT for upsert behavior with composite PK (key, persona_id).
 * Automatically sets updated_at to current timestamp for tracking when values change.
 *
 * @upstream Called by: Route handlers for /state POST, cron trigger, control endpoints
 * @downstream Calls: getActivePersonaId() for persona resolution, Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @param key - The key to set in the state table
 * @param value - The value to store (null is valid, undefined is coerced to null)
 * @param options - Optional settings
 *
 * @note D1 accepts null but NOT undefined - this function coalesces undefined to null
 * @note Uses persona scoping via getActivePersonaId - state table has composite PK (key, persona_id)
 * @antipattern Don't pass undefined directly - always use ?? null pattern
 */
export async function setState(
  db: DrizzleD1,
  key: string,
  value: string | null | undefined,
  options: StateOptions = {}
): Promise<void> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  // State table has composite PK (key, persona_id) — use Drizzle onConflictDoUpdate
  await db.insert(state).values({
    key,
    personaId,
    value: value ?? null,
    updatedAt: sql`datetime('now')`,
  }).onConflictDoUpdate({
    target: [state.key, state.personaId],
    set: {
      value: value ?? null,
      updatedAt: sql`datetime('now')`,
    },
  });
}
