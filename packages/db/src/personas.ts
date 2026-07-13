/**
 * Persona management CRUD operations
 *
 * @module @persistence/db/personas
 * @description Multi-persona CRUD operations using Drizzle query builder.
 *   Provides persona creation, listing, forking, and activation.
 *
 * Tables touched:
 * - `config` - stores the active persona id under `active_persona_id`
 * - `personas` - metadata for each persona (name, slug, template, etc.)
 * - `state` - per-persona state key-value pairs
 * - Various content tables during fork operations (history, cold_storage,
 *   notebook, learned, questions, observations, summaries, reminders,
 *   pinned_images)
 *
 * @upstream Called by:
 *   - routes/personas.js - Persona CRUD and activation endpoints
 *   - telegram/commands/persona - Persona management commands
 * @downstream Calls:
 *   - Drizzle query builder
 *   - persona-scope.ts for getActivePersonaId / resetPersonaCache
 * @pattern persona-scoped-writes — every INSERT/UPDATE during fork uses
 *   explicit targetId so data never leaks across persona boundaries
 * @antipattern DO NOT use raw db.prepare() SQL — use Drizzle query builder
 *   from @persistence/db/client (see ARCHITECTURE_CONSTRAINTS §4)
 * @invariant All fork copies preserve original persona_id in source;
 *   new rows receive targetId — the source persona is never mutated
 */

