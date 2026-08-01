import type { MediaBase } from '../../Media';

/**
 * Multi-frame or temporal image — GIF, animated WebP, or MP4.
 *
 * Covers anything with frames or duration: GIFs, animated WebP, video clips.
 * The `animated/` directory exists as a counterpart to `static/` for agent discoverability.
 *
 * @downstream packages/media/src/image/ImageMedia — AnimatedImage is the 'animated' variant
 * @downstream apps/web — animated image playback components, GIF gallery
 * @upstream packages/media/src/Media — AnimatedImage extends MediaBase
 * @pattern inheritance — extend MediaBase with animated-specific fields (duration, frameCount)
 * @antipattern DO NOT create separate GIF/video types — use AnimatedImage with the
 *   appropriate format. If GIF-specific logic grows, add it to animated/ helpers.
 * @tested_by packages/media/__tests__/image.test.ts
 */
export interface AnimatedImage extends MediaBase {
  kind: 'animated';
  format: 'gif' | 'webp' | 'mp4';
  width?: number;
  height?: number;
  /** Duration in seconds */
  durationSeconds?: number;
  /** Frame count (GIF/WebP) */
  frameCount?: number;
  sizeBytes?: number;
}
