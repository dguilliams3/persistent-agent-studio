/**
 * Cloudflare AI Image Generation Provider
 *
 * @module @persistence/services/image_generation/cloudflare
 * @description Cloudflare Workers AI image generation implementation.
 *
 * Uses @cf/stabilityai/stable-diffusion-xl-base-1.0 model.
 * Free to use, but content-filtered.
 *
 * @upstream Called by: Platform handlers via ImageService interface
 * @downstream Calls: Cloudflare AI binding (env.AI)
 */

import {
  type ServiceResult,
  failure,
  success,
} from '../core/types.js';
import type {
  ImageService,
  ImageOptions,
  ImageResult,
  CloudflareAIBinding,
  CloudflareImageConfig,
} from './types.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const SDXL_MODEL = '@cf/stabilityai/stable-diffusion-xl-base-1.0';

const DEFAULT_NEGATIVE_PROMPT =
  'ugly, blurry, low quality, distorted, disfigured, bad anatomy, watermark, text';

// =============================================================================
// PROVIDER IMPLEMENTATION
// =============================================================================

/**
 * Cloudflare AI image generation provider.
 *
 * @example
 * const image = new CloudflareAIProvider(env.AI);
 * const result = await image.generate('a sunset');
 */
export class CloudflareAIProvider implements ImageService {
  private readonly ai: CloudflareAIBinding;
  private readonly defaultNegativePrompt: string;

  constructor(ai: CloudflareAIBinding, config: CloudflareImageConfig = {}) {
    this.ai = ai;
    this.defaultNegativePrompt = config.defaultNegativePrompt ?? DEFAULT_NEGATIVE_PROMPT;
  }

  getProviderName(): string {
    return 'cloudflare';
  }

  /**
   * Generate an image using Cloudflare Workers AI.
   *
   * Response can be ReadableStream, ArrayBuffer, Uint8Array, or object.
   */
  async generate(
    prompt: string,
    options: ImageOptions = {}
  ): Promise<ServiceResult<ImageResult>> {
    try {
      const negativePrompt = options.negativePrompt ?? this.defaultNegativePrompt;

      const response = await this.ai.run(SDXL_MODEL, {
        prompt,
        negative_prompt: negativePrompt,
      });

      // Handle various response formats
      let imageData: Uint8Array;

      if (response instanceof ReadableStream) {
        // Read stream to bytes
        const reader = response.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        imageData = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          imageData.set(chunk, offset);
          offset += chunk.length;
        }
      } else if (response instanceof ArrayBuffer) {
        imageData = new Uint8Array(response);
      } else if (response instanceof Uint8Array) {
        imageData = response;
      } else if (response && typeof response === 'object' && 'image' in response) {
        // Some models return { image: base64string | ArrayBuffer }
        const image = (response as { image: string | ArrayBuffer }).image;
        if (typeof image === 'string') {
          const base64 = image.startsWith('data:') ? image : `data:image/png;base64,${image}`;
          return success({
            base64,
            format: 'image/png',
            provider: 'cloudflare',
          });
        }
        imageData = new Uint8Array(image);
      } else {
        // Try treating as raw bytes
        imageData = new Uint8Array(response as ArrayBuffer);
      }

      const base64 = this.arrayBufferToBase64(imageData);

      if (!base64 || base64.length < 100) {
        return failure('SERVICE_ERROR', 'Image data too small or empty');
      }

      return success({
        base64: `data:image/png;base64,${base64}`,
        format: 'image/png',
        provider: 'cloudflare',
      });
    } catch (err) {
      return failure(
        'NETWORK_ERROR',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  /**
   * Convert Uint8Array to base64 string.
   */
  private arrayBufferToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
