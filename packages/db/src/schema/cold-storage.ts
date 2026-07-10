import { sql } from "drizzle-orm";
/**
 * Cold storage schema — permanent long-term memory store for consolidated entity knowledge.
 *
 * @module packages/db/src/schema/cold-storage
 * @description Cold storage holds distilled, high-confidence memories that have been
 *   promoted from the learned table or written directly by the entity. These entries
 *   represent stable facts about the world, relationships, and context that persist
 *   indefinitely. Unlike history (event log) or summaries (compression), cold storage
 *   is curated knowledge.
 * @upstream packages/memory — promotion logic moves learned entries to cold storage
 * @upstream think cycle — entity can write directly to cold storage via memory tools
 * @downstream think cycle context builder — loads cold storage as long-term context block
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant persona_id is always present — cold storage is strictly per-persona
 * @invariant entries are never automatically deleted — only explicit removal via tools
 * @coupling learned.ts — learned entries are promoted here once confidence is high
 */
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";

/**
 * Cold storage table — permanent long-term memory entries.
 * Stores consolidated knowledge that the entity has internalized and should
 * retain indefinitely across all thinking cycles.
 *
 * Key columns:
 * - content: The memory text — typically a distilled fact, relationship, or context note
 * - reason: Why this entry was added to cold storage (provenance trail)
 *
 * Index strategy:
 * - persona+created composite: load cold storage in insertion order per persona
 *
 * @downstream think cycle context — loaded as static long-term context
 * @pattern persona-scoped — cold storage is isolated by persona_id
 * @invariant entries persist until explicitly deleted by the entity or admin
 */
export const coldStorage = sqliteTable(
  "cold_storage",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personaId: integer("persona_id")
      .notNull()
      .default(1)
      .references(() => personas.id),
    content: text("content").notNull(),
    reason: text("reason"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_cold_storage_persona").on(table.personaId, table.createdAt),
  ]
);
