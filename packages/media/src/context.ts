/**
 * Media Context DTOs — lightweight data transfer objects for prompt assembly.
 *
 * @module @persistence/media/context
 * @description These types carry base64 image data + minimal metadata through the
 * system prompt assembly pipeline. They are NOT the rich domain types (Photo, ArtImage) —
 * they are wire-format DTOs optimized for the Anthropic API content blocks.
 *
 * The domain types describe WHAT the media IS (format, source, storage).
 * Context DTOs describe WHAT TO INJECT into a prompt (base64 data + display metadata).
 *
 * @upstream packages/memory — context builder assembles these from history entries
 * @upstream packages/runtime — orchestrator passes these to content assembly
 * @downstream Anthropic API user content blocks
 *
 * @antipattern DO NOT create new image-for-prompt types — use these.
 *   If you need richer data, compose with domain types from @persistence/media.
 * @antipattern DO NOT add domain fields (source, storage, format) to these types —
 *   they are intentionally minimal for prompt injection.
 * @antipattern DO NOT look for PinnedImageContext here — it is not a media context DTO.
 *   PinnedImageContext (slot + title, no base64) is a DB layer type owned by
 *   @persistence/db/pinned and exported from @persistence/db.
 */

/**
 * User-sent image for context injection.
 *
 * Carries the base64 data and timestamp needed to include a user photo
 * in the Anthropic API user message.
 */
export interface UserImage {
  /** Human-readable timestamp */
  time: string;
  /** Base64 data URL (data:image/...) */
  image: string;
  /** Associated text from the user message */
  text: string;
}

/**
 * AI-generated art image for context injection.
 *
 * Carries the base64 data, timestamp, and prompt needed to include
 * generated art in the system prompt's visual memory section.
 */
export interface ClaudeArtImage {
  /** Human-readable timestamp */
  time: string;
  /** Base64 data URL (data:image/...) */
  image: string;
  /** The generation prompt */
  prompt: string;
}

/**
 * User image data for orchestrator pipeline.
 *
 * Equivalent to UserImage but with optional text field,
 * used in the runtime orchestrator layer.
 */
export interface ImageData {
  /** Base64 data URL (data:image/...) */
  image: string;
  /** Human-readable timestamp */
  time: string;
  /** Associated text (optional in orchestrator context) */
  text?: string;
}

/**
 * Art image data for orchestrator pipeline.
 *
 * Equivalent to ClaudeArtImage, used in the runtime orchestrator layer.
 */
export interface ArtImageData {
  /** Base64 data URL (data:image/...) */
  image: string;
  /** Human-readable timestamp */
  time: string;
  /** The generation prompt */
  prompt: string;
}

/**
 * Pending view image data for orchestrator pipeline.
 *
 * Represents an image that was requested for viewing but not yet displayed.
 */
export interface ViewImageData {
  /** Reference to history entry ID */
  image_id: number;
  /** Base64 image data (may be absent if not yet loaded) */
  image?: string;
  /** Image prompt/description */
  prompt?: string;
}
