import { sql } from "drizzle-orm";
/**
 * Notebook schema — the entity's evolving reference documents and research notes.
 *
 * @module packages/db/src/schema/notebook
 * @description Notebook entries are long-form reference documents maintained by the entity.
 *   Unlike cold storage (atomic facts) or history (event log), notebook entries are
 *   structured documents with titles that the entity can create, update, and revisit.
 *   Titles are unique per persona — each notebook entry is a named document.
 * @upstream think cycle — entity reads and writes notebook entries via notebook tools
 * @downstream think cycle context builder — recently-viewed entries may be included in context
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant title must be unique per persona — acts as a named document identifier
 * @invariant persona_id is always present — notebooks are per-persona
 * @coupling cold-storage.ts — notebook is for structured documents; cold storage is for atomic facts
 */
import { sqliteTable, text, integer, index, blob } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";

/**
 * Notebook table — named reference documents maintained by the entity.
 * Each entry is a structured document with a unique title, free-form content,
 * and an optional AI-generated summary for quick retrieval.
 *
 * Key columns:
 * - title: Unique document name — the entity's primary lookup key
 * - summary: Short description of the document's contents (auto-generated or manual)
 * - content: Full document text — may be arbitrarily long
 * - lastViewedAt: Tracks when this document was last accessed in a think cycle
 * - embedding: Semantic vector for similarity search across documents
 *
 * Index strategy:
 * - title index: direct lookup by document name
 * - persona index: load all documents for a persona
 * - last_viewed index: surface recently-accessed documents for context loading
 *
 * @downstream think cycle context — recent documents may be injected as context
 * @pattern persona-scoped — notebook entries isolated by persona_id
 * @invariant title is unique within a persona; agents should use upsert semantics
 */
export const notebook = sqliteTable(
  "notebook",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personaId: integer("persona_id")
      .notNull()
      .default(1)
      .references(() => personas.id),
    title: text("title").notNull().unique(),
    summary: text("summary"),
    content: text("content").notNull(),
    lastViewedAt: text("last_viewed_at"),
    embedding: blob("embedding"),
    embeddingModel: text("embedding_model"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_notebook_title").on(table.title),
    index("idx_notebook_persona").on(table.personaId),
    index("idx_notebook_last_viewed").on(table.lastViewedAt),
  ]
);
