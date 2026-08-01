/**
 * Pinned Images database operations
 *
 * @module @persistence/db/pinned
 * @description Database operations for the pinned images system - a curated 5-slot
 * image wall where the LLM can pin meaningful or favorite images.
 *
 * Unlike the gallery which shows everything chronologically, this is intentional curation.
 * Slots 1-5 are fixed positions. Each slot can hold one image_id reference.
 * Empty slots are represented by absence from the table.
 *
 * Also handles "pending view images" - images the LLM has requested to view
 * in the next cycle. These auto-clear after being shown.
 *
 * Both tables are persona-scoped for multi-persona support.
 *
 * Key tables:
 * - `pinned_images`: 5-slot curated image wall (slot, image_id, pinned_at)
 * - `pending_view_images`: Temporary queue for images to view (image_id, viewed)
 *
 * Canonical type ownership: PinnedImageContext is defined and owned by this module
 * (@persistence/db/pinned). It is NOT exported from @persistence/media. Callers that
 * need the lightweight context shape (slot + title, no base64) import it from here.
 *
 * @upstream Called by:
 *   - Context building (MY SPACE section) — consumes PinnedImageContext via getPinnedImagesForContext
 *   - PIN_IMAGE action handler
 *   - VIEW_IMAGES action handler
 *   - API endpoints for pinned images
 * @downstream Calls:
 *   - DrizzleD1 query builder (from @persistence/db/client)
 *   - @persistence/db/persona-scope - getActivePersonaId
 */

import { eq, and, sql, like, or, inArray, isNull, desc } from "drizzle-orm";
import type { DrizzleD1 } from "./client";
import { getActivePersonaId } from "./persona-scope";
import { pinnedImages } from "./schema/pinned-images";
import { pendingViewImages } from "./schema/pending-view-images";
import { history } from "./schema/history";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Pinned image entry with full image data
 */
export interface PinnedImage {
  /** Slot position (1-5) */
  slot: number;
  /** Reference to history entry ID */
  image_id: number;
  /** When the image was pinned (ISO timestamp) */
  pinned_at: string;
  /** Base64 image data */
  image: string;
  /** Image prompt/description */
  prompt: string | null;
  /** History entry type (art_result, user_art, user_video) */
  type: string;
  /** When the original image was created */
  image_created_at: string;
}

/**
 * Pinned image context entry (lightweight, no base64).
 *
 * Used in system prompt to inform about pinned gallery items
 * without including the actual image data.
 */
export interface PinnedImageContext {
  /** Slot position (1-5) */
  slot: number;
  /** Reference to history entry ID */
  image_id: number;
  /** Cleaned title from prompt */
  title: string;
}

/**
 * Pending view image entry
 */
export interface PendingViewImage {
  /** pending_view_images table ID */
  id: number;
  /** Reference to history entry ID */
  image_id: number;
  /** Base64 image data */
  image: string;
  /** Image prompt/description */
  prompt: string | null;
}

/**
 * Gallery summary for context display
 */
export interface GallerySummary {
  /** Total number of images */
  count: number;
  /** Recent images with IDs and titles */
  images: Array<{ id: number; title: string }>;
  /** Backward compatibility: just the titles */
  titles: string[];
}

/**
 * Result of pin/unpin operations
 */
export interface PinResult {
  success: boolean;
  slot?: number;
  image_id?: number;
  removed?: boolean;
  error?: string;
}

/**
 * Result of swap operation
 */
export interface SwapResult {
  success: boolean;
  swapped?: [number, number];
}

/**
 * Result of request view images operation
 */
export interface ViewRequestResult {
  success: boolean;
  count: number;
}

/**
 * Result of clear viewed images operation
 */
export interface ClearViewedResult {
  success: boolean;
  cleared: number;
}

/**
 * Options for persona-scoped pinned image operations.
 */
export interface PinnedOptions {
  personaId?: number;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * @description Normalizes an ID to an integer, handling string/number inputs gracefully
 *
 * Claude sometimes sends IDs as strings (e.g., {"id":"1"} instead of {"id":1}).
 * This is a common JSON serialization quirk - some parsers stringify numbers.
 * We should accept both.
 *
 * @upstream Called by: pinImage, requestViewImages
 * @downstream Calls: parseInt (native)
 *
 * @param value - The ID value to normalize
 * @returns Integer ID, or null if the value can't be parsed as a valid ID
 *
 * @example
 * normalizeId(5)       // 5
 * normalizeId("5")     // 5
 * normalizeId(" 5 ")   // 5 (trims whitespace)
 * normalizeId("abc")   // null (no leading digits)
 * normalizeId(null)    // null
 */
export function normalizeId(
  value: string | number | null | undefined,
): number | null {
  // Handle null/undefined/empty
  if (value === null || value === undefined || value === "") {
    return null;
  }

  // If already a number, validate it
  if (typeof value === "number") {
    // NaN, Infinity, etc. are invalid
    if (!Number.isFinite(value)) return null;
    // Negative IDs are invalid
    if (value < 0) return null;
    // Return as integer (floor for decimals like 5.7 -> 5)
    return Math.floor(value);
  }

  // String: trim whitespace first, then try to parse
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;

    const parsed = parseInt(trimmed, 10);
    if (isNaN(parsed)) return null;
    if (parsed < 0) return null;
    return parsed;
  }

