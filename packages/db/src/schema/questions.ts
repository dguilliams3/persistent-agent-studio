import { sql } from "drizzle-orm";
/**
 * Questions schema — open research questions and knowledge gaps tracked by the entity.
 *
 * @module packages/db/src/schema/questions
 * @description Questions are explicit knowledge gaps the entity identifies and tracks
 *   across think cycles. They drive research behaviors — the entity uses open questions
 *   to guide search and investigation tool usage. Questions have domains for categorization
 *   and are marked resolved when answered (with resolvedInto pointing to the answer).
 * @upstream think cycle — entity creates questions via question tools during thinking
 * @downstream think cycle context builder — open questions are loaded as research agenda
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant persona_id is always present — questions are per-persona
 * @invariant status must be one of: "open" | "exploring" | "resolved" | "dissolved" | "deleted"
 * @coupling learned.ts — questions may be resolved into learned entries
 */
import { sqliteTable, text, integer, index, blob } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";

/**
 * Questions table — active research questions and knowledge gaps.
 * The entity tracks things it wants to investigate, providing structure
 * to autonomous research behavior across thinking cycles.
 *
 * Key columns:
 * - content: The question text
 * - domain: Category label (e.g., "science", "relationships", "philosophy")
 * - status: "open" means actively investigating; "resolved" means answered
 * - notes: Partial findings, related leads, or investigation notes
 * - resolvedInto: Reference to where the answer was captured (e.g., learned entry ID or text)
 * - embedding: Semantic vector for deduplication and related-question clustering
 *
 * Index strategy:
 * - status index: retrieve open questions for the next research cycle
 * - domain index: filter questions by research domain
 * - persona index: load all questions for a persona
 *
 * @downstream think cycle context — open questions shape the entity's research agenda
 * @pattern persona-scoped — questions isolated by persona_id
 * @invariant resolvedInto is set when status changes to "resolved"
 */
export const questions = sqliteTable(
  "questions",
  {
    id: integer("id").primaryKey(),
    personaId: integer("persona_id")
      .notNull()
      .default(1)
      .references(() => personas.id),
    content: text("content").notNull(),
    domain: text("domain"),
    status: text("status").default("open"),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at"),
    resolvedInto: text("resolved_into"),
    embedding: blob("embedding"),
    embeddingModel: text("embedding_model"),
  },
  (table) => [
    index("idx_questions_status").on(table.status),
    index("idx_questions_domain").on(table.domain),
    index("idx_questions_persona").on(table.personaId),
  ]
);
