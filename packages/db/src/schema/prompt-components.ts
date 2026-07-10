import { sql } from "drizzle-orm";
/**
 * Prompt components schema — named, ordered building blocks for entity system prompts.
 *
 * @module packages/db/src/schema/prompt-components
 * @description Prompt components are database-stored fragments that are assembled into
 *   the entity's system prompt at think cycle time. Each component has a kind (category)
 *   and a sort order, allowing the operator to compose complex, layered system prompts
 *   without editing code. This replaces hardcoded TypeScript context constants.
 * @upstream admin API — operator manages prompt components via /prompt-components routes
 * @downstream think cycle context builder — active components assembled into system prompt in kind+sortOrder order
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant persona_id is always present — prompt components are per-persona
 * @invariant (personaId, kind, name) is unique — prevents duplicate named components
 * @invariant isActive = 1 means included in prompt assembly; 0 means skipped
 * @coupling personas.ts — the personas.systemPromptTemplate column may reference component kinds
 */
import { sqliteTable, text, integer, index, unique } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";

/**
 * Prompt components table — database-stored building blocks for entity system prompts.
 * Enables dynamic, operator-managed system prompt construction without code changes.
 * Components are assembled in kind+sortOrder sequence at think cycle time.
 *
 * Key columns:
 * - kind: Component category (e.g., "identity", "instructions", "context") — determines assembly slot
 * - name: Unique label within a persona+kind combination — for management UI
 * - content: The actual text injected into the system prompt
 * - sortOrder: Integer position within the kind group — lower numbers appear first
 * - isActive: 1 = included in prompt assembly; 0 = disabled without deletion
 *
 * Index strategy:
 * - persona+kind+sortOrder composite: load components in assembly order per persona and kind
 * - unique on (personaId, kind, name): prevents duplicate named components within a kind
 *
 * @downstream think cycle context builder — queries WHERE isActive = 1 ORDER BY kind, sortOrder
 * @pattern persona-scoped — prompt components isolated by persona_id
 * @invariant content must never contain hardcoded personal names (see ARCHITECTURE_CONSTRAINTS.md)
 */
export const promptComponents = sqliteTable(
  "prompt_components",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personaId: integer("persona_id")
      .notNull()
      .references(() => personas.id),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    content: text("content").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active").notNull().default(1),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at"),
  },
  (table) => [
    index("idx_prompt_components_persona").on(
      table.personaId,
      table.kind,
      table.sortOrder
    ),
    unique("prompt_components_unique").on(
      table.personaId,
      table.kind,
      table.name
    ),
  ]
);
