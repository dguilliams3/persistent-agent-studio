/**
 * Image generation service — native Cloudflare Workers AI
 *
 * @module services/media/images
 * @description Generates images using Cloudflare Workers AI
 * (@cf/stabilityai/stable-diffusion-xl-base-1.0).
 *
 * All generated images are automatically compressed from PNG to JPEG
 * to fit within D1's ~900KB row limit.
 *
 * @upstream Called by:
 *   - executeActions() in index.js for MAKE_ART action
 *   - /image and /imagine Telegram command handlers
 *   - /imagine API endpoint
 *
 * @downstream Calls:
 *   - Cloudflare Workers AI binding (env.AI)
 *   - bytesToBase64, compressPngToJpeg from utils/image.js
 */

import { bytesToBase64, compressPngToJpeg } from '../../utils/image.js';
import { IMAGE_COMPRESSION, DEFAULT_NEGATIVE_PROMPT } from '../../constants.js';
import type { Env } from '../../bootstrap.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
// The Workers AI binding returns varying response shapes.
// Using 'any' for API response bodies is appropriate here.
// =============================================================================
// IMAGE GENERATION
// =============================================================================
// Native Cloudflare Workers AI is the sole image provider.
// =============================================================================

/**
 * @description Generates an image using Cloudflare Workers AI
 *
 * Main entry point for image generation. All prompts run through the
 * native Workers AI model (@cf/stabilityai/stable-diffusion-xl-base-1.0).
 *
 * Workers AI returns images in various formats (ReadableStream, ArrayBuffer,
 * Uint8Array, or object). This function handles all cases and compresses the
 * result to JPEG for storage efficiency.
 *
 * @upstream Called by: MAKE_ART action executor, /image command, /imagine API
 * @downstream Calls: env.AI.run
 *
 * @param {string} prompt - Text description of the image to generate
 * @param {Object} env - Environment object containing the AI binding
 * @param {Object} env.AI - Cloudflare Workers AI binding
 * @returns {Promise<{success: boolean, base64?: string, error?: string, provider?: string}>}
 *
 * @example
 * const result = await generateImage('a sunset over mountains', env);
 * if (result.success) {
 *   // result.base64 contains "data:image/jpeg;base64,..." (compressed)
 *   // result.provider is 'cloudflare'
 * }
 *
 * @note Images are compressed to ~100-300KB JPEG to fit D1 row limits (~900KB).
 *       Original PNG can be 2-3MB before compression.
 */
export async function generateImage(prompt: string, env: Env) {
  try {
    // Use Cloudflare Workers AI for image generation
    const response = await (env.AI as any).run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
      prompt: prompt,
      negative_prompt: DEFAULT_NEGATIVE_PROMPT
    });

    // Debug: log response type
    console.log('AI response type:', typeof response, response?.constructor?.name);
    console.log('AI response keys:', response ? Object.keys(response) : 'null');

    // Response could be ReadableStream, ArrayBuffer, or object with image property
    let imageData;

    if (response instanceof ReadableStream) {
      // It's a stream, read it
      const reader = response.getReader();
      const chunks = [];
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
    } else if (response && response.image) {
      // Some models return { image: base64string }
      if (typeof response.image === 'string') {
        const base64 = response.image.startsWith('data:') ? response.image : `data:image/png;base64,${response.image}`;
        return { success: true, base64, provider: 'cloudflare' };
      }
      imageData = new Uint8Array(response.image);
    } else {
      // Try treating it as raw bytes
      imageData = new Uint8Array(response);
    }

    const base64 = bytesToBase64(imageData);

    if (!base64 || base64.length < 100) {
      console.log('Base64 too short:', base64?.length, 'imageData length:', imageData?.length);
      return { success: false, error: 'Image data too small or empty', provider: 'cloudflare' };
    }

    const pngBase64 = `data:image/png;base64,${base64}`;

    // Compress PNG to JPEG to fit in D1 storage (max ~900KB)
    const compressed = compressPngToJpeg(pngBase64, IMAGE_COMPRESSION.maxDimension, IMAGE_COMPRESSION.jpegQuality);

    if (compressed.error) {
      console.warn('Compression failed, using original PNG:', compressed.error);
      return { success: true, base64: pngBase64, provider: 'cloudflare' };
    }

    console.log('[Cloudflare] Image generated successfully');
    return { success: true, base64: compressed.base64, provider: 'cloudflare' };
  } catch (e: unknown) {
    console.error('Image generation error:', e);
    return { success: false, error: e instanceof Error ? e.message : String(e), provider: 'cloudflare' };
  }
}
