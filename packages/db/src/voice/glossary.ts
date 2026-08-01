/**
 * STT Glossary management for transcription correction
 *
 * @module @persistence/db/voice/glossary
 * @description CRUD operations for the STT glossary table. The glossary stores
 * wrong->correct mappings for speech-to-text corrections.
 *
 * Used in two ways:
 * 1. **Prompt priming**: buildGlossaryPrompt() generates initial_prompt for WhisperX
 * 2. **Post-processing**: applyGlossaryCorrections() replaces mistranscriptions after STT
 *
 * @upstream Called by:
 *   - Platform routes/glossary.js - REST API endpoints
 *   - Platform telegram/commands/glossary.js - /glossary command
 *   - Platform telegram/commands/voice.js - Voice message processing
 * @downstream Calls:
 *   - Drizzle query builder
 *   - @persistence/db/persona-scope - getActivePersonaId
 */

import { eq, and, asc, sql } from 'drizzle-orm';
import type { DrizzleD1 } from '../client';
import { getActivePersonaId } from '../persona-scope';
import { glossary } from '../schema/glossary';

import type { GlossaryEntryRow } from './GlossaryEntryRow.js';
import type { GlossaryFilterOptions } from './GlossaryFilterOptions.js';
import type { GlossaryEntryUpdate } from './GlossaryEntryUpdate.js';

// Re-export types for convenience
export type { GlossaryEntryRow } from './GlossaryEntryRow.js';
export type { GlossaryFilterOptions } from './GlossaryFilterOptions.js';
export type { GlossaryEntryInput } from './GlossaryEntryInput.js';
export type { GlossaryEntryUpdate } from './GlossaryEntryUpdate.js';

interface GlossaryOptions {
  personaId?: number;
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * @description Add a new glossary entry for STT correction.
 *
 * @param db - Drizzle D1 client
 * @param wrongForm - What STT typically outputs incorrectly
 * @param correctForm - What it should be corrected to
 * @param category - Category: 'name', 'term', or 'phrase'. Defaults to 'name'
 * @param options - Optional persona settings
 * @returns The created entry with id
 */
export async function addGlossaryEntry(
  db: DrizzleD1,
  wrongForm: string,
  correctForm: string,
  category: string = 'name',
  options: GlossaryOptions = {}
): Promise<GlossaryEntryRow> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const result = await db.insert(glossary).values({
    personaId,
    wrongForm,
    correctForm,
    category: category ?? 'name',
  }).returning({ id: glossary.id });

  return {
    id: result[0].id,
    persona_id: personaId,
    wrong_form: wrongForm,
    correct_form: correctForm,
    category: category ?? 'name',
    use_in_prompt: 1,
    use_in_replace: 1,
  };
}

/**
 * @description Get all glossary entries with optional filtering.
 *
 * @param db - Drizzle D1 client
 * @param options - Filter and persona options
 * @returns Array of glossary entries
 */
export async function getGlossaryEntries(
  db: DrizzleD1,
  options: GlossaryFilterOptions = {}
): Promise<GlossaryEntryRow[]> {
  const personaId = options.personaId ?? await getActivePersonaId(db);

  const conditions = [eq(glossary.personaId, personaId)];

  if (options.forPrompt) {
    conditions.push(eq(glossary.useInPrompt, 1));
  }
  if (options.forReplace) {
    conditions.push(eq(glossary.useInReplace, 1));
  }

  const results = await db.select()
    .from(glossary)
    .where(and(...conditions))
    .orderBy(asc(glossary.category), asc(glossary.wrongForm))
    .all();

  // Map Drizzle rows to GlossaryEntryRow interface (snake_case)
  return results.map(row => ({
    id: row.id,
    persona_id: row.personaId,
    wrong_form: row.wrongForm,
    correct_form: row.correctForm,
    category: row.category ?? 'name',
    use_in_prompt: row.useInPrompt ?? 1,
    use_in_replace: row.useInReplace ?? 1,
  }));
}

/**
 * @description Get a single glossary entry by ID.
 *
 * @param db - Drizzle D1 client
 * @param id - Entry ID
 * @param options - Optional persona settings
 * @returns The entry or null if not found
 */
