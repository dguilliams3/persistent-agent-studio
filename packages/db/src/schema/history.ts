/**
 * History schema — the append-only event log for all entity activity.
 *
 * @module packages/db/src/schema/history
 * @description Every action, message, tool call, and system event produced by or
 *   involving an entity is recorded here. This is the canonical research record.
 *   Entries are NEVER edited or deleted — summarization marks entries as consumed
 *   via summarized_at but preserves the originals.
 * @upstream platforms/cloudflare — think cycle orchestrator inserts entries each cycle
 * @upstream packages/db — Drizzle query builder with persona scoping
 * @downstream summaries — summarization reads history entries and sets summarized_at
 * @downstream sim-axis-scores — SIM scores reference history entries via targetTable/targetId
 * @downstream sim-anomaly-flags — anomaly detection flags history entries
 * @downstream pinned-images — pinned images reference history entry IDs
 * @downstream pending-view-images — images pending entity review reference history IDs
 * @downstream voice-transcriptions — user voice messages link to history entries
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant append-only — entries are never updated or deleted
 * @invariant persona_id is always present and valid — cross-persona queries are forbidden
 * @invariant summarized_at marks consumption by a summary, not deletion
 * @coupling summaries.ts — summarization workflow reads and marks history entries
 */
import { sqliteTable, text, integer, index, blob } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { personas } from "./personas";

/**
 * History table — append-only event log for all entity activity.
 * Every thought, tool call, user message, system event, and AI response
 * is stored here as a typed event entry.
 *
 * Key columns:
 * - type: Event type string (e.g., "thought", "tool_call", "user_message") — maps to EventDefinition
 * - content: Primary text payload (visible to entity and user)
 * - internal: Private reasoning or metadata (not shown in chat UI)
 * - cycleId: Links this entry to the think cycle that produced it
 * - summarizedAt: Set when a summary has consumed this entry; entry is NOT deleted
 * - embedding: BGE-base-en-v1.5 768-dim vector for semantic similarity (stored as integer blob)
 * - embeddingModel: Which embedding model produced the vector (frozen per architecture constraint)
 *
 * Index strategy:
 * - persona+created composite: the primary access pattern — all history queries filter by persona then time
 * - type index: filter by event type for SIM and analytics queries
 * - cycle index: retrieve all entries from a specific think cycle
 * - summarized index: find unsummarized entries for the next summarization pass
 *
 * @downstream summaries — reads entries where summarized_at is null for compression
 * @downstream sim-axis-scores — scores computed against history entry embeddings
 * @pattern append-only — never UPDATE or DELETE; use summarized_at to mark processed entries
 * @invariant embedding model is frozen per persona — see ARCHITECTURE_CONSTRAINTS.md
 * @invariant cycleId may be null for user-initiated events outside a think cycle
 */
export const history = sqliteTable(
  "history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personaId: integer("persona_id")
      .notNull()
      .references(() => personas.id),
    type: text("type").notNull(),
    content: text("content"),
    internal: text("internal"),
    cycleId: integer("cycle_id"),
    summarizedAt: text("summarized_at"),
    embedding: blob("embedding"),
    embeddingModel: text("embedding_model"),
    meterSnapshot: text("meter_snapshot"),
    metadata: text("metadata"),
    blurred: integer("blurred").default(0),
    vaulted: integer("vaulted").default(0),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_history_created").on(table.createdAt),
    index("idx_history_type").on(table.type),
    index("idx_history_persona_created").on(table.personaId, table.createdAt),
    index("idx_history_cycle").on(table.cycleId),
    index("idx_history_summarized").on(table.summarizedAt),
  ]
);