  // Any other type (object, array, etc.) - invalid
  return null;
}

/**
 * @description Parses raw prompt to clean title
 *
 * Removes "Generated: ", "User's prompt: " prefixes and ||ORIGINAL|| suffixes.
 *
 * @upstream Called by: getPinnedImagesForContext, getGallerySummary
 * @downstream Calls: None (pure string processing)
 *
 * @param rawPrompt - The raw internal field from history
 * @returns Clean title
 */
function parsePromptToTitle(rawPrompt: string | null): string {
  if (!rawPrompt) return "Untitled";

  let title = rawPrompt
    .replace(/^Generated:\s*/i, "")
    .replace(/^User's prompt:\s*/i, "");

  // Handle ||ORIGINAL|| delimiter
  if (title.includes("||ORIGINAL||")) {
    title = title.split("||ORIGINAL||")[0];
  }

  return title.trim() || "Untitled";
}

/**
 * @description Resolves persona ID from options or active persona
 */
async function resolvePersonaId(
  db: DrizzleD1,
  options: PinnedOptions,
): Promise<number> {
  return options.personaId ?? (await getActivePersonaId(db));
}

// =============================================================================
// PINNED IMAGES (Image Wall)
// =============================================================================

/**
 * @description Gets all pinned images with their slot positions and image details
 *
 * Returns joined data: slot info + image content from history table.
 * Empty slots are not returned (absence = empty).
 *
 * @upstream Called by:
 *   - /pinned-images endpoint
 *   - Context building
 *   - PIN_IMAGE list operation
 * @downstream Calls:
 *   - Drizzle query builder with JOIN
 *
 * @param db - Drizzle D1 client
 * @param options - Optional settings (personaId for persona scoping)
 * @returns Array of pinned images with full data
 */
export async function getPinnedImages(
  db: DrizzleD1,
  options: PinnedOptions = {},
): Promise<PinnedImage[]> {
  const personaId = await resolvePersonaId(db, options);

  const rows = await db
    .select({
      slot: pinnedImages.slot,
      image_id: pinnedImages.imageId,
      pinned_at: pinnedImages.pinnedAt,
      image: history.content,
      prompt: history.internal,
      type: history.type,
      image_created_at: history.createdAt,
    })
    .from(pinnedImages)
    .innerJoin(history, eq(pinnedImages.imageId, history.id))
    .where(
      and(
        eq(pinnedImages.personaId, personaId),
        // Mirror pinImage's acceptance: images keep media in content;
        // user_video rows keep their poster in internal (caption in
        // content). The old content-only filter accepted video pins and
        // then silently dropped them from every read (L10,
        // RUN-20260711-1939).
        or(
          like(history.content, "data:image%"),
          and(
            eq(history.type, "user_video"),
            or(
              like(history.internal, "data:image%"),
              like(history.internal, "r2://%"),
            ),
          ),
        ),
      ),
    )
    .orderBy(pinnedImages.slot)
    .all();

  // user_video: media lives in internal, caption in content — normalize to
  // the image/prompt contract so consumers render the poster, not the text.
  return rows.map((row) =>
    row.type === "user_video"
      ? { ...row, image: row.prompt ?? "", prompt: row.image }
      : row,
  ) as PinnedImage[];
}

/**
 * @description Gets pinned images formatted for context (titles only, not full base64)
 *
 * Returns slot + title for the context prompt. Parses prompt to extract
 * clean title without "Generated:" or "User's prompt:" prefixes.
 *
 * @upstream Called by:
 *   - Context building (MY SPACE section)
 * @downstream Calls:
 *   - Drizzle query builder with JOIN
 *   - parsePromptToTitle() for title extraction
 *
 * @param db - Drizzle D1 client
 * @param options - Optional settings (personaId for persona scoping)
 * @returns Array of pinned images with slot and title only
 */
export async function getPinnedImagesForContext(
  db: DrizzleD1,
  options: PinnedOptions = {},
): Promise<PinnedImageContext[]> {
  const personaId = await resolvePersonaId(db, options);

  const rows = await db
    .select({
      slot: pinnedImages.slot,
      image_id: pinnedImages.imageId,
      raw_prompt: history.internal,
      caption: history.content,
      type: history.type,
    })
    .from(pinnedImages)
    .innerJoin(history, eq(pinnedImages.imageId, history.id))
    .where(eq(pinnedImages.personaId, personaId))
    .orderBy(pinnedImages.slot)
    .all();

  return rows.map((row) => ({
    slot: row.slot,
    image_id: row.image_id,
    // user_video: internal holds the poster image, so the human-readable
    // title lives in content (caption) instead.
    title: parsePromptToTitle(
      row.type === "user_video" ? row.caption : row.raw_prompt,
    ),
  }));
}

/**
 * @description Pins an image to a specific slot (1-5)
 *
 * If the slot already has an image, it will be replaced.
 * Uses REPLACE INTO for upsert behavior.
 *
 * @upstream Called by:
 *   - PIN_IMAGE pin action handler
 * @downstream Calls:
 *   - normalizeId() for input validation
 *   - getActivePersonaId() for persona scoping
 *   - Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @param slot - Slot number (1-5)
 * @param imageId - The history entry ID of the image
 * @param options - Optional settings (personaId for persona scoping)
 * @returns Result object with success status
 */
export async function pinImage(
  db: DrizzleD1,
  slot: number,
  imageId: string | number,
  options: PinnedOptions = {},
): Promise<PinResult> {
  const normalizedSlot = parseInt(String(slot));
  const normalizedImageId = normalizeId(imageId);

  if (normalizedSlot < 1 || normalizedSlot > 5 || normalizedImageId === null) {
    return { success: false };
  }

  const personaId = await resolvePersonaId(db, options);

  // Verify image exists and is a valid image type (scoped to persona)
  const image = await db
    .select({ id: history.id })
    .from(history)
    .where(
      and(
        eq(history.id, normalizedImageId),
        eq(history.personaId, personaId),
        or(
          like(history.content, "data:image%"),
          and(
            eq(history.type, "user_video"),
            or(
              like(history.internal, "data:image%"),
              like(history.internal, "r2://%"),
            ),
          ),
        ),
      ),
    )
    .get();

  if (!image) {
    return {
      success: false,
      error: "Image not found or not a valid image type",
    };
  }

  // REPLACE INTO for upsert (slot is PK)
  await db.run(sql`
    REPLACE INTO pinned_images (persona_id, slot, image_id, pinned_at)
    VALUES (${personaId}, ${normalizedSlot}, ${normalizedImageId}, datetime("now"))
  `);

  return { success: true, slot: normalizedSlot, image_id: normalizedImageId };
}

/**
 * @description Unpins an image from a slot
 *
 * Removes the image from the specified slot, making it empty.
 *
 * @upstream Called by:
 *   - PIN_IMAGE unpin action handler
 * @downstream Calls:
 *   - getActivePersonaId() for persona scoping
 *   - Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @param slot - Slot number (1-5) to unpin
 * @param options - Optional settings (personaId for persona scoping)
 * @returns Result object with success status
 */
export async function unpinImage(
  db: DrizzleD1,
  slot: number,
  options: PinnedOptions = {},
): Promise<PinResult> {
  const normalizedSlot = parseInt(String(slot));

  if (normalizedSlot < 1 || normalizedSlot > 5) {
    return { success: false };
  }

  const personaId = await resolvePersonaId(db, options);
  const result = await db
    .delete(pinnedImages)
    .where(
      and(
        eq(pinnedImages.personaId, personaId),
        eq(pinnedImages.slot, normalizedSlot),
      ),
    )
    .returning();

  return { success: true, slot: normalizedSlot, removed: result.length > 0 };
}

/**
 * @description Swaps images between two slots
 *
 * If one slot is empty, moves the image from the other slot.
 * If both have images, they swap positions.
 *
 * @upstream Called by:
 *   - PIN_IMAGE swap action handler
 * @downstream Calls:
 *   - getActivePersonaId() for persona scoping
 *   - Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @param slotA - First slot (1-5)
 * @param slotB - Second slot (1-5)
 * @param options - Optional settings (personaId for persona scoping)
 * @returns Result object with success status and swapped slots
 */
export async function swapPinnedImages(
  db: DrizzleD1,
  slotA: number,
  slotB: number,
  options: PinnedOptions = {},
): Promise<SwapResult> {
  const normalizedA = parseInt(String(slotA));
  const normalizedB = parseInt(String(slotB));

  if (
    normalizedA < 1 ||
    normalizedA > 5 ||
    normalizedB < 1 ||
    normalizedB > 5
  ) {
    return { success: false };
  }

  if (normalizedA === normalizedB) {
    return { success: true, swapped: [normalizedA, normalizedB] };
  }

  const personaId = await resolvePersonaId(db, options);

  // Get current contents
  const pinA = await db
    .select({
      imageId: pinnedImages.imageId,
      pinnedAt: pinnedImages.pinnedAt,
    })
    .from(pinnedImages)
    .where(
      and(
        eq(pinnedImages.personaId, personaId),
        eq(pinnedImages.slot, normalizedA),
      ),
    )
    .get();

  const pinB = await db
    .select({
      imageId: pinnedImages.imageId,
      pinnedAt: pinnedImages.pinnedAt,
    })
    .from(pinnedImages)
    .where(
      and(
        eq(pinnedImages.personaId, personaId),
        eq(pinnedImages.slot, normalizedB),
      ),
    )
    .get();

  // Delete both slots
  await db
    .delete(pinnedImages)
    .where(
      and(
        eq(pinnedImages.personaId, personaId),
        inArray(pinnedImages.slot, [normalizedA, normalizedB]),
      ),
    );

  // Re-insert swapped (if they existed)
  if (pinA) {
    await db.insert(pinnedImages).values({
      personaId,
      slot: normalizedB,
      imageId: pinA.imageId,
      pinnedAt: pinA.pinnedAt,
    });
  }
  if (pinB) {
    await db.insert(pinnedImages).values({
      personaId,
      slot: normalizedA,
      imageId: pinB.imageId,
      pinnedAt: pinB.pinnedAt,
    });
  }

  return { success: true, swapped: [normalizedA, normalizedB] };
}

// =============================================================================
// PENDING VIEW IMAGES (VIEW_IMAGES action)
// =============================================================================

/**
 * @description Requests images to be viewed in the next cycle
 *
 * Adds image IDs to the pending_view_images table. These will appear
 * in the LLM's context as viewable images in the next cycle, then auto-clear.
 *
 * @upstream Called by:
 *   - VIEW_IMAGES action handler
 * @downstream Calls:
 *   - normalizeId() for input validation
 *   - Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @param imageIds - Array of history entry IDs
 * @param cycleId - Current cycle ID (for tracking)
 * @param options - Optional settings (personaId for persona scoping)
 * @returns Result object with success status and count
 */
export async function requestViewImages(
  db: DrizzleD1,
  imageIds: Array<number | string>,
  cycleId: number | null = null,
  options: PinnedOptions = {},
): Promise<ViewRequestResult> {
  if (!Array.isArray(imageIds) || imageIds.length === 0) {
    return { success: false, count: 0 };
  }

  const personaId = await resolvePersonaId(db, options);
  let count = 0;

  for (const id of imageIds) {
    const normalizedId = normalizeId(id);
    if (normalizedId === null) continue;

    // Verify it's a valid image (scoped to persona)
    const image = await db
      .select({ id: history.id })
      .from(history)
      .where(
        and(
          eq(history.id, normalizedId),
          eq(history.personaId, personaId),
          or(
            like(history.content, "data:image%"),
            and(
              eq(history.type, "user_video"),
              or(
                like(history.internal, "data:image%"),
                like(history.internal, "r2://%"),
              ),
            ),
          ),
        ),
      )
      .get();

    if (image) {
      await db.insert(pendingViewImages).values({
        personaId,
        imageId: normalizedId,
        cycleId: cycleId ?? null,
      });
      count++;
    }
  }

  return { success: count > 0, count };
}

/**
 * @description Gets pending images that haven't been viewed yet
 *
 * Returns full image data for images the LLM requested to see.
 *
 * @upstream Called by:
 *   - Context building (for including images in prompt)
 * @downstream Calls:
 *   - Drizzle query builder with JOIN
 *
 * @param db - Drizzle D1 client
 * @param options - Optional settings (personaId for persona scoping)
 * @returns Array of pending view images with full data
 */
export async function getPendingViewImages(
  db: DrizzleD1,
  options: PinnedOptions = {},
): Promise<PendingViewImage[]> {
  const personaId = await resolvePersonaId(db, options);

  const rows = await db
    .select({
      id: pendingViewImages.id,
      image_id: pendingViewImages.imageId,
      image: history.content,
      prompt: history.internal,
      type: history.type,
    })
    .from(pendingViewImages)
    .innerJoin(history, eq(pendingViewImages.imageId, history.id))
    .where(
      and(
        eq(pendingViewImages.personaId, personaId),
        eq(pendingViewImages.viewed, 0),
      ),
    )
    .orderBy(pendingViewImages.requestedAt)
    .all();

  // Same video normalization as getPinnedImages: embed the poster from
  // internal, not the caption from content.
  return rows.map(({ type, ...row }) =>
    type === "user_video"
      ? { ...row, image: row.prompt ?? "", prompt: row.image }
      : row,
  ) as PendingViewImage[];
}

/**
 * @description Marks pending images as viewed and clears them
 *
 * Called after a cycle completes to clear the viewed images.
 *
 * @upstream Called by:
 *   - Post-cycle cleanup
 * @downstream Calls:
 *   - getActivePersonaId() for persona scoping
 *   - Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @param options - Optional settings (personaId for persona scoping)
 * @returns Result object with success status and count cleared
 */
export async function clearViewedImages(
  db: DrizzleD1,
  options: PinnedOptions = {},
): Promise<ClearViewedResult> {
  const personaId = await resolvePersonaId(db, options);
  const deleted = await db
    .delete(pendingViewImages)
    .where(
      and(
        eq(pendingViewImages.personaId, personaId),
        eq(pendingViewImages.viewed, 0),
      ),
    )
    .returning();

  return { success: true, cleared: deleted.length };
}

/**
 * @description Marks specific images as viewed
 *
 * @upstream Called by:
 *   - Context building after images shown
 * @downstream Calls:
 *   - getActivePersonaId() for persona scoping
 *   - Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @param ids - pending_view_images IDs to mark
 * @param options - Optional settings (personaId for persona scoping)
 * @returns Result object with success status
 *
 * @note Uses chunking to avoid D1's 100 bound variable limit
 */
export async function markImagesViewed(
  db: DrizzleD1,
  ids: number[],
  options: PinnedOptions = {},
): Promise<{ success: boolean }> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: true };
  }

  const personaId = await resolvePersonaId(db, options);

  // Cloudflare D1 has a limit of 100 bound variables per query
  // Batch IDs to avoid "too many SQL variables" error
  const CHUNK_SIZE = 95;

  for (let chunkStart = 0; chunkStart < ids.length; chunkStart += CHUNK_SIZE) {
    const chunk = ids.slice(chunkStart, chunkStart + CHUNK_SIZE);
    await db
      .update(pendingViewImages)
      .set({ viewed: 1 })
      .where(
        and(
          eq(pendingViewImages.personaId, personaId),
          inArray(pendingViewImages.id, chunk),
        ),
      );
  }

  return { success: true };
}

