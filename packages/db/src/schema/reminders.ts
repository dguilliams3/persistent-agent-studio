import { sql } from "drizzle-orm";
/**
 * Reminders schema — persistent or conditional prompts injected into entity context.
 *
 * @module packages/db/src/schema/reminders
 * @description Reminders are short-form prompts that the entity or operator sets
 *   to ensure certain topics or tasks are surfaced in upcoming think cycles.
 *   They may be persistent (shown every cycle until dismissed) or conditional
 *   (shown only when a condition is met). Dismissed reminders are soft-deleted.
 * @upstream think cycle — entity can set reminders via reminder tools
 * @upstream admin API — operator can inject reminders via admin routes
 * @downstream think cycle context builder — active reminders (dismissedAt null) are injected into context
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant persona_id is always present — reminders are per-persona
 * @invariant dismissedAt null means active; non-null means dismissed
 * @coupling history.ts — a reminder being acted on produces a history entry
 */
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";

/**
 * Reminders table — short-form prompts injected into entity think cycle context.
 * Active reminders appear in every think cycle until dismissed by the entity.
 * Used to ensure follow-up on pending tasks, outstanding questions, or commitments.
 *
 * Key columns:
 * - content: The reminder text shown to the entity in context
 * - condition: "persistent" (always shown) or a condition string (shown when condition met)
 * - dismissedAt: Set when the entity dismisses the reminder; null means still active
 *
 * Index strategy:
 * - condition index: filter reminders by condition type for conditional loading
 * - persona index: load all active reminders for a persona
 *
 * @downstream think cycle context builder — queries WHERE dismissedAt IS NULL
 * @pattern persona-scoped — reminders isolated by persona_id
 * @invariant dismissedAt is the soft-delete mechanism — never hard-delete reminders
 */
export const reminders = sqliteTable(
  "reminders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personaId: integer("persona_id")
      .notNull()
      .default(1)
      .references(() => personas.id),
    content: text("content").notNull(),
    condition: text("condition").default("persistent"),
    dismissedAt: text("dismissed_at"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_reminders_condition").on(table.condition),
    index("idx_reminders_persona").on(table.personaId),
  ]
);