import { eq, and, isNull, asc, sql } from 'drizzle-orm';
import type { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core';
import type { DrizzleD1 } from './client';
import type { Persona } from './schema/index';
import { getActivePersonaId, resetPersonaCache } from './persona-scope';
import { config } from './schema/config';
import { personas } from './schema/personas';
import { history } from './schema/history';
import { coldStorage } from './schema/cold-storage';
import { notebook } from './schema/notebook';
import { learned } from './schema/learned';
import { questions } from './schema/questions';
import { observations } from './schema/observations';
import { summaries } from './schema/summaries';
import { reminders } from './schema/reminders';
import { pinnedImages } from './schema/pinned-images';
import { state } from './schema/state';

// Re-export from persona-scope
export { getActivePersonaId, resetPersonaCache };

export interface PersonaOptions {
  personaId?: number;
  bypassCache?: boolean;
  disableAutoScope?: boolean;
  tableAlias?: string;
}

/**
 * Database row shape for a persona — derived from Drizzle schema.
 *
 * This is the storage-level type. For config-level, see PersonaConfig
 * in @persistence/core. For runtime-assembled context, see PersonaContext
 * in @persistence/runtime.
 */
export type PersonaRecord = Persona;

const ACTIVE_PERSONA_KEY = 'active_persona_id';

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

/**
 * @description Updates the active persona id and clears the cache
 *
 * @upstream Called by: routes/personas.js handleActivatePersona
 * @downstream Calls: Drizzle config upsert, resetPersonaCache
 */
export async function setActivePersonaId(db: DrizzleD1, personaId: number): Promise<void> {
  const normalized = normalizePersona(personaId);
  if (!normalized) {
    throw new Error('personaId must be a positive integer');
  }

  await db.insert(config).values({
    key: ACTIVE_PERSONA_KEY,
    value: String(normalized),
    updatedAt: sql`datetime('now')`,
  }).onConflictDoUpdate({
    target: config.key,
    set: {
      value: String(normalized),
      updatedAt: sql`datetime('now')`,
    },
  });

  resetPersonaCache();
}

/**
 * @description Retrieves a single persona record by id
 *
 * @upstream Called by: routes/personas.js handlers, handleActivatePersona validation
 * @downstream Calls: Drizzle personas query
 */
export async function getPersona(
  db: DrizzleD1,
  personaId: number
): Promise<PersonaRecord | null> {
  const normalized = normalizePersona(personaId);
  if (!normalized) {
    return null;
  }

  const result = await db.select()
    .from(personas)
    .where(eq(personas.id, normalized))
    .get();

  return result ?? null;
}

/**
 * @description Lists personas, optionally including archived rows
 *
 * @upstream Called by: routes/personas.js handleListPersonas
 * @downstream Calls: Drizzle personas query
 */
export async function listPersonas(
  db: DrizzleD1,
  includeArchived = false
): Promise<PersonaRecord[]> {
  const whereCondition = includeArchived
    ? undefined
    : isNull(personas.archivedAt);

  const results = whereCondition
    ? await db.select().from(personas).where(whereCondition).orderBy(asc(personas.id)).all()
    : await db.select().from(personas).orderBy(asc(personas.id)).all();

  return results;
}

/**
 * @description Derives a URL-safe persona slug from a display name.
 *
 * THE canonical slug rule — extracted so every mint lane produces identical
 * slugs for identical names (the web lane sent no slug and 400'd on a
 * contract other lanes satisfied by deriving — one rule, one function,
 * every door).
 *
 * Returns '' when the name contains no alphanumerics (e.g. "!!!") — callers
 * must treat '' as underivable and reject with a clear error.
 *
 * @upstream Called by: createPersona (below), handlers/personas.ts
 *   handleCreatePersona
 * Tests: packages/db/src/handlers/personas.create.test.ts
 */
export function derivePersonaSlug(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * @description Creates a new persona with the given name
 *
 * @upstream Called by: handlers/personas.ts handleCreatePersona
 * @downstream Calls: Drizzle personas insert
 *
 * @param db - Drizzle D1 client
 * @param name - Display name for the persona
 * @param slug - Optional URL-safe slug (auto-generated from name if not provided)
 * @returns The new persona's ID
 */
export async function createPersona(
  db: DrizzleD1,
  name: string,
  slug?: string
): Promise<number> {
  if (!name || typeof name !== 'string') {
    throw new Error('Persona name is required');
  }

  const finalSlug = slug || derivePersonaSlug(name);
  const now = new Date().toISOString();

  const result = await db.insert(personas).values({
    name,
    slug: finalSlug,
    createdAt: now,
    updatedAt: now,
  }).returning({ id: personas.id });

  return result[0].id;
}

// ============================================================================
// PERSONA FORKING
// ============================================================================

/**
 * Derives the copyable column names from a Drizzle table definition.
 * Returns all camelCase property names except 'id' and 'personaId',
 * which are auto-handled during fork (id is auto-increment, personaId
 * is set to the target persona).
 *
 * @antipattern DO NOT hand-maintain column lists for fork configs —
 *   use this function. Hand-maintained lists silently lose data when
 *   schema columns are added.
 *
 * @private
 */
function getDataColumns(table: SQLiteTableWithColumns<any>): string[] {
  return Object.keys(table).filter(
    column => column !== 'id' && column !== 'personaId'
  );
}

/**
 * Tables to copy during persona fork. Column lists are derived from the
 * Drizzle schema definitions — when a column is added to a schema file,
 * it is automatically included in fork copies.
 *
 * @invariant Every persona-scoped content table must appear here
 * @private
 */
const COPY_TABLE_CONFIGS = [
  { name: 'history', table: history, columns: getDataColumns(history) },
  { name: 'cold_storage', table: coldStorage, columns: getDataColumns(coldStorage) },
  { name: 'notebook', table: notebook, columns: getDataColumns(notebook) },
  { name: 'learned', table: learned, columns: getDataColumns(learned) },
  { name: 'questions', table: questions, columns: getDataColumns(questions) },
  { name: 'observations', table: observations, columns: getDataColumns(observations) },
  { name: 'summaries', table: summaries, columns: getDataColumns(summaries) },
  { name: 'reminders', table: reminders, columns: getDataColumns(reminders) },
];

/**
 * State keys to copy (settings that define persona behavior, not transient state)
 * @private
 */
const COPY_STATE_KEYS: string[] = [
  'model', 'summarize_provider', 'summarize_model', 'tts_model',
  'cycle_interval_seconds', 'clio_status'
];

/**
 * Options for forkPersona operation
 */
export interface ForkPersonaOptions {
  /** Days of history to copy (default 90) */
  historyDays?: number;
}

/**
 * Result of a successful fork operation
 */
export interface ForkPersonaResult {
  success: true;
  newPersonaId: number;
  persona: PersonaRecord;
  copiedRecords: Record<string, number>;
  stats: {
    totalRecords: number;
    copyTimeMs: number;
  };
}

/**
 * Result of a failed fork operation
 */
export interface ForkPersonaError {
  success: false;
  error: string;
  code: 'PERSONA_NOT_FOUND' | 'NAME_CONFLICT' | 'COPY_FAILED';
  partialPersonaId?: number;
}

/**
 * @description Fork a persona with all its memories
 *
 * Creates a new persona and copies all knowledge data from the source.
 * Uses "Smart Copy" strategy — copies memories/knowledge, skips transient/large data.
 *
 * Tables copied: history (last N days), cold_storage, notebook, learned, questions,
 * observations, summaries (including tier/sortPosition columns), reminders
 * (including dismissedAt), pinned_images, and selected state keys.
 *
 * @param db - Drizzle D1 client
 * @param sourcePersonaId - Persona to fork from
 * @param newName - Name for the new persona
 * @param options - Fork options (historyDays defaults to 90)
 * @returns Result object with success status and copied record counts
 *
 * @upstream Called by: telegram/commands/persona fork handler, routes/personas.js
 * @downstream Calls: copyTableDrizzle, copyPinnedImagesDrizzle, copyStateKeysDrizzle
 * @pattern fork-then-archive-on-failure — new persona is created first, then data is
 *   copied; on any copy error the new persona is archived (not deleted) preserving
 *   the append-only guarantee; partialPersonaId is returned so callers can clean up
 * @antipattern DO NOT call this for small persona "resets" — fork is expensive
 *   (copies every history entry up to historyDays). For identity resets, update
 *   system_context on the existing persona instead.
 * @invariant Source persona is never modified — all writes target newPersonaId
 */
export async function forkPersona(
  db: DrizzleD1,
  sourcePersonaId: number,
  newName: string,
  options: ForkPersonaOptions = {}
): Promise<ForkPersonaResult | ForkPersonaError> {
  const startTime = Date.now();
  const historyDays = options.historyDays ?? 90;

  // 1. Validate source exists
  const sourcePersona = await getPersona(db, sourcePersonaId);
  if (!sourcePersona) {
    return { success: false, error: 'Source persona not found', code: 'PERSONA_NOT_FOUND' };
  }

  // 2. Check name uniqueness
  const existing = await listPersonas(db, true);
  if (existing.some(personaRecord => personaRecord.name.toLowerCase() === newName.toLowerCase())) {
    return { success: false, error: `Persona "${newName}" already exists`, code: 'NAME_CONFLICT' };
  }

  // 3. Create new persona entry
  const slugValue = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const now = new Date().toISOString();
  const template = sourcePersona.systemPromptTemplate || 'clio-v1';

  const insertResult = await db.insert(personas).values({
    name: newName,
    slug: slugValue,
    systemPromptTemplate: template,
    forkedFromId: sourcePersonaId,
    createdAt: now,
    updatedAt: now,
  }).returning({ id: personas.id });

  const newPersonaId = insertResult[0].id;

  // 4. Copy tables
  const copiedRecords: Record<string, number> = {};

  try {
    for (const tableConfig of COPY_TABLE_CONFIGS) {
      const count = await copyTableDrizzle(
        db, tableConfig.name, sourcePersonaId, newPersonaId,
        tableConfig.name === 'history' ? historyDays : undefined
      );
      copiedRecords[tableConfig.name] = count;
    }

    // Copy pinned images
    copiedRecords.pinned_images = await copyPinnedImagesDrizzle(db, sourcePersonaId, newPersonaId);

    // Copy selected state keys
    copiedRecords.state_keys = await copyStateKeysDrizzle(db, sourcePersonaId, newPersonaId);

  } catch (error) {
    // Mark persona as archived on failure
    await db.update(personas)
      .set({ archivedAt: now, updatedAt: now })
      .where(eq(personas.id, newPersonaId));

    return {
      success: false,
      error: `Fork failed during copy: ${(error as Error).message}`,
      code: 'COPY_FAILED',
      partialPersonaId: newPersonaId
    };
  }

  // 5. Get created persona
  const newPersona = await getPersona(db, newPersonaId);

  // 6. Calculate stats
  const totalRecords = Object.values(copiedRecords).reduce((accumulated, count) => accumulated + count, 0);
  const copyTimeMs = Date.now() - startTime;

  return {
    success: true,
    newPersonaId,
    persona: newPersona!,
    copiedRecords,
    stats: {
      totalRecords,
      copyTimeMs
    }
  };
}

/**
 * @description Copy a table from source to target persona using Drizzle sql template.
 *   Fork uses dynamic table/column names, so we use sql.raw() for identifiers
 *   and sql template interpolation for values (parameterized).
 *
 * @private
 */
async function copyTableDrizzle(
  db: DrizzleD1,
  tableName: string,
  sourceId: number,
  targetId: number,
  historyDays?: number
): Promise<number> {
  const tableConfig = COPY_TABLE_CONFIGS.find(tableConfiguration => tableConfiguration.name === tableName);
  if (!tableConfig) return 0;

  // Map camelCase Drizzle column names to snake_case SQL column names
  const sqlColumns = (tableConfig.columns as readonly string[]).map(camelToSnake);

  // Build date filter for history
  const dateFilter = (historyDays && tableName === 'history')
    ? sql.raw(` AND created_at > datetime('now', '-${historyDays} days')`)
    : sql.raw('');

  // Read source rows
  const sourceRows = await db.all(sql`
    SELECT ${sql.raw(sqlColumns.join(', '))}
    FROM ${sql.raw(tableName)}
    WHERE persona_id = ${sourceId} ${dateFilter}
    ORDER BY id ASC
  `);

  if (!sourceRows || sourceRows.length === 0) {
    return 0;
  }

  let count = 0;
  const allColumnsRaw = sql.raw(['persona_id', ...sqlColumns].join(', '));

  for (const row of sourceRows) {
    const rowRecord = row as Record<string, unknown>;
    const rowValues: unknown[] = sqlColumns.map(col => rowRecord[col] ?? null);

    // Handle notebook title uniqueness
    if (tableName === 'notebook') {
      const titleIdx = sqlColumns.indexOf('title');
      if (titleIdx !== -1 && rowValues[titleIdx]) {
        rowValues[titleIdx] = `${rowValues[titleIdx]} (Fork #${targetId})`;
      }
    }

    try {
      // Build INSERT with sql template — values are parameterized via interpolation
      const valueParts = [sql`${targetId}`, ...rowValues.map(value => sql`${value}`)];
      const valuesClause = sql.join(valueParts, sql.raw(', '));
      await db.run(sql`
        INSERT INTO ${sql.raw(tableName)} (${allColumnsRaw})
        VALUES (${valuesClause})
      `);
      count++;
    } catch (err) {
      if ((err as Error).message?.includes('UNIQUE constraint')) {
        console.warn(`[Fork] Skipping duplicate in ${tableName}: ${(err as Error).message}`);
        continue;
      }
      throw err;
    }
  }

  return count;
}

/**
 * @description Copy pinned images from source to target persona
 * @private
 */
async function copyPinnedImagesDrizzle(
  db: DrizzleD1,
  sourceId: number,
  targetId: number
): Promise<number> {
  const rows = await db.select({
    slot: pinnedImages.slot,
    imageId: pinnedImages.imageId,
  })
    .from(pinnedImages)
    .where(eq(pinnedImages.personaId, sourceId))
    .all();

  if (rows.length === 0) return 0;

  for (const row of rows) {
    await db.insert(pinnedImages).values({
      personaId: targetId,
      slot: row.slot,
      imageId: row.imageId,
      pinnedAt: sql`datetime('now')`,
    });
  }

  return rows.length;
}

/**
 * @description Copy selected state keys from source to target persona
 * @private
 */
async function copyStateKeysDrizzle(
  db: DrizzleD1,
  sourceId: number,
  targetId: number
): Promise<number> {
  let count = 0;

  for (const key of COPY_STATE_KEYS) {
    const row = await db.select({ value: state.value })
      .from(state)
      .where(and(eq(state.personaId, sourceId), eq(state.key, key)))
      .get();

    if (row) {
      await db.insert(state).values({
        personaId: targetId,
        key,
        value: row.value,
        updatedAt: sql`datetime('now')`,
      }).onConflictDoUpdate({
        target: [state.key, state.personaId],
        set: {
          value: row.value,
          updatedAt: sql`datetime('now')`,
        },
      });
      count++;
    }
  }

  return count;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * @description Converts camelCase to snake_case for SQL column names
 * @private
 */
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}
