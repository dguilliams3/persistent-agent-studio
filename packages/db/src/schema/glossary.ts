import { sql } from "drizzle-orm";
/**
 * Glossary schema — correction mappings for voice transcription proper nouns and terminology.
 *
 * @module packages/db/src/schema/glossary
 * @description The glossary stores mappings from common STT misrecognitions to their correct
 *   forms. When a voice message is transcribed, the correction pipeline scans for wrongForm
 *   matches and replaces them with correctForm values. Entries can also be injected into
 *   the STT prompt (useInPrompt) to guide the speech recognition model directly.
 *   Not persona-scoped — glossary applies system-wide.
 * @upstream admin API — operator manages glossary entries via /glossary routes
 * @downstream voice transcription pipeline — correction step applies glossary substitutions
 * @downstream STT prompt builder — useInPrompt entries included in the transcription model prompt
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant wrongForm is unique — each misrecognition maps to exactly one correction
 * @invariant NOT persona-scoped — corrections apply across all personas
 * @coupling voice-transcriptions.ts — glossaryApplied column records which entries were used
 */
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";

/**
 * Glossary table — voice transcription correction mappings.
 * Maps STT misrecognitions (wrongForm) to their correct forms (correctForm)
 * for proper nouns, technical terms, and domain-specific vocabulary.
 *
 * Key columns:
 * - wrongForm: The misrecognized text the STT engine produces (unique)
 * - correctForm: The correct text to substitute
 * - category: Classification of the correction (e.g., "name", "technical", "place")
 * - useInPrompt: 1 = inject this mapping into the STT prompt to guide recognition
 * - useInReplace: 1 = apply this mapping as a post-transcription substitution
 *
 * Index strategy:
 * - wrongForm index: fast lookup during correction pipeline scanning
 *
 * @downstream voice transcription pipeline — scans transcriptions for wrongForm occurrences
 * @pattern global — not persona-scoped; corrections apply system-wide
 * @invariant both useInPrompt and useInReplace can be 1 simultaneously (two correction strategies)
 */
export const glossary = sqliteTable(
  "glossary",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personaId: integer("persona_id")
      .notNull()
      .default(1)
      .references(() => personas.id),
    wrongForm: text("wrong_form").notNull().unique(),
    correctForm: text("correct_form").notNull(),
    category: text("category").default("name"),
    useInPrompt: integer("use_in_prompt").default(1),
    useInReplace: integer("use_in_replace").default(1),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
  },
  (table) => [index("idx_glossary_wrong_form").on(table.wrongForm)]
);
