import type { ImageMedia } from './ImageMedia';
import type { HistoryEntry, PersonaRecord, PinnedImage } from '@persistence/db';

/**
 * Fully hydrated image aggregate for display, gallery, and admin views.
 * Composes ImageMedia with relational data from existing DB types.
 *
 * Every composed type already exists as a Drizzle InferSelectModel — no new DB types needed.
 * ImageRecord is assembled by joining across tables.
 *
 * Drilldown chain: imageRecord.persona -> who created it.
 * imageRecord.historyEntry.cycleId -> join to cycles table -> resolve via resolveModel().
 *
 * @downstream apps/web — gallery views, image detail panels, admin blurring/vaulting controls
 * @downstream packages/services — messaging handlers that attach images to Telegram/PWA responses
 * @upstream packages/media/src/image/ImageMedia — ImageRecord.media is ImageMedia
 * @upstream @persistence/db — HistoryEntry, PersonaRecord, PinnedImage composed from Drizzle inferred models
 * @pattern aggregate-root — assembles a read-side view across multiple DB tables; not for writes
 * @antipattern DO NOT create a new image-with-metadata type — compose this one.
 *   Import from @persistence/media and use it for gallery views, image details, etc.
 * @tested_by packages/media/__tests__/image.test.ts
 * @invariant pinned is null when the image is not pinned; displayCount is non-negative
 */
export interface ImageRecord {
  media: ImageMedia;
  historyEntry: HistoryEntry;
  persona: PersonaRecord;
  prompt: string;
  pinned: PinnedImage | null;
  displayCount: number;
  blurred: boolean;
  vaulted: boolean;
}
