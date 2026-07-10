import { sql } from "drizzle-orm";
/**
 * Summaries schema — compressed memory blocks derived from history entries.
 *
 * @module packages/db/src/schema/summaries
 * @description Summaries are LLM-produced compressions of history entry ranges.
 *   They reduce token cost when loading context into think cycles while preserving
 *   semantic content. Meta-summaries can summarize prior summaries (replacedById chain).
 *   Archived summaries are retired but retained for reproducibility.
 * @upstream think cycle orchestrator — triggers summarization when history grows long
 * @upstream packages/memory — summarization logic reads history and inserts summaries
 * @downstream think cycle context builder — loads active summaries as Block 2 context
 * @downstream sim-axis-scores — SIM may score summaries via targetTable/targetId pattern
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant persona_id is always present — summaries are never cross-persona
 * @invariant replacedById chain tracks meta-summary hierarchy; no circular references
 * @invariant archivedAt null means active; non-null means retired
 * @coupling history.ts — sourceIds records which history entry IDs this summary covers
 */
import { sqliteTable, text, integer, index, blob } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";

/**
 * Summaries table — LLM-produced compressions of history entry ranges.
 * Each summary covers a contiguous range of history entries for a persona.
 * Summaries replace raw history in the think cycle context to reduce token cost.
 *
 * Key columns:
 * - summary: The compressed text produced by the LLM summarization call
 * - messageCount: Number of history entries consumed by this summary
 * - coveredRange: Human-readable date range string (e.g., "2025-01-01 to 2025-01-07")
 * - metadata: JSON blob for extensible summary metadata
 * - embedding: Semantic vector of the summary for similarity search
 * - sourceIds: JSON array of history entry IDs consumed by this summary
 * - sourceType: "history" or "summaries" — indicates whether this is a meta-summary
 * - replacedById: ID of the newer summary that replaced this one (meta-summary chain)
 * - promotedToBlock2: Flag indicating this summary has been loaded into active context
 *
 * Index strategy:
 * - persona+created composite: primary time-ordered access pattern per persona
 * - active index: quickly filter out archived summaries
 * - replaced_by index: traverse meta-summary chains
 * - source_type index: distinguish base summaries from meta-summaries
 *
 * @downstream think cycle context builder — loads summaries where archivedAt is null
 * @pattern memory-compression — summaries reduce context size without data loss
 * @invariant original history entries remain after summarization (summarized_at is set, not deleted)
 * @invariant archivedAt marks retired summaries that have been superseded
 */
export const summaries = sqliteTable(
  "summaries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personaId: integer("persona_id")
      .notNull()
      .default(1)
      .references(() => personas.id),
    summary: text("summary").notNull(),
    messageCount: integer("message_count"),
    coveredRange: text("covered_range"),
    metadata: text("metadata").default("{}"),
    embedding: blob("embedding"),
    embeddingModel: text("embedding_model"),
    sourceIds: text("source_ids"),
    sourceType: text("source_type").default("history"),
    archivedAt: text("archived_at"),
    replacedById: integer("replaced_by_id"),
    tokenCount: integer("token_count"),
    tokenModel: text("token_model"),
    promotedToBlock2: integer("promoted_to_block2").default(0),
    tier: text("tier").default("tail"),
    tierPosition: integer("tier_position"),
    sortPosition: integer("sort_position"),
    coveredStart: text("covered_start"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_summaries_created").on(table.createdAt),
    index("idx_summaries_persona").on(table.personaId, table.createdAt),
    index("idx_summaries_active").on(table.archivedAt),
    index("idx_summaries_replaced_by").on(table.replacedById),
    index("idx_summaries_source_type").on(table.sourceType),
    index("idx_promoted_summaries")
      .on(table.promotedToBlock2)
      .where(sql`promoted_to_block2 = 1`),
    index("idx_summaries_tier_position").on(table.tier, table.tierPosition),
    index("idx_summaries_covered_start").on(table.coveredStart),
    index("idx_summaries_sort_position").on(table.sortPosition),
  ]
);
