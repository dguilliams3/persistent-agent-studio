/**
 * Drizzle-native persona scope helpers
 *
 * @module @persistence/db/persona-scope
 * @description Replaces the regex-based scopeSqlToPersona() system with typed
 *   Drizzle query builder persona filtering. Provides getActivePersonaId() with
 *   the same caching semantics as the original in personas.ts.
 *
 * @upstream Called by: scoped-query.ts (scopedSelect/scopedUpdate/scopedDelete), and all db
 *   modules that need persona-scoped queries directly
 * @downstream Calls: Drizzle query builder on config table and personas table
 * @pattern caching — 5-second TTL cache for active persona id
 */
import { eq, isNull, sql } from 'drizzle-orm';
import type { DrizzleD1 } from './client';
import { config } from './schema/config';
import { personas } from './schema/personas';

const ACTIVE_PERSONA_KEY = 'active_persona_id';
const PERSONA_CACHE_TTL_MS = 5000;
let cachedPersonaId: number | null = null;
let personaCacheExpiresAt = 0;

/**
 * @description Fetches the active persona id with a short-lived cache.
 *   Mirrors the semantics of the original getActivePersonaId in personas.ts
 *   but uses the Drizzle query builder instead of raw SQL.
 *
 * @upstream Called by: scoped-query.ts (scopedSelect/scopedUpdate/scopedDelete), and any
 *   db module that needs the active persona id for manual Drizzle query construction
 * @downstream Calls: Drizzle query builder on config table; falls back to personas table
 * @pattern caching — 5-second TTL avoids repeated DB round-trips per request
 * @antipattern DO NOT call this and then build raw `.where(eq(table.personaId, id))` manually —
 *   use scopedSelect/scopedUpdate/scopedDelete from ./scoped-query which handle this automatically
 * @tested_by packages/db/src/scoped-query.test.ts (mocked as the entry point for scoped-query tests)
 *
 * @param db - Drizzle D1 client
 * @returns Active persona id (defaults to 1 if not configured)
 */
export async function getActivePersonaId(db: DrizzleD1): Promise<number> {
  const now = Date.now();
  if (cachedPersonaId && now < personaCacheExpiresAt) {
    return cachedPersonaId;
  }

  const row = await db.select({ value: config.value })
    .from(config)
    .where(eq(config.key, ACTIVE_PERSONA_KEY))
    .get();

  let personaId = normalizePersona(row?.value);

  if (!personaId) {
    const fallback = await db.select({ id: personas.id })
      .from(personas)
      .where(isNull(personas.archivedAt))
      .orderBy(personas.id)
      .limit(1)
      .get();

    personaId = normalizePersona(fallback?.id) || 1;

    await db.insert(config).values({
      key: ACTIVE_PERSONA_KEY,
      value: String(personaId),
      updatedAt: sql`datetime('now')`,
    }).onConflictDoUpdate({
      target: config.key,
      set: {
        value: String(personaId),
        updatedAt: sql`datetime('now')`,
      },
    });
  }

  cachedPersonaId = personaId;
  personaCacheExpiresAt = now + PERSONA_CACHE_TTL_MS;
  return personaId;
}

/**
 * @description Resets the persona cache, forcing the next call to
 *   getActivePersonaId to re-query the database.
 *
 * @upstream Called by: persona switch handlers and test setup (beforeEach) when the
 *   active persona is changed and the cache must be invalidated
 * @downstream Calls: nothing — mutates module-level cache variables only
 * @pattern cache-invalidation — pair with persona switch writes to keep cache coherent
 */
export function resetPersonaCache(): void {
  cachedPersonaId = null;
  personaCacheExpiresAt = 0;
}

/**
 * @description Normalizes persona id input (numbers, strings) into positive integers
 */
function normalizePersona(personaId: number | string | null | undefined): number | null {
  const parsed = Number(personaId);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}
