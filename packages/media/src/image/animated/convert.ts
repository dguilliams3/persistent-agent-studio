import type { AnimatedImage } from './AnimatedImage';
import type { StaticImage } from '../static/StaticImage';

/**
 * Animated image conversion pipeline — platform-implemented.
 *
 * Defines the contract for converting between animated and static formats
 * (e.g., extracting a frame from a GIF, converting MP4 to GIF).
 * Platform layer implements this using ffmpeg, sharp, or equivalent.
 *
 * @downstream platforms/cloudflare — Cloudflare Worker implements this using Workers AI or external service
 * @upstream packages/media/src/image/animated/AnimatedImage — accepts AnimatedImage as input
 * @upstream packages/media/src/image/static/StaticImage — produces StaticImage as output (extractFrame)
 * @pattern interface-segregation — packages define the contract; platforms supply the implementation
 * @antipattern DO NOT implement conversion logic directly in domain code — implement this interface
 *   and register with the conversion pipeline. Conversion is platform-specific but the contract is shared.
 * @tested_by packages/media/__tests__/convert.test.ts
 */
export interface ConversionPipeline {
  /** Extract a single frame from an animated image as a static image */
  extractFrame(source: AnimatedImage, frameIndex?: number): Promise<StaticImage>;
  /** Convert an animated image to a different animated format */
  transcode(source: AnimatedImage, targetFormat: AnimatedImage['format']): Promise<AnimatedImage>;
  /** Check if a conversion path is supported by this implementation */
  supportsConversion(sourceFormat: AnimatedImage['format'], targetFormat: string): boolean;
}
