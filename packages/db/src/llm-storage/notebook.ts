/**
 * Notebook database operations
 *
 * @module @persistence/db/memory/notebook
 * @description Database operations for saved notes (notebook).
 *
 * The notebook system provides structured note-taking for Claude:
 * - Notes have title, content, and summary
 * - Supports exact and partial title matching (case-insensitive)
 * - Notes can be created, updated, retrieved by title, and deleted
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/routes/notebook.js - API endpoint handlers
 *   - platforms/cloudflare/src/index.js - Context building, NOTE actions
 * @downstream Calls:
 *   - Drizzle query builder
 *   - @persistence/db/persona-scope - getActivePersonaId
 *
 * @antipattern RAW_SQL_IN_HANDLER
 *   If you're writing raw SQL for notebook operations in a handler, STOP.
 *   Import and use these functions instead. Handlers should orchestrate, not query.
 */

import { eq, and, isNotNull, sql, asc, desc } from 'drizzle-orm';
import type { DrizzleD1 } from '../client';
import { getActivePersonaId } from '../persona-scope';
import { notebook } from '../schema/notebook';
import type { NotebookEntry } from './NotebookEntry';
import type { SaveResult } from './SaveResult';
import type { DeleteResult } from './DeleteResult';
import type { AppendResult } from './AppendResult';

// ═══════════════════════════════════════════════════════════════════════════
// RAG-SPECIFIC TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Raw notebook row from database with embedding data.
 * Used for RAG retrieval operations where we need the embedding blob.
 */
export interface NotebookRow {
  id: number;
  title: string;
  content: string;
  summary: string;
  created_at: string;
  updated_at: string;
  last_viewed_at: string | null;
  persona_id: number;
  embedding: ArrayBuffer | null;
  embedding_model: string | null;
}

/**
 * Options for persona-scoped notebook operations.
 */
interface NotebookOptions {
  personaId?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-ROW ASSEMBLY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format a UTC timestamp as Eastern Time string.
 * @param isoString - ISO timestamp (UTC from SQLite)
 * @returns Formatted string like "2026-02-05 14:30 EST"
 */
function formatEasternTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(',', '').replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2') + ' EST';
  } catch {
    return isoString; // Fallback to raw timestamp
  }
}

/**
 * Assemble multiple notebook rows into a single NotebookEntry with timestamp headers.
 * Each row becomes a section with format: ### YYYY-MM-DD HH:MM EST — summary\ncontent
 *
 * @param rows - Array of raw notebook rows, ordered by created_at ASC
 * @returns Assembled NotebookEntry with combined content
 */
function assembleNoteRows(rows: NotebookRow[]): NotebookEntry | null {
  if (!rows || rows.length === 0) return null;

  // Sort by created_at ascending (oldest first)
  const sorted = [...rows].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Assemble content with timestamp headers
  const assembledContent = sorted.map(row => {
    const timestamp = formatEasternTime(row.created_at);
    const summaryPart = row.summary ? ` — ${row.summary}` : '';
    return `### ${timestamp}${summaryPart}\n${row.content}`;
  }).join('\n\n---\n\n');

  // Use first row's data for base metadata, most recent summary
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  return {
    id: first.id,
    title: first.title,
    content: assembledContent,
    summary: last.summary || first.summary || '',
    created_at: first.created_at,
    updated_at: last.created_at, // Most recent addition
    last_viewed_at: last.last_viewed_at
  };
}

/**
 * Convert a Drizzle row to NotebookRow format for assembly.
 */
function toNotebookRow(row: Record<string, unknown>): NotebookRow {
  return {
    id: row.id as number,
    title: row.title as string,
    content: row.content as string,
    summary: (row.summary ?? '') as string,
    created_at: (row.createdAt ?? row.created_at ?? '') as string,
    updated_at: (row.updatedAt ?? row.updated_at ?? '') as string,
    last_viewed_at: (row.lastViewedAt ?? row.last_viewed_at ?? null) as string | null,
    persona_id: (row.personaId ?? row.persona_id ?? 0) as number,
    embedding: (row.embedding ?? null) as ArrayBuffer | null,
    embedding_model: (row.embeddingModel ?? row.embedding_model ?? null) as string | null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN QUERY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @description Retrieves all notebook entries with full content, sorted by most recently updated.
 * Groups multiple rows per title (from append operations) and assembles them.
 *
 * @param db - Drizzle D1 client
 * @param options - Optional settings (personaId for persona scoping)
 * @returns Array of assembled notebook entries with full content
 */
export async function getNotebook(db: DrizzleD1, options: NotebookOptions = {}): Promise<NotebookEntry[]> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const rows = await db.select()
    .from(notebook)
    .where(eq(notebook.personaId, personaId))
    .orderBy(notebook.title, asc(notebook.createdAt))
    .all();

  if (!rows || rows.length === 0) return [];

  // Group by title (case-insensitive)
  const byTitle = new Map<string, NotebookRow[]>();
  for (const row of rows) {
    const key = row.title.toLowerCase();
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key)!.push(toNotebookRow(row as unknown as Record<string, unknown>));
  }

  // Assemble each group and sort by most recent update
  const assembled: NotebookEntry[] = [];
  for (const rowGroup of byTitle.values()) {
    const entry = assembleNoteRows(rowGroup);
    if (entry) assembled.push(entry);
  }

  // Sort by updated_at descending (most recent first)
  assembled.sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  return assembled;
}

