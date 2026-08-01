import type { StaticImage } from './static/StaticImage';
import type { AnimatedImage } from './animated/AnimatedImage';

/**
 * Union of all image media types — discriminated on `kind`.
 *
 * Use `kind` to branch: 'static' for single-frame images (PNG, JPEG, WebP),
 * 'animated' for multi-frame/temporal images (GIF, animated WebP, MP4).
 *
 * @downstream packages/media/src/image/ImageRecord — ImageRecord.media is this type
 * @downstream Any component or handler that processes image binary content
 * @upstream packages/media/src/image/static/StaticImage — 'static' variant
 * @upstream packages/media/src/image/animated/AnimatedImage — 'animated' variant
 * @pattern discriminated-union — narrow via `kind` to access format-specific fields
 * @antipattern DO NOT create parallel image union types — use this one.
 *   Import from @persistence/media and narrow via `kind`.
 * @tested_by packages/media/__tests__/image.test.ts
 */
export type ImageMedia = StaticImage | AnimatedImage;
