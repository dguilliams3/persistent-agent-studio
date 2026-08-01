/**
 * Persona-scoped query builders — auto-inject persona_id filtering into Drizzle queries.
 *
 * @module @persistence/db/scoped-query
 * @description Provides scopedSelect(), scopedUpdate(), and scopedDelete() that wrap
 *   Drizzle query builders with automatic persona_id filtering. This eliminates the
 *   repeated pattern of `const personaId = await getActivePersonaId(db)` followed by
 *   manual `eq(table.personaId, personaId)` in every WHERE clause.
 *
 *   The persona filter is ALWAYS applied and cannot be forgotten or bypassed.
 *   Additional caller conditions are AND-ed with the persona filter.
 *
 *   NOTE: The state table has a personaId column but uses it as a composite primary key,
 *   not as an auto-filter dimension. Do NOT use scoped helpers for state queries —
 *   use db.select()/update()/delete() directly with explicit personaId conditions.
 *
 * @antipattern DO NOT use db.select().from(personaScopedTable) directly — use
 *   scopedSelect() to ensure persona isolation. Direct db.select() is only appropriate
 *   for non-persona tables (config, personas, state).
 *
 * @upstream Called by: all db modules performing SELECT/UPDATE/DELETE on persona-scoped tables
 * @downstream Calls: getActivePersonaId() from ./persona-scope, Drizzle query builder
 * @pattern scoped-query — persona filtering as a composable query builder wrapper
 * @tested_by packages/db/src/scoped-query.test.ts
 *
 * @example
 * // SELECT with additional conditions
 * const results = await scopedSelect(db, summaries)
 *   .where(isNull(summaries.archivedAt))
 *   .orderBy(desc(summaries.createdAt))
 *   .limit(10)
 *   .all();
 *
 * // SELECT with no additional conditions (just persona filter)
 * const allForPersona = await scopedSelect(db, notebook).all();
 *
 * // UPDATE with persona scoping
 * await scopedUpdate(db, reminders)
 *   .set({ dismissedAt: sql`datetime('now')` })
 *   .where(eq(reminders.id, reminderId));
 *
 * // DELETE with persona scoping
 * await scopedDelete(db, history)
 *   .where(eq(history.id, entryId));
 */

