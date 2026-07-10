import { sql } from "drizzle-orm";
/**
 * Image assets schema — catalog of all images generated or received by the entity.
 *
 * @module packages/db/src/schema/image-assets
 * @description Tracks every image associated with an entity: AI-generated art,
 *   user-uploaded images, GIF exports, and other media. Images may be stored
 *   inline (base64Data) for small assets or offloaded to R2 (r2Key) for large ones.
 *   Each image is linked to the history entry and cycle that produced it.
 * @upstream think cycle — image generation tools insert records here
 * @upstream user message handler — user-uploaded images create records here
 * @downstream pinned-images — favorite images are pinned by referencing imageAssets
 * @downstream pending-view-images — images queued for entity review reference these records
 * @downstream apps/web — gallery and art views query this table
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant persona_id is always present — images are per-persona
 * @invariant exactly one of base64Data or r2Key is set (not both, not neither)
 * @invariant deletedAt null means available; non-null means soft-deleted
 * @coupling r2 bucket — large images are stored in R2; r2Key is the object key
 */
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";

/**
 * Image assets table — catalog of all persona-associated media.
 * Centralizes metadata for every image generated or received, enabling
 * gallery browsing, favorites, and entity art review workflows.
 *
 * Key columns:
 * - sourceType: "generated" | "user_uploaded" | "gif_export" — categorizes the image origin
 * - historyId: The history entry associated with this image (if any)
 * - cycleId: The think cycle that produced this image (if generated)
 * - prompt: The prompt used to generate this image (if AI-generated)
 * - mediaType: MIME type (e.g., "image/png", "image/gif")
 * - width / height / sizeBytes: Image dimensions and size for UI rendering
 * - base64Data: Inline image data for small assets
 * - r2Key / r2Bucket: R2 object location for large assets
 * - isFavorite: User-set favorite flag for gallery filtering
 * - deletedAt: Soft-delete timestamp
 *
 * Index strategy:
 * - source index: filter by image origin type
 * - history / cycle index: link images back to producing events
 * - created index: time-ordered gallery browsing
 * - r2 index: lookup by R2 key for deletion and CDN routing
 * - persona+created composite: paginate gallery per persona
 *
 * @downstream apps/web gallery — queries active images ordered by createdAt
 * @pattern persona-scoped — images isolated by persona_id
 * @invariant soft-delete via deletedAt; R2 objects should be cleaned up separately
 */
export const imageAssets = sqliteTable(
  "image_assets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personaId: integer("persona_id")
      .notNull()
      .default(1)
      .references(() => personas.id),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    sourceType: text("source_type").notNull(),
    historyId: integer("history_id"),
    cycleId: integer("cycle_id"),
    prompt: text("prompt"),
    mediaType: text("media_type"),
    width: integer("width"),
    height: integer("height"),
    sizeBytes: integer("size_bytes"),
    base64Data: text("base64_data"),
    r2Key: text("r2_key"),
    r2Bucket: text("r2_bucket"),
    title: text("title"),
    description: text("description"),
    isFavorite: integer("is_favorite").default(0),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    index("idx_image_assets_source").on(table.sourceType),
    index("idx_image_assets_history").on(table.historyId),
    index("idx_image_assets_cycle").on(table.cycleId),
    index("idx_image_assets_created").on(table.createdAt),
    index("idx_image_assets_r2").on(table.r2Key),
    index("idx_image_assets_persona").on(table.personaId, table.createdAt),
  ]
);
