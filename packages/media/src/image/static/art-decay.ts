/**
 * Art Visibility Decay
 *
 * @module @persistence/media/image/static/art-decay
 * @description Manages the visibility window for AI-generated art.
 * Recent images are shown as actual multimodal content; older ones "decay"
 * to text placeholders — simulating the fading of visual memory over time.
 *
 * @upstream Called by: user content assembly in runThinkingCycle
 * @downstream Pure functions, no dependencies
 * @antipattern DO NOT create alternative decay/freshness logic — extend this module.
 */

import type { ArtImage } from './ArtImage';

/** An art image with display metadata for context assembly */
export interface ArtImageDisplay {
  /** Base64 data URL (data:image/...) */
  image: string;
  /** Human-readable timestamp */
  time: string;
  /** The generation prompt */
  prompt: string;
}

/** Result of splitting art into visible and decayed groups */
export interface ArtDecayResult {
  /** Recent images shown as multimodal content (newest) */
  visibleArt: ArtImageDisplay[];
  /** Older images shown as text placeholders only (oldest) */
  decayedArt: ArtImageDisplay[];
  /** Total number of art images */
  totalCount: number;
}

/**
 * Split art images into visible (recent) and decayed (older) groups.
 *
 * Images are assumed to be ordered oldest-first. The last `maxVisible`
 * images are shown as actual content; the rest decay to text placeholders.
 *
 * @param artImages - All art images, ordered oldest-first
 * @param maxVisible - Maximum number of images to show as actual content
 * @returns Visible and decayed image groups
 *
 * @example
 * const { visibleArt, decayedArt } = splitArtByDecay(claudeArtImages, 5);
 * // visibleArt: last 5 images (shown as multimodal)
 * // decayedArt: everything before that (shown as text only)
 */
export function splitArtByDecay(
  artImages: ArtImageDisplay[],
  maxVisible: number
): ArtDecayResult {
  const totalCount = artImages.length;
  const visibleArt = artImages.slice(-maxVisible);
  const decayedArt = artImages.slice(0, Math.max(0, totalCount - maxVisible));

  return { visibleArt, decayedArt, totalCount };
}

/**
 * Default maximum number of visible art images.
 *
 * Configurable via state key `max_visible_images`. This default is used
 * when no stored preference exists.
 */
export const DEFAULT_MAX_VISIBLE_IMAGES = 5;
