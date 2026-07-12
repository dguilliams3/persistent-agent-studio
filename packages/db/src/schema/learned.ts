import { sql } from "drizzle-orm";
/**
 * Learned schema — evolving beliefs and knowledge claims with tracked confidence.
 *
 * @module packages/db/src/schema/learned
 * @description Learned entries represent the entity's active epistemic state —
 *   things it believes to be true, tracked with confidence levels and supporting/
 *   challenging evidence. Entries start as "emerging", can graduate to "stable"
 *   and "load-bearing", and ultimately to cold storage when fully consolidated.
 *   Distinguished from cold storage (permanent) — learned is a mutable belief space.
 * @upstream think cycle — entity writes and updates learned entries via learning tools
 * @downstream cold-storage — high-confidence entries are promoted to cold storage
 * @downstream think cycle context builder — active learned entries inform belief context
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant persona_id is always present — beliefs are per-persona
 * @invariant confidence must be one of: "emerging", "stable", "load-bearing" (see LearnedConfidence)
 * @invariant promotedToColdStorageAt set when entry graduates to cold_storage; entry remains here
 * @coupling cold-storage.ts — promotion pipeline reads learned and inserts to cold_storage
 */
import { sqliteTable, text, integer, index, blob } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";

/**
 * Learned table — mutable belief space tracking the entity's evolving knowledge.
 * Each entry is a knowledge claim with explicit confidence tracking, supporting
 * evidence, and challenging evidence for epistemic transparency.
 *
 * Key columns:
 * - content: The knowledge claim or belief being tracked
 * - confidence: Epistemic state — "emerging" | "stable" | "load-bearing"
 * - supportingEvidence: JSON or text listing evidence that supports this belief
 * - challengingEvidence: JSON or text listing evidence that challenges this belief
 * - promotedToColdStorageAt: Timestamp when this entry graduated to cold storage
 * - embedding: Semantic vector for deduplication and similarity search
 *
 * Index strategy:
 * - confidence index: retrieve entries by confidence tier for promotion logic
 * - persona index: load all beliefs for a persona
 *
 * @downstream cold-storage — promotion pipeline queries WHERE confidence = "established"
 * @pattern persona-scoped — beliefs isolated by persona_id
 * @invariant entries are retained after promotion — promotedToColdStorageAt is NOT a delete signal
 */
export const learned = sqliteTable(
  "learned",
  {
    id: integer("id").primaryKey(),
    personaId: integer("persona_id")
      .notNull()
      .default(1)
      .references(() => personas.id),
    content: text("content").notNull(),
    confidence: text("confidence").default("emerging"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at"),
    supportingEvidence: text("supporting_evidence"),
    challengingEvidence: text("challenging_evidence"),
    promotedToColdStorageAt: text("promoted_to_cold_storage_at"),
    embedding: blob("embedding"),
    embeddingModel: text("embedding_model"),
  },
  (table) => [
    index("idx_learned_confidence").on(table.confidence),
    index("idx_learned_persona").on(table.personaId),
  ]
);
