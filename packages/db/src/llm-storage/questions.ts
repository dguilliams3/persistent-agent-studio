/**
 * Questions (open curiosity threads) database operations
 *
 * @module @persistence/db/llm-storage/questions
 * @description Database operations for open curiosity threads.
 *
 * Questions track things the entity is curious about without pressure to resolve:
 * - `open`: Not yet explored
 * - `exploring`: Actively investigating
 * - `resolved`: Answered (resolved_into documents the insight)
 * - `dissolved`: No longer relevant (not answered, just stopped mattering)
 *
 * Domains: self | world | user | technical | creative
 * Notes accumulate over time as thoughts are added.
 *
 * @upstream Called by:
 *   - packages/telegram/src/commands/context_data/questions/handler.ts
 *   - packages/tools/src/definitions/question/handler.ts
 *   - platforms/cloudflare context building
 * @downstream Calls:
 *   - Drizzle query builder
 *   - @persistence/db/persona-scope - getActivePersonaId
 *
 * @antipattern RAW_SQL_IN_HANDLER
 *   If you're writing raw SQL for questions operations in a handler, STOP.
 *   Import and use these functions instead. Handlers should orchestrate, not query.
 */

import { eq, and, not, desc, sql, inArray } from 'drizzle-orm';
import type { DrizzleD1 } from '../client';
import { getActivePersonaId } from '../persona-scope';
import { questions } from '../schema/questions';
import type { QuestionEntry } from './QuestionEntry';
import type { QuestionStatus } from './QuestionStatus';
import type { QuestionAddResult } from './QuestionAddResult';

/**
 * Options for persona-scoped question operations.
 */
interface QuestionOptions {
  personaId?: number;
}

/**
 * Select fields for question queries — maps schema columns to the expected snake_case interface.
 */
const questionSelectFields = {
  id: questions.id,
  content: questions.content,
  domain: questions.domain,
  status: questions.status,
  notes: questions.notes,
  resolved_into: questions.resolvedInto,
  created_at: questions.createdAt,
  updated_at: questions.updatedAt,
} as const;

/**
 * @description Retrieves all active questions (not deleted)
 *
 * Returns questions that are still being held, including resolved and dissolved.
 *
 * @param db - Drizzle D1 client
 * @param options - Optional settings (personaId for persona scoping)
 * @returns Array of questions, newest first
 */
export async function getQuestions(db: DrizzleD1, options: QuestionOptions = {}): Promise<QuestionEntry[]> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const rows = await db.select(questionSelectFields)
    .from(questions)
    .where(and(
      eq(questions.personaId, personaId),
      not(eq(questions.status, 'deleted'))
    ))
    .orderBy(desc(questions.createdAt))
    .all();

  return rows as QuestionEntry[];
}

/**
 * @description Retrieves only active (open/exploring) questions
 *
 * Use this when you only want questions that are still being held,
 * excluding resolved and dissolved ones.
 *
 * @param db - Drizzle D1 client
 * @param options - Optional settings
 * @returns Array of active questions
 */
export async function getActiveQuestions(db: DrizzleD1, options: QuestionOptions = {}): Promise<QuestionEntry[]> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const rows = await db.select(questionSelectFields)
    .from(questions)
    .where(and(
      eq(questions.personaId, personaId),
      inArray(questions.status, ['open', 'exploring'])
    ))
    .orderBy(desc(questions.createdAt))
    .all();

  return rows as QuestionEntry[];
}

/**
 * @description Retrieves ALL questions including resolved, dissolved, and deleted
 *
 * Use this for auditing, debugging, or viewing question history.
 *
 * @param db - Drizzle D1 client
 * @param options - Optional settings
 * @returns Array of all questions
 */
export async function getAllQuestions(db: DrizzleD1, options: QuestionOptions = {}): Promise<QuestionEntry[]> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const rows = await db.select(questionSelectFields)
    .from(questions)
    .where(eq(questions.personaId, personaId))
    .orderBy(desc(questions.createdAt))
    .all();

  return rows as QuestionEntry[];
}

/**
 * @description Adds a new question with optional domain
 *
 * Creates a new curiosity thread. Starts with 'open' status.
 *
 * @param db - Drizzle D1 client
 * @param content - The question being asked
 * @param domain - Optional category (self, world, user, technical, creative)
 * @param options - Optional settings
 * @returns The ID and domain of the new question
 */