/**
 * @description Retrieves a lightweight index of notebook entries with timestamps (no full content).
 * Groups multiple rows per title and returns aggregated metadata.
 *
 * @param db - Drizzle D1 client
 * @param options - Optional settings (personaId for persona scoping)
 * @returns Array of notebook index entries (id, title, summary, timestamps only)
 */
export async function getNotebookIndex(db: DrizzleD1, options: NotebookOptions = {}): Promise<Partial<NotebookEntry>[]> {
  const personaId = options.personaId ?? await getActivePersonaId(db);

  // Use raw sql for the complex GROUP BY query with subquery
  const rows = await db.all(sql`
    SELECT
      MIN(id) as id,
      title,
      (SELECT summary FROM notebook n2
       WHERE LOWER(n2.title) = LOWER(notebook.title)
         AND n2.persona_id = notebook.persona_id
       ORDER BY created_at DESC LIMIT 1) as summary,
      MIN(created_at) as created_at,
      MAX(created_at) as updated_at,
      MAX(last_viewed_at) as last_viewed_at
    FROM notebook
    WHERE persona_id = ${personaId}
    GROUP BY LOWER(title), persona_id
    ORDER BY MAX(created_at) DESC
  `);

  return rows as Partial<NotebookEntry>[];
}

/**
 * @description Retrieves a single note by title, supporting exact and partial matching.
 * Assembles multiple rows (from append operations) into a single entry with timestamp headers.
 *
 * @param db - Drizzle D1 client
 * @param titleQuery - The title to search for (case-insensitive, supports partial match)
 * @param options - Optional settings
 * @returns The assembled note object or null if not found
 *
 * @note SQLite LIKE patterns limited to ~50 chars to avoid SQLITE_ERROR
 */
export async function getNote(
  db: DrizzleD1,
  titleQuery: string,
  options: NotebookOptions = {}
): Promise<NotebookEntry | null> {
  const normalized = titleQuery?.trim();
  if (!normalized) return null;

  const personaId = options.personaId ?? await getActivePersonaId(db);

  // Try exact match first - get ALL rows with this title
  let rows = await db.select()
    .from(notebook)
    .where(and(
      eq(notebook.personaId, personaId),
      sql`LOWER(title) = LOWER(${normalized})`
    ))
    .orderBy(asc(notebook.createdAt))
    .all();

  if (!rows || rows.length === 0) {
    // Try partial match with truncated query
    const searchTerm = normalized.slice(0, 50);
    rows = await db.select()
      .from(notebook)
      .where(and(
        eq(notebook.personaId, personaId),
        sql`LOWER(title) LIKE LOWER(${`%${searchTerm}%`})`
      ))
      .orderBy(asc(notebook.createdAt))
      .all();
  }

  if (!rows || rows.length === 0) {
    return null;
  }

  // Assemble multiple rows into single entry with timestamp headers
  const notebookRows = rows.map(row => toNotebookRow(row as unknown as Record<string, unknown>));
  return assembleNoteRows(notebookRows);
}

/**
 * @description Creates or OVERWRITES a notebook entry. If a note with the same title exists,
 * deletes ALL existing rows for that title and creates fresh. This is a full overwrite.
 *
 * For appending to an existing note without overwriting, use appendNote() instead.
 *
 * @param db - Drizzle D1 client
 * @param title - The title of the note
 * @param content - The full content/body of the note
 * @param summary - A brief summary for the index view
 * @param options - Optional settings
 * @returns Object with action ('created' or 'updated') and the note ID
 */
