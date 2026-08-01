/**
 * Learned (self-knowledge) database operations
 *
 * @module @persistence/db/llm-storage/learned
 * @description Database operations for battle-tested self-knowledge with evidence tracking.
 *
 * Learned entries track insights the entity has about itself:
 * - `emerging`: New insight, needs more evidence
 * - `stable`: Verified through multiple experiences
 * - `load-bearing`: Core to self-understanding
 *
 * Evidence accumulates over time via cite operations. When established enough,
 * entries can be promoted to cold storage with full citation history.
 *
 * @upstream Called by:
 *   - packages/telegram/src/commands/context_data/learned/handler.ts
 *   - packages/tools/src/definitions/learned/handler.ts
 *   - platforms/cloudflare context building
 * @downstream Calls:
 *   - Drizzle query builder
 *   - @persistence/db/persona-scope - getActivePersonaId
 *
 * @antipattern RAW_SQL_IN_HANDLER
 *   If you're writing raw SQL for learned operations in a handler, STOP.
 *   Import and use these functions instead. Handlers should orchestrate, not query.
 */

import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import type { DrizzleD1 } from '../client';
import { getActivePersonaId } from '../persona-scope';
import { learned } from '../schema/learned';
import type { LearnedEntry } from './LearnedEntry';
import type { LearnedConfidence } from './LearnedConfidence';
import type { LearnedAddResult } from './LearnedAddResult';

/**
 * Options for persona-scoped learned operations.
 */
interface LearnedOptions {
  personaId?: number;
}

/**
 * @description Retrieves all active learned entries (not promoted, not deleted)
 *
 * Returns self-knowledge that is still being tracked. Excludes entries that
 * have been promoted to cold storage (as they're now permanent memories).
 *
 * @param db - Drizzle D1 client
 * @param options - Optional settings (personaId for persona scoping)
 * @returns Array of active learned entries, newest first
 */
export async function getLearned(db: DrizzleD1, options: LearnedOptions = {}): Promise<LearnedEntry[]> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const rows = await db.select({
    id: learned.id,
    content: learned.content,
    confidence: learned.confidence,
    supporting_evidence: learned.supportingEvidence,
    challenging_evidence: learned.challengingEvidence,
    created_at: learned.createdAt,
    updated_at: learned.updatedAt,
    promoted_to_cold_storage_at: learned.promotedToColdStorageAt,
  })
    .from(learned)
    .where(and(
      eq(learned.personaId, personaId),
      isNull(learned.promotedToColdStorageAt)
    ))
    .orderBy(desc(learned.createdAt))
    .all();

  return rows as LearnedEntry[];
}

/**
 * @description Retrieves ALL learned entries including promoted and deleted ones
 *
 * Use this for auditing, debugging, or when you need the complete history.
 *
 * @param db - Drizzle D1 client
 * @param options - Optional settings
 * @returns Array of all learned entries
 */
export async function getAllLearned(db: DrizzleD1, options: LearnedOptions = {}): Promise<LearnedEntry[]> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const rows = await db.select({
    id: learned.id,
    content: learned.content,
    confidence: learned.confidence,
    supporting_evidence: learned.supportingEvidence,
    challenging_evidence: learned.challengingEvidence,
    created_at: learned.createdAt,
    updated_at: learned.updatedAt,
    promoted_to_cold_storage_at: learned.promotedToColdStorageAt,
  })
    .from(learned)
    .where(eq(learned.personaId, personaId))
    .orderBy(desc(learned.createdAt))
    .all();

  return rows as LearnedEntry[];
}

/**
 * @description Adds a new learned entry with initial confidence
 *
 * Creates a new self-knowledge entry. Starts with 'emerging' confidence by default.
 * Optional initial supporting evidence can be provided.
 *
 * @param db - Drizzle D1 client
 * @param content - The self-knowledge to track
 * @param confidence - Initial confidence level (default: 'emerging')
 * @param supporting - Optional initial supporting evidence
 * @param options - Optional settings
 * @returns The ID and confidence of the new entry
 */
export async function addLearned(
  db: DrizzleD1,
  content: string,
  confidence: LearnedConfidence = 'emerging',
  supporting: string | null = null,
  options: LearnedOptions = {}
): Promise<LearnedAddResult> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const supportingEvidence = supporting ? JSON.stringify([supporting]) : null;

  const result = await db.insert(learned).values({
    personaId,
    content,
    confidence,
    supportingEvidence,
  }).returning({ id: learned.id });

  return {
    id: result[0].id,
    confidence
  };
}