import { eq, and, type SQL } from 'drizzle-orm';
import type { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import type { DrizzleD1 } from './client';
import { getActivePersonaId } from './persona-scope';

/**
 * Type guard: asserts that a table has a `personaId` column.
 * Tables without personaId (config, personas, state) should use db.select() directly.
 */
function assertHasPersonaId(
  table: SQLiteTableWithColumns<any>
): asserts table is SQLiteTableWithColumns<any> & { personaId: any } {
  if (!('personaId' in table)) {
    throw new Error(
      `Table does not have a personaId column — use db.select()/update()/delete() directly. ` +
      `scopedSelect/scopedUpdate/scopedDelete are only for persona-scoped tables.`
    );
  }
}

/**
 * Merges the persona filter with an optional caller-provided WHERE condition.
 * Always returns `and(personaFilter, callerCondition)` when both exist,
 * or just the persona filter when no caller condition is provided.
 */
function mergeWithPersonaFilter(
  personaFilter: SQL,
  callerCondition?: SQL | undefined
): SQL {
  if (callerCondition) {
    return and(personaFilter, callerCondition)!;
  }
  return personaFilter;
}

// =============================================================================
// scopedSelect
// =============================================================================

/**
 * Create a persona-scoped SELECT query builder.
 * Automatically adds `WHERE persona_id = <active persona>` filtering.
 * The persona filter is always applied — callers chain `.where()` for additional conditions.
 *
 * @antipattern DO NOT use db.select().from(personaScopedTable) directly —
 *   use scopedSelect() to ensure persona isolation. Direct db.select() is
 *   only for non-persona tables (config, personas, state).
 *
 * @param database - Drizzle D1 client
 * @param table - A persona-scoped table reference (must have personaId column)
 * @returns A scoped query builder with .where(), .orderBy(), .limit(), .offset(), .all(), .get()
 */
export async function scopedSelect<TTable extends SQLiteTableWithColumns<any>>(
  database: DrizzleD1,
  table: TTable,
) {
  assertHasPersonaId(table);
  const personaId = await getActivePersonaId(database);
  const personaFilter = eq((table as any).personaId, personaId);

  return {
    /**
     * Add additional WHERE conditions (AND-ed with persona filter).
     * Returns a standard Drizzle query builder for further chaining
     * (.orderBy(), .limit(), .offset(), .all(), .get(), etc.).
     */
    where(condition: SQL | undefined) {
      return database.select().from(table).where(mergeWithPersonaFilter(personaFilter, condition));
    },

    /** Execute with only the persona filter — returns all matching rows. */
    all() {
      return database.select().from(table).where(personaFilter).all();
    },

    /** Execute with only the persona filter — returns first matching row or undefined. */
    get() {
      return database.select().from(table).where(personaFilter).get();
    },

    /** Apply orderBy with persona filter, then chain further. */
    orderBy(...columns: any[]) {
      return database.select().from(table).where(personaFilter).orderBy(...columns);
    },

    /** Apply limit with persona filter, then chain further. */
    limit(count: number) {
      return database.select().from(table).where(personaFilter).limit(count);
    },

    /** Apply offset with persona filter, then chain further. */
    offset(count: number) {
      return database.select().from(table).where(personaFilter).offset(count);
    },
  };
}

// =============================================================================
// scopedUpdate
// =============================================================================

/**
 * Create a persona-scoped UPDATE query builder.
 * Automatically adds `WHERE persona_id = <active persona>` filtering to the SET operation.
 * The persona filter is always applied — callers provide .set() and optional .where() conditions.
 *
 * @antipattern DO NOT use db.update(personaScopedTable) directly —
 *   use scopedUpdate() to ensure persona isolation. Direct db.update() is
 *   only for non-persona tables (config, personas, state).
 *
 * @param database - Drizzle D1 client
 * @param table - A persona-scoped table reference (must have personaId column)
 * @returns A scoped update builder with .set() that returns a chainable query builder
 */
export async function scopedUpdate<TTable extends SQLiteTableWithColumns<any>>(
  database: DrizzleD1,
  table: TTable,
) {
  assertHasPersonaId(table);
  const personaId = await getActivePersonaId(database);
  const personaFilter = eq((table as any).personaId, personaId);

  return {
    /**
     * Set the columns to update. Returns a builder with .where() for additional conditions.
     */
    set(values: Record<string, unknown>) {
      const setQuery = database.update(table).set(values as any);
      return {
        /** Add additional WHERE conditions (AND-ed with persona filter). */
        where(condition: SQL | undefined) {
          return setQuery.where(mergeWithPersonaFilter(personaFilter, condition));
        },
        /** Execute with only the persona filter — updates all rows for active persona. */
        run() {
          return setQuery.where(personaFilter).run();
        },
        /** Execute and return modified rows (if supported). */
        returning() {
          return setQuery.where(personaFilter).returning();
        },
      };
    },
  };
}

// =============================================================================
// scopedDelete
// =============================================================================

/**
 * Create a persona-scoped DELETE query builder.
 * Automatically adds `WHERE persona_id = <active persona>` filtering.
 * The persona filter is always applied — callers chain .where() for additional conditions.
 *
 * @antipattern DO NOT use db.delete(personaScopedTable) directly —
 *   use scopedDelete() to ensure persona isolation. Direct db.delete() is
 *   only for non-persona tables (config, personas, state).
 *
 * @param database - Drizzle D1 client
 * @param table - A persona-scoped table reference (must have personaId column)
 * @returns A scoped delete builder with .where(), .run(), .returning()
 */
export async function scopedDelete<TTable extends SQLiteTableWithColumns<any>>(
  database: DrizzleD1,
  table: TTable,
) {
  assertHasPersonaId(table);
  const personaId = await getActivePersonaId(database);
  const personaFilter = eq((table as any).personaId, personaId);

  return {
    /** Add additional WHERE conditions (AND-ed with persona filter). */
    where(condition: SQL | undefined) {
      return database.delete(table).where(mergeWithPersonaFilter(personaFilter, condition));
    },

    /** Execute with only the persona filter — deletes all rows for active persona. */
    run() {
      return database.delete(table).where(personaFilter).run();
    },

    /** Execute and return deleted rows. */
    returning() {
      return database.delete(table).where(personaFilter).returning();
    },
  };
}