export async function addQuestion(
  db: DrizzleD1,
  content: string,
  domain: string | null = null,
  options: QuestionOptions = {}
): Promise<QuestionAddResult> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const result = await db.insert(questions).values({
    personaId,
    content,
    domain: domain ?? null,
    status: 'open',
  }).returning({ id: questions.id });

  return {
    id: result[0].id,
    domain: domain ?? null
  };
}

/**
 * @description Adds a note to a question
 *
 * Notes are stored as a JSON array and grow over time.
 * Optionally sets status to 'exploring' if currently 'open'.
 *
 * @param db - Drizzle D1 client
 * @param id - The question ID
 * @param note - The note to add
 * @param setExploring - Whether to set status to 'exploring' if open
 * @param options - Optional settings
 * @returns Result
 */
export async function addNote(
  db: DrizzleD1,
  id: number,
  note: string,
  setExploring: boolean = false,
  options: QuestionOptions = {}
): Promise<{ success: boolean; noteCount: number; status: QuestionStatus }> {
  const personaId = options.personaId ?? await getActivePersonaId(db);

  // Get current question
  const question = await db.select()
    .from(questions)
    .where(and(eq(questions.id, id), eq(questions.personaId, personaId)))
    .get();

  if (!question) {
    return { success: false, noteCount: 0, status: 'open' };
  }

  // Parse existing notes or start fresh
  let notesArray: string[];
  try {
    notesArray = question.notes ? JSON.parse(question.notes) : [];
  } catch {
    notesArray = [];
  }

  // Add new note with timestamp
  const timestamp = new Date().toISOString().slice(0, 10);
  notesArray.push(`${timestamp}: ${note}`);

  const setFields: Record<string, unknown> = {
    notes: JSON.stringify(notesArray),
    updatedAt: sql`datetime("now")`,
  };

  let newStatus = question.status as QuestionStatus;
  if (setExploring && question.status === 'open') {
    setFields.status = 'exploring';
    newStatus = 'exploring';
  }

  await db.update(questions)
    .set(setFields)
    .where(and(eq(questions.id, id), eq(questions.personaId, personaId)));

  return { success: true, noteCount: notesArray.length, status: newStatus };
}

/**
 * @description Resolves a question with an optional insight
 *
 * Marks the question as resolved and optionally documents what insight emerged.
 *
 * @param db - Drizzle D1 client
 * @param id - The question ID
 * @param resolvedInto - What insight emerged (optional)
 * @param options - Optional settings
 * @returns True if resolved, false if not found
 */
export async function resolveQuestion(
  db: DrizzleD1,
  id: number,
  resolvedInto: string | null = null,
  options: QuestionOptions = {}
): Promise<boolean> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const result = await db.update(questions)
    .set({
      status: 'resolved',
      resolvedInto: resolvedInto ?? null,
      updatedAt: sql`datetime("now")`,
    })
    .where(and(eq(questions.id, id), eq(questions.personaId, personaId)))
    .returning({ id: questions.id });

  return result.length > 0;
}

/**
 * @description Dissolves a question with an optional reason
 *
 * Marks the question as dissolved - it stopped mattering without being answered.
 * The reason is stored in resolved_into for context.
 *
 * @param db - Drizzle D1 client
 * @param id - The question ID
 * @param reason - Why it dissolved (optional)
 * @param options - Optional settings
 * @returns True if dissolved, false if not found
 */
export async function dissolveQuestion(
  db: DrizzleD1,
  id: number,
  reason: string | null = null,
  options: QuestionOptions = {}
): Promise<boolean> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const dissolveNote = reason ? `Dissolved: ${reason}` : null;

  const result = await db.update(questions)
    .set({
      status: 'dissolved',
      resolvedInto: dissolveNote,
      updatedAt: sql`datetime("now")`,
    })
    .where(and(eq(questions.id, id), eq(questions.personaId, personaId)))
    .returning({ id: questions.id });

  return result.length > 0;
}

/**
 * @description Soft deletes a question by setting status to 'deleted'
 *
 * Uses status='deleted' as the soft-delete mechanism for audit trail.
 * The question remains in the database but is excluded from active queries.
 *
 * @param db - Drizzle D1 client
 * @param id - The question ID
 * @param options - Optional settings
 * @returns True if deleted, false if not found
 */
export async function deleteQuestion(
  db: DrizzleD1,
  id: number,
  options: QuestionOptions = {}
): Promise<boolean> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const result = await db.update(questions)
    .set({
      status: 'deleted',
      updatedAt: sql`datetime("now")`,
    })
    .where(and(eq(questions.id, id), eq(questions.personaId, personaId)))
    .returning({ id: questions.id });

  return result.length > 0;
}
