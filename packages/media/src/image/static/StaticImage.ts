import type { MediaBase } from '../../Media';

/**
 * Single-frame image — PNG, JPEG, or WebP.
 *
 * Base type for all static images. Domain subtypes (Photo, ArtImage) extend this
 * to add origin-specific metadata while inheriting format and storage fields.
 *
 * @downstream packages/media/src/image/static/Photo — extends StaticImage for camera captures
 * @downstream packages/media/src/image/static/ArtImage — extends StaticImage for AI-generated art
 * @downstream packages/media/src/image/ImageMedia — StaticImage is the 'static' variant of ImageMedia
 * @upstream packages/media/src/Media — StaticImage extends MediaBase
 * @pattern inheritance — extend to add origin-specific metadata without duplicating format/storage fields
 * @antipattern DO NOT create new static image types that don't extend this.
 *   If you need image metadata, extend StaticImage — don't create a parallel type.
 * @tested_by packages/media/__tests__/image.test.ts
 */
export interface StaticImage extends MediaBase {
  kind: 'static';
  format: 'png' | 'jpeg' | 'webp';
  width?: number;
  height?: number;
  /** Byte count of the encoded image */
  sizeBytes?: number;
}
