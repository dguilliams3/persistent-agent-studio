/**
 * Gallery handler functions (image operations)
 *
 * @module @persistence/db/handlers/gallery
 * @description Pure handler functions for gallery image endpoints (blur, vault, delete, inject).
 * Accept typed params and db, return response-ready shapes.
 *
 * @upstream Called by: platforms/cloudflare/src/routes/registry.ts
 * @downstream Calls: Drizzle query builder, @persistence/db/logHistory
 */

import { eq, and, or } from 'drizzle-orm';
import type { DrizzleD1 } from '../client';
import { scopedSelect, scopedUpdate, scopedDelete } from '../scoped-query';
import { history } from '../schema/history';
import { memoryOverrides } from '../schema/memory-overrides';

import {
  logHistory,
  getPinnedImages,
  pinImage,
  unpinImage,
  swapPinnedImages,
} from '../index';

/** Body shape for art injection */
interface InjectArtBody {
  image?: string;
  internal?: string;
  prompt?: string;
}

/** Body shape for blur/vault toggle */
interface ToggleBody {
  blurred?: boolean;
  vaulted?: boolean;
}

/** Body shape for pinned images operations */
interface PinnedImagesOpBody {
  op?: string;
  slot?: number;
  image_id?: number;
  slot_a?: number;
  slot_b?: number;
}

/**
 * POST /inject-art - Inject an image as entity's art_result
 *
 * @downstream logHistory — appends art_result event with image as content
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern history-as-gallery — injected art is stored as a history event, making it appear in gallery queries
 * @antipattern Do NOT inject images that are not data URLs — caller must provide data:image/... format
 */
export async function handleInjectArt(db: DrizzleD1, body: InjectArtBody) {
  const { image, internal, prompt } = body || {};

  if (!image) {
    return { error: 'image (base64 data URL) is required', status: 400 };
  }

  if (!image.startsWith('data:image/')) {
    return { error: 'image must be a data URL (data:image/...)', status: 400 };
  }

  const internalNote = internal || prompt || 'Art generation completed';
  await logHistory({ db, type: 'art_result', content: image, internal: internalNote });

  return {
    success: true,
    message: 'Image injected as art_result',
    internal: internalNote
  };
}

/**
 * DELETE /gallery/:id - Delete an image from gallery
 *
 * @downstream Drizzle query builder — reads then deletes from history table by id
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern guarded-delete — verifies entry exists and is gallery type before deleting
 * @antipattern Do NOT delete non-gallery history entries via this handler — type check is required
 */
export async function handleDeleteGalleryImage(db: DrizzleD1, id: number) {
  const query = await scopedSelect(db, history);
  const entry = await query.where(and(
    eq(history.id, id),
    or(eq(history.type, 'art_result'), eq(history.type, 'user_art'))
  )).get();

  if (!entry) {
    return { error: 'Image not found or not a gallery image', status: 404 };
  }

  const del = await scopedDelete(db, history);
  await del.where(eq(history.id, id));
  return { success: true, deleted_id: id };
}

/**
 * POST /gallery/:id/blur - Toggle blur on gallery image
 *
 * @downstream Drizzle query builder — reads current blurred value then updates history row
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern toggle-with-explicit-override — body.blurred sets explicitly; absent body.blurred toggles current state
 * @antipattern Do NOT update blurred flag on non-gallery history entries — type check guards this operation
 *
 * @note blurred/vaulted columns are typed in Drizzle schema
 */
export async function handleToggleBlur(db: DrizzleD1, id: number, body: ToggleBody) {
  const query = await scopedSelect(db, history);
  const entry = await query.where(and(
    eq(history.id, id),
    or(eq(history.type, 'art_result'), eq(history.type, 'user_art'))
  )).get();

  if (!entry) {
    return { error: 'Image not found', status: 404 };
  }

  const newBlurred = body.blurred !== undefined ? (body.blurred ? 1 : 0) : (entry.blurred ? 0 : 1);
  const update = await scopedUpdate(db, history);
  await update.set({ blurred: newBlurred })
    .where(eq(history.id, id));

  return { success: true, id, blurred: !!newBlurred };
}

/**
 * POST /gallery/:id/vault - Toggle vault on gallery image
 *
 * @downstream Drizzle query builder — reads current vaulted value then updates history row
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern toggle-with-explicit-override — body.vaulted sets explicitly; absent body.vaulted toggles current state
 * @antipattern Do NOT use vault to hide images from research — vaulted images are excluded from default gallery but remain in DB
 *
 * @note blurred/vaulted columns are typed in Drizzle schema
 */
