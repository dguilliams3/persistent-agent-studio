import { sql } from "drizzle-orm";
/**
 * Pending view images schema — queue of images awaiting entity review in context.
 *
 * @module packages/db/src/schema/pending-view-images
 * @description When an image is generated or received, it may be placed in this queue
 *   so the entity can "view" it in a subsequent think cycle (injected as image context).
 *   Once the entity processes the image, it is marked as viewed. This implements the
 *   asynchronous image review workflow — entity generates art, then reflects on it next cycle.
 * @upstream image generation tools — inserts pending view records after creating images
 * @upstream think cycle context builder — queries unviewed images to inject into context
 * @downstream think cycle — entity sees the image in context and marks it viewed
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant persona_id is always present — image queue is per-persona
 * @invariant viewed = 0 means pending; viewed = 1 means processed
 * @invariant imageId references history.id — cascades on delete
 * @coupling history.ts — imageId references the history entry containing the image
 */
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";
import { history } from "./history";

/**
 * Pending view images table — asynchronous queue for entity image review.
 * Images are enqueued here so the entity can process them in the next available
 * think cycle, receiving the image as visual context input.
 *
 * Key columns:
 * - imageId: References the history entry containing the image (FK with cascade delete)
 * - requestedAt: When this image was queued for review
 * - cycleId: The cycle that generated this image and requested entity review
 * - viewed: 0 = pending entity review; 1 = entity has processed this image
 *
 * Index strategy:
 * - persona+viewed composite: efficiently fetch unviewed images per persona
 *
 * @downstream think cycle context builder — queries WHERE viewed = 0 to inject images
 * @pattern persona-scoped — image review queue isolated by persona_id
 * @invariant after entity views the image, viewed is set to 1 (not deleted)
 */
export const pendingViewImages = sqliteTable(
  "pending_view_images",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personaId: integer("persona_id")
      .notNull()
      .default(1)
      .references(() => personas.id),
    imageId: integer("image_id")
      .notNull()
      .references(() => history.id, { onDelete: "cascade" }),
    requestedAt: text("requested_at").default(sql`(datetime('now'))`),
    cycleId: integer("cycle_id"),
    viewed: integer("viewed").default(0),
  },
  (table) => [
    index("idx_pending_view_persona").on(table.personaId, table.viewed),
    index("idx_pending_view_unviewed")
      .on(table.viewed)
      .where(sql`viewed = 0`),
  ]
);
