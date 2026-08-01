import { sql } from "drizzle-orm";
/**
 * Pinned images schema — a fixed set of favorited images displayed persistently in the UI.
 *
 * @module packages/db/src/schema/pinned-images
 * @description Pinned images are a small, curated set of images (indexed by slot number)
 *   that the entity or user designates for prominent display. Each slot holds one image,
 *   identified by its history entry ID. Slots are numbered, allowing ordered display.
 *   Deleting the history entry cascades to remove the pin.
 * @upstream apps/web — user pins images from the gallery UI
 * @upstream admin API — operator can pin images programmatically
 * @downstream apps/web UI — pinned images are displayed in a persistent panel or header
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant slot is the primary key — each slot holds at most one image
 * @invariant persona_id is always present — pins are per-persona
 * @invariant imageId references history.id — cascades on delete
 * @coupling history.ts — pins reference history entry IDs (not image_assets IDs)
 */
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";
import { history } from "./history";

/**
 * Pinned images table — ordered slots for persistently featured images.
 * Maintains a small curated set of images per persona for prominent UI display.
 * Slot numbers define display order; replacing a slot overwrites the previous pin.
 *
 * Key columns:
 * - slot: Integer slot number (primary key) — display position
 * - imageId: References the history entry containing this image (FK with cascade delete)
 * - pinnedAt: Timestamp when this slot was last set
 *
 * Index strategy:
 * - persona+slot composite: load all pinned slots for a persona in order
 *
 * @downstream apps/web pinned panel — queries all slots for the active persona
 * @pattern persona-scoped — pinned images isolated by persona_id
 * @invariant imageId cascade delete ensures stale pins are auto-removed when history is pruned
 */
export const pinnedImages = sqliteTable(
  "pinned_images",
  {
    slot: integer("slot").primaryKey(),
    personaId: integer("persona_id")
      .notNull()
      .default(1)
      .references(() => personas.id),
    imageId: integer("image_id")
      .notNull()
      .references(() => history.id, { onDelete: "cascade" }),
    pinnedAt: text("pinned_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_pinned_images_persona").on(table.personaId, table.slot),
  ]
);