export async function saveNote(
  db: DrizzleD1,
  title: string,
  content: string,
  summary: string,
  options: NotebookOptions = {}
): Promise<SaveResult> {
  const safeTitle = title ?? 'Untitled';
  const safeContent = content ?? '';
  const safeSummary = summary ?? null;

  const personaId = options.personaId ?? await getActivePersonaId(db);

  // Check if any rows exist with this title (scoped to persona)
  const existing = await db.select({ id: notebook.id })
    .from(notebook)
    .where(and(
      eq(notebook.personaId, personaId),
      sql`LOWER(title) = LOWER(${safeTitle})`
    ))
    .get();

  const isUpdate = !!existing;

  if (existing) {
    // DELETE ALL rows with this title (multi-row support)
    await db.run(sql`
      DELETE FROM notebook
      WHERE persona_id = ${personaId} AND LOWER(title) = LOWER(${safeTitle})
    `);
  }

  // Insert fresh row
  const result = await db.insert(notebook).values({
    personaId,
    title: safeTitle,
    content: safeContent,
    summary: safeSummary,
  }).returning({ id: notebook.id });

  return {
    action: isUpdate ? 'updated' : 'created',
    id: result[0].id
  };
}

/**
 * @description Deletes ALL rows for a notebook entry by title (supports partial matching).
 *
 * @param db - Drizzle D1 client
 * @param titleQuery - The title to search for and delete
 * @param options - Optional settings
 * @returns Object with success flag and deleted title (if found)
 */
export async function deleteNote(
  db: DrizzleD1,
  titleQuery: string,
  options: NotebookOptions = {}
): Promise<DeleteResult> {
  const note = await getNote(db, titleQuery, options);
  if (note) {
    const personaId = options.personaId ?? await getActivePersonaId(db);
    // Delete ALL rows with this title (multi-row support)
    await db.run(sql`
      DELETE FROM notebook
      WHERE persona_id = ${personaId} AND LOWER(title) = LOWER(${note.title})
    `);
    return { success: true, title: note.title };
  }
  return { success: false };
}

// ═══════════════════════════════════════════════════════════════════════════
// APPEND OPERATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @description Appends content to an existing notebook entry as a new row.
 * If the note doesn't exist, creates it (like shell >> behavior).
 * Includes idempotency guard: rejects duplicate content within 60-second window.
 *
 * @param db - Drizzle D1 client
 * @param title - The title of the note to append to
 * @param content - The content to append
 * @param summary - Optional summary for this addition
 * @param options - Optional settings
 * @returns AppendResult with appended flag, id, and optional reason
 */
export async function appendNote(
  db: DrizzleD1,
  title: string,
  content: string,
  summary: string | null = null,
  options: NotebookOptions = {}
): Promise<AppendResult> {
  const safeTitle = title?.trim() || 'Untitled';
  const safeContent = content || '';
  const safeSummary = summary ?? null;

  const personaId = options.personaId ?? await getActivePersonaId(db);

  // Idempotency check: reject if exact same title + content within 60 seconds
  const duplicate = await db.select({ id: notebook.id })
    .from(notebook)
    .where(and(
      eq(notebook.personaId, personaId),
      sql`LOWER(title) = LOWER(${safeTitle})`,
      eq(notebook.content, safeContent),
      sql`created_at > datetime('now', '-60 seconds')`
    ))
    .get();

  if (duplicate) {
    return { appended: false, reason: 'duplicate' };
  }

  // Check if note already exists (to determine if this is a new note)
  const existing = await db.select({ id: notebook.id })
    .from(notebook)
    .where(and(
      eq(notebook.personaId, personaId),
      sql`LOWER(title) = LOWER(${safeTitle})`
    ))
    .get();

  const isNewNote = !existing;

  // Insert new row (addition)
  const result = await db.insert(notebook).values({
    personaId,
    title: safeTitle,
    content: safeContent,
    summary: safeSummary,
  }).returning({ id: notebook.id });

  return {
    appended: true,
    id: result[0].id,
    reason: isNewNote ? 'created' : undefined
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// RAG RETRIEVAL QUERIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @description Retrieves notebook entries that have embeddings for RAG retrieval.
 *
 * Returns notebook entries with non-null embeddings for semantic search operations.
 *
 * @param db - Drizzle D1 client
 * @param _options - Optional persona scoping (intentionally ignored for RAG)
 * @returns Array of notebook rows with embeddings
 *
 * @note Does NOT use persona scoping for RAG - semantic search should be cross-persona
 */
export async function getNotebookWithEmbeddings(
  db: DrizzleD1,
  _options: NotebookOptions = {}
): Promise<NotebookRow[]> {
  // Note: RAG retrieval intentionally ignores persona scoping
  const rows = await db.select()
    .from(notebook)
    .where(isNotNull(notebook.embedding))
    .orderBy(asc(notebook.createdAt))
    .all();

  return rows.map(row => toNotebookRow(row as unknown as Record<string, unknown>));
}
