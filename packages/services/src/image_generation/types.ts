/**
 * Image Generation Types - Image creation capability interfaces
 *
 * @module @persistence/services/image_generation/types
 * @description Types for image generation service providers.
 *
 * Image generation runs on native Cloudflare Workers AI (@cf/ models).
 */

import type { ServiceResult, HttpOptions } from '../core/types.js';

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

/**
 * Image generation service interface.
 *
 * All image providers must implement this interface.
 *
 * @example
 * const image: ImageService = new CloudflareAIProvider(env.AI);
 * const result = await image.generate('a sunset over mountains');
 */
export interface ImageService {
  /**
   * Generate an image from a text prompt.
   *
   * @param prompt - Text description of the image
   * @param options - Generation options
   * @returns Image data as base64 or URL
   */
  generate(prompt: string, options?: ImageOptions): Promise<ServiceResult<ImageResult>>;

  /**
   * Get provider name/identifier.
   */
  getProviderName(): string;
}

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Options for image generation.
 */
export interface ImageOptions extends HttpOptions {
  /** Output width in pixels */
  width?: number;
  /** Output height in pixels */
  height?: number;
  /** Aspect ratio (overrides width/height) */
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '2:3' | '3:2';
  /** Negative prompt (what to avoid) */
  negativePrompt?: string;
  /** Number of inference steps */
  steps?: number;
  /** Guidance scale (how closely to follow prompt) */
  guidance?: number;
  /** Random seed for reproducibility */
  seed?: number;
  /** Number of images to generate */
  numOutputs?: number;
  /** Disable safety checker (where supported) */
  disableSafety?: boolean;
  /** Output format */
  outputFormat?: 'png' | 'jpeg' | 'webp';
  /** JPEG/WebP quality (0-100) */
  quality?: number;
  /** Scheduler for diffusion (provider-specific) */
  scheduler?: string;
  /** Model-specific settings */
  modelSettings?: Record<string, unknown>;
}

/**
 * Result from image generation.
 */
export interface ImageResult {
  /** Base64-encoded image data (data:image/...) */
  base64?: string;
  /** URL to generated image (if hosted) */
  url?: string;
  /** Image format */
  format: string;
  /** Image width */
  width?: number;
  /** Image height */
  height?: number;
  /** Generation seed used */
  seed?: number;
  /** Provider that generated the image */
  provider: string;
  /** Time taken to generate (ms) */
  generationTimeMs?: number;
}

// =============================================================================
// PROVIDER-SPECIFIC TYPES
// =============================================================================

/**
 * Cloudflare AI provider configuration.
 */
export interface CloudflareImageConfig {
  /** Default negative prompt */
  defaultNegativePrompt?: string;
  /** Compression settings */
  compression?: {
    maxDimension: number;
    quality: number;
  };
}

/**
 * Cloudflare AI binding interface (subset needed for image generation).
 */
export interface CloudflareAIBinding {
  run(
    model: string,
    inputs: { prompt: string; negative_prompt?: string }
  ): Promise<ReadableStream | ArrayBuffer | Uint8Array | { image?: string | ArrayBuffer }>;
}