export async function getGlossaryEntry(
  db: DrizzleD1,
  id: number,
  options: GlossaryOptions = {}
): Promise<GlossaryEntryRow | null> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const result = await db.select()
    .from(glossary)
    .where(and(eq(glossary.personaId, personaId), eq(glossary.id, id)))
    .get();

  if (!result) return null;

  return {
    id: result.id,
    persona_id: result.personaId,
    wrong_form: result.wrongForm,
    correct_form: result.correctForm,
    category: result.category ?? 'name',
    use_in_prompt: result.useInPrompt ?? 1,
    use_in_replace: result.useInReplace ?? 1,
  };
}

/**
 * @description Update a glossary entry.
 *
 * @param db - Drizzle D1 client
 * @param id - Entry ID
 * @param updates - Fields to update
 * @param options - Optional persona settings
 * @returns True if update succeeded
 */
export async function updateGlossaryEntry(
  db: DrizzleD1,
  id: number,
  updates: GlossaryEntryUpdate,
  options: GlossaryOptions = {}
): Promise<boolean> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const setFields: Record<string, unknown> = {};

  if (updates.wrong_form !== undefined) setFields.wrongForm = updates.wrong_form;
  if (updates.correct_form !== undefined) setFields.correctForm = updates.correct_form;
  if (updates.category !== undefined) setFields.category = updates.category;
  if (updates.use_in_prompt !== undefined) setFields.useInPrompt = updates.use_in_prompt ? 1 : 0;
  if (updates.use_in_replace !== undefined) setFields.useInReplace = updates.use_in_replace ? 1 : 0;

  if (Object.keys(setFields).length === 0) return false;

  const result = await db.update(glossary)
    .set(setFields)
    .where(and(eq(glossary.personaId, personaId), eq(glossary.id, id)))
    .returning({ id: glossary.id });

  return result.length > 0;
}

/**
 * @description Delete a glossary entry.
 *
 * @param db - Drizzle D1 client
 * @param id - Entry ID
 * @param options - Optional persona settings
 * @returns True if delete succeeded
 */
export async function deleteGlossaryEntry(
  db: DrizzleD1,
  id: number,
  options: GlossaryOptions = {}
): Promise<boolean> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const result = await db.delete(glossary)
    .where(and(eq(glossary.personaId, personaId), eq(glossary.id, id)))
    .returning({ id: glossary.id });

  return result.length > 0;
}

// ============================================================================
// PURE FUNCTIONS (STT CORRECTION)
// ============================================================================

/**
 * @description Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @description Apply glossary corrections to transcribed text (PURE FUNCTION).
 */
export function applyGlossaryCorrections(
  text: string,
  entries: GlossaryEntryRow[]
): string {
  let result = text;
  for (const entry of entries) {
    const regex = new RegExp(`\\b${escapeRegex(entry.wrong_form)}\\b`, 'gi');
    result = result.replace(regex, entry.correct_form);
  }
  return result;
}

/**
 * @description Build WhisperX initial_prompt string from glossary entries (PURE FUNCTION).
 */
export function buildGlossaryPrompt(entries: GlossaryEntryRow[]): string {
  const byCategory: Record<string, string[]> = {};

  for (const entry of entries) {
    const cat = entry.category || 'other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(entry.correct_form);
  }

  const parts: string[] = [];

  if (byCategory.name?.length) {
    parts.push(`Names: ${byCategory.name.join(', ')}`);
  }
  if (byCategory.term?.length) {
    parts.push(`Terms: ${byCategory.term.join(', ')}`);
  }
  if (byCategory.phrase?.length) {
    parts.push(`Phrases: ${byCategory.phrase.join(', ')}`);
  }
  if (byCategory.other?.length) {
    parts.push(`Other: ${byCategory.other.join(', ')}`);
  }

  return parts.join('. ') + (parts.length ? '.' : '');
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * @description Apply glossary corrections by fetching entries and applying them.
 */
export async function applyGlossary(
  db: DrizzleD1,
  text: string,
  options: GlossaryOptions = {}
): Promise<string> {
  const entries = await getGlossaryEntries(db, { forReplace: true, ...options });
  return applyGlossaryCorrections(text, entries);
}

/**
 * @description Build glossary prompt by fetching entries and formatting them.
 */
export async function getGlossaryPrompt(
  db: DrizzleD1,
  options: GlossaryOptions = {}
): Promise<string> {
  const entries = await getGlossaryEntries(db, { forPrompt: true, ...options });
  return buildGlossaryPrompt(entries);
}
