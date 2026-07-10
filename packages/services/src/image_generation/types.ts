/**
 * Image Generation Types - Image creation capability interfaces
 *
 * @module @persistence/services/image_generation/types
 * @description Types for image generation service providers.
 *
 * Supports multiple providers (Replicate, Cloudflare AI, Pony Studio)
 * with different capabilities and pricing.
 */

import type { ServiceResult, AsyncJob, HttpOptions } from '../core/types.js';

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

/**
 * Image generation service interface.
 *
 * All image providers must implement this interface.
 *
 * @example
 * const image: ImageService = new ReplicateProvider(apiKey, 'flux-schnell');
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

/**
 * Extended image service with async job support.
 *
 * Some providers (like Replicate) support async generation
 * with job polling.
 */
export interface AsyncImageService extends ImageService {
  /**
   * Start image generation and return job handle.
   */
  startGeneration(prompt: string, options?: ImageOptions): Promise<ServiceResult<AsyncJob<ImageResult>>>;

  /**
   * Check status of a generation job.
   */
  checkJob(jobId: string): Promise<ServiceResult<AsyncJob<ImageResult>>>;

  /**
   * Cancel a pending job.
   */
  cancelJob?(jobId: string): Promise<ServiceResult<void>>;
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
 * Replicate model configuration.
 */
export interface ReplicateModelConfig {
  /** Model identifier (e.g., 'black-forest-labs/flux-schnell') */
  modelId: string;
  /** Model version hash (optional for official models) */
  version?: string;
  /** Display name */
  name: string;
  /** Provider identifier for results */
  provider: string;
  /** Default image dimensions */
  defaultWidth?: number;
  defaultHeight?: number;
  /** Max wait time for sync requests */
  maxWaitSeconds?: number;
  /** Supports safety checker toggle */
  supportsSafetyToggle?: boolean;
  /** Default compression settings */
  compression?: {
    maxDimension: number;
    quality: number;
  };
}

/**
 * Built-in Replicate model configurations.
 */
export const REPLICATE_MODELS: Record<string, ReplicateModelConfig> = {
  'flux-schnell': {
    modelId: 'black-forest-labs/flux-schnell',
    name: 'FLUX Schnell',
    provider: 'replicate-flux-schnell',
    defaultWidth: 1024,
    defaultHeight: 1024,
    maxWaitSeconds: 60,
    supportsSafetyToggle: true,
    compression: { maxDimension: 1024, quality: 0.85 },
  },
  'flux-dev': {
    modelId: 'black-forest-labs/flux-dev',
    name: 'FLUX Dev',
    provider: 'replicate-flux-dev',
    defaultWidth: 1024,
    defaultHeight: 1024,
    maxWaitSeconds: 120,
    supportsSafetyToggle: true,
    compression: { maxDimension: 1024, quality: 0.85 },
  },
  'sdxl': {
    modelId: 'stability-ai/sdxl',
    version: '7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc',
    name: 'SDXL',
    provider: 'replicate-sdxl',
    defaultWidth: 1024,
    defaultHeight: 1024,
    maxWaitSeconds: 90,
    supportsSafetyToggle: true,
    compression: { maxDimension: 1024, quality: 0.85 },
  },
};

/**
 * Replicate provider configuration.
 */
export interface ReplicateConfig {
  /** Replicate API token */
  apiToken: string;
  /** Model to use (key from REPLICATE_MODELS or custom config) */
  model: string | ReplicateModelConfig;
  /** Default options for all generations */
  defaultOptions?: Partial<ImageOptions>;
}

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

/**
 * Pony Studio configuration.
 */
export interface PonyStudioConfig {
  /** Base URL (Cloudflare Tunnel endpoint) */
  baseUrl: string;
  /** Admin username */
  username: string;
  /** Admin password */
  password: string;
  /** Generation timeout (ms) */
  timeout?: number;
  /** Compression settings */
  compression?: {
    maxDimension: number;
    quality: number;
  };
}

/**
 * Pony Studio preset categories.
 */
export interface PonyPresets {
  position: Record<string, string>;
  body_type: Record<string, string>;
  hair_color: Record<string, string>;
  expression: Record<string, string>;
  setting: Record<string, string>;
  ethnicity: Record<string, string>;
  fantasy: Record<string, string>;
  aesthetic: Record<string, string>;
  style: Record<string, string>;
}