/**
 * @description Updates a learned entry's content and/or confidence
 *
 * Modifies an existing learned entry. Both content and confidence are optional,
 * but at least one must be provided.
 *
 * @param db - Drizzle D1 client
 * @param id - The learned entry ID to update
 * @param updates - Fields to update
 * @param updates.content - New content
 * @param updates.confidence - New confidence level
 * @param options - Optional settings
 * @returns True if entry was updated, false if not found
 */
export async function updateLearned(
  db: DrizzleD1,
  id: number,
  updates: { content?: string; confidence?: LearnedConfidence },
  options: LearnedOptions = {}
): Promise<boolean> {
  if (updates.content === undefined && updates.confidence === undefined) {
    throw new Error('At least one of content or confidence must be provided');
  }

  const personaId = options.personaId ?? await getActivePersonaId(db);

  const setFields: Record<string, unknown> = {
    updatedAt: sql`datetime("now")`,
  };
  if (updates.content !== undefined) {
    setFields.content = updates.content;
  }
  if (updates.confidence !== undefined) {
    setFields.confidence = updates.confidence;
  }

  const result = await db.update(learned)
    .set(setFields)
    .where(and(eq(learned.id, id), eq(learned.personaId, personaId)))
    .returning({ id: learned.id });

  return result.length > 0;
}

/**
 * @description Adds evidence (supporting or challenging) to a learned entry
 *
 * Evidence is stored as a JSON array and grows with each citation.
 * Timestamps are automatically prepended to each evidence string.
 *
 * @param db - Drizzle D1 client
 * @param id - The learned entry ID
 * @param type - Type of evidence
 * @param evidence - The evidence text
 * @param options - Optional settings
 * @returns Result with new evidence count
 */
export async function citeEvidence(
  db: DrizzleD1,
  id: number,
  type: 'supporting' | 'challenging',
  evidence: string,
  options: LearnedOptions = {}
): Promise<{ success: boolean; evidenceCount: number }> {
  const personaId = options.personaId ?? await getActivePersonaId(db);

  // Get current entry
  const entry = await db.select()
    .from(learned)
    .where(and(eq(learned.id, id), eq(learned.personaId, personaId)))
    .get();

  if (!entry) {
    return { success: false, evidenceCount: 0 };
  }

  // Determine which column to update
  const currentEvidence = type === 'supporting'
    ? entry.supportingEvidence
    : entry.challengingEvidence;

  // Parse existing evidence or start fresh
  let evidenceArray: string[];
  try {
    evidenceArray = currentEvidence ? JSON.parse(currentEvidence) : [];
  } catch {
    evidenceArray = [];
  }

  // Add new evidence with timestamp
  const timestamp = new Date().toISOString().slice(0, 10);
  evidenceArray.push(`${timestamp}: ${evidence}`);

  const serialized = JSON.stringify(evidenceArray);
  const setFields: Record<string, unknown> = {
    updatedAt: sql`datetime("now")`,
  };
  if (type === 'supporting') {
    setFields.supportingEvidence = serialized;
  } else {
    setFields.challengingEvidence = serialized;
  }

  await db.update(learned)
    .set(setFields)
    .where(and(eq(learned.id, id), eq(learned.personaId, personaId)));

  return { success: true, evidenceCount: evidenceArray.length };
}

/**
 * @description Marks a learned entry as promoted to cold storage
 *
 * Does NOT actually insert into cold storage - that's the caller's responsibility.
 * This just marks the timestamp so the entry is excluded from active learned list.
 *
 * @param db - Drizzle D1 client
 * @param id - The learned entry ID to mark as promoted
 * @param options - Optional settings
 * @returns True if marked, false if not found
 */
export async function markPromoted(
  db: DrizzleD1,
  id: number,
  options: LearnedOptions = {}
): Promise<boolean> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const result = await db.update(learned)
    .set({
      promotedToColdStorageAt: sql`datetime("now")`,
      updatedAt: sql`datetime("now")`,
    })
    .where(and(eq(learned.id, id), eq(learned.personaId, personaId)))
    .returning({ id: learned.id });

  return result.length > 0;
}

/**
 * @description Hard deletes a learned entry
 *
 * Unlike observations which use soft delete, learned entries are hard deleted
 * because the evidence history isn't worth preserving if the insight is discarded.
 *
 * @param db - Drizzle D1 client
 * @param id - The learned entry ID to delete
 * @param options - Optional settings
 * @returns True if deleted, false if not found
 */
export async function deleteLearned(
  db: DrizzleD1,
  id: number,
  options: LearnedOptions = {}
): Promise<boolean> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const result = await db.delete(learned)
    .where(and(eq(learned.id, id), eq(learned.personaId, personaId)))
    .returning({ id: learned.id });

  return result.length > 0;
}