export async function handleToggleVault(db: DrizzleD1, id: number, body: ToggleBody) {
  const query = await scopedSelect(db, history);
  const entry = await query.where(and(
    eq(history.id, id),
    or(eq(history.type, 'art_result'), eq(history.type, 'user_art'))
  )).get();

  if (!entry) {
    return { error: 'Image not found', status: 404 };
  }

  const newVaulted = body.vaulted !== undefined ? (body.vaulted ? 1 : 0) : (entry.vaulted ? 0 : 1);
  const update = await scopedUpdate(db, history);
  await update.set({ vaulted: newVaulted })
    .where(eq(history.id, id));

  return { success: true, id, vaulted: !!newVaulted };
}

/**
 * DELETE /history/:id - Delete a history entry
 *
 * @downstream Drizzle query builder — deletes from history and cleans up memory_overrides referencing the entry
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern admin-guarded-delete — password check required; cascades to memory_overrides cleanup
 * @antipattern Do NOT delete history entries lightly — history is nominally append-only; this is an admin escape hatch only
 */
export async function handleDeleteHistoryEntry(db: DrizzleD1, id: number, password: string, adminPassword: string) {
  if (password !== adminPassword) {
    return { error: 'Invalid password', status: 401 };
  }

  const query = await scopedSelect(db, history);
  const entry = await query.where(eq(history.id, id)).get();

  if (!entry) {
    return { error: 'Entry not found', status: 404 };
  }

  const del = await scopedDelete(db, history);
  await del.where(eq(history.id, id));
  // memoryOverrides is not persona-scoped (uses branchId), keep direct query
  await db.delete(memoryOverrides)
    .where(and(
      eq(memoryOverrides.targetTable, 'history'),
      eq(memoryOverrides.targetId, id)
    ));

  return { success: true, deleted_id: id, type: entry.type };
}

/**
 * DELETE /cold-storage/:id - Delete a cold storage entry
 *
 * @downstream Drizzle query builder — deletes from cold_storage by id
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern admin-guarded-delete — password check required before deletion
 * @antipattern Do NOT delete cold storage without password verification — frozen memories are manually curated
 */
export async function handleDeleteColdStorage(db: DrizzleD1, id: string, password: string, adminPassword: string) {
  if (password !== adminPassword) {
    return { error: 'Unauthorized - invalid password', status: 401 };
  }
  const { coldStorage } = await import('../schema/cold-storage');
  const del = await scopedDelete(db, coldStorage);
  await del.where(eq(coldStorage.id, parseInt(id)));
  return { success: true };
}

/**
 * DELETE /notebook/:title - Delete a notebook entry
 *
 * @downstream deleteNote (dynamic import from @persistence/db) — removes notebook rows by title
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern admin-guarded-delete — password check required; dynamic import avoids circular dependency at module level
 * @antipattern Do NOT import deleteNote statically at the top of this file — use the dynamic import pattern to avoid circular deps
 */
export async function handleDeleteNotebook(db: DrizzleD1, title: string, password: string, adminPassword: string) {
  if (password !== adminPassword) {
    return { error: 'Unauthorized - invalid password', status: 401 };
  }
  const { deleteNote } = await import('../index');
  const decodedTitle = decodeURIComponent(title);
  const result = await deleteNote(db, decodedTitle);
  return result;
}

// --- Pinned Images ---

/**
 * GET /gallery/pins - Returns all pinned image slots
 *
 * @downstream getPinnedImages — reads pinned_images table
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern read-only-query — returns raw pin slot records
 * @antipattern Do NOT combine gallery and pin queries — pins are a separate concept from the gallery listing
 */
export async function handleGetPinnedImages(db: DrizzleD1) {
  const pins = await getPinnedImages(db);
  return { pins };
}

/**
 * POST /gallery/pins - Dispatches pin/unpin/swap operations on pinned image slots
 *
 * @downstream pinImage — assigns image_id to a slot; unpinImage — clears a slot; swapPinnedImages — exchanges two slot assignments
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern operation-dispatcher — single POST endpoint dispatches to typed operations via body.op field
 * @antipattern Do NOT add new ops without documenting them here — callers rely on knowing valid op values (pin, unpin, swap)
 */
export async function handlePinnedImagesOp(db: DrizzleD1, body: PinnedImagesOpBody) {
  const { op, slot, image_id, slot_a, slot_b } = body;

  switch (op) {
    case 'pin':
      return await pinImage(db, slot!, image_id!);
    case 'unpin':
      return await unpinImage(db, slot!);
    case 'swap':
      return await swapPinnedImages(db, slot_a!, slot_b!);
    default:
      return { error: 'Invalid op. Use: pin, unpin, swap', status: 400 };
  }
}