// =============================================================================
// GALLERY SUMMARY
// =============================================================================

/**
 * @description Gets gallery summary for context (count + recent titles)
 *
 * Returns total image count and first N titles for context display.
 *
 * @upstream Called by:
 *   - Context building (MY SPACE section)
 * @downstream Calls:
 *   - Drizzle query builder
 *   - parsePromptToTitle() for title extraction
 *
 * @param db - Drizzle D1 client
 * @param titleLimit - How many titles to include (default: 10)
 * @param options - Optional settings (personaId for persona scoping)
 * @returns Gallery summary with count, images with IDs/titles, and titles array
 */
export async function getGallerySummary(
  db: DrizzleD1,
  titleLimit: number = 10,
  options: PinnedOptions = {},
): Promise<GallerySummary> {
  const personaId = await resolvePersonaId(db, options);

  // Image filter condition (shared between count and list queries)
  const imageFilter = and(
    eq(history.personaId, personaId),
    or(
      and(
        or(eq(history.type, "art_result"), eq(history.type, "user_art")),
        like(history.content, "data:image%"),
      ),
      and(
        eq(history.type, "user_video"),
        or(
          like(history.internal, "data:image%"),
          like(history.internal, "r2://%"),
        ),
      ),
    ),
    or(isNull(history.vaulted), eq(history.vaulted, 0)),
  );

  // Get count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(history)
    .where(imageFilter)
    .get();

  // Get recent images
  const imageRows = await db
    .select({
      id: history.id,
      type: history.type,
      content: history.content,
      internal: history.internal,
    })
    .from(history)
    .where(imageFilter)
    .orderBy(desc(history.createdAt))
    .limit(titleLimit)
    .all();

  const images = imageRows.map((row) => ({
    id: row.id,
    // For videos, use content as title (it's the caption). For art, parse from internal (prompt).
    title:
      row.type === "user_video"
        ? row.content || "Video from user"
        : parsePromptToTitle(row.internal),
  }));

  return {
    count: countResult?.count || 0,
    images,
    // Backward compatibility
    titles: images.map((img) => img.title),
  };
}
