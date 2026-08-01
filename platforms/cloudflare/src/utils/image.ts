/**
 * @module utils/image
 * @description Image utility functions for compression and binary data conversion
 *
 * IMPORTANT: This module provides critical helpers that MUST be used for binary data handling.
 * Using native JavaScript patterns (like spread operator) on large binary data will cause errors.
 *
 * KEY EXPORTS:
 * - bytesToBase64(Uint8Array): ALWAYS use this for binary→base64 conversion (images, audio, files)
 * - compressPngToJpeg(base64, maxDim, quality): For image compression before D1 storage
 * - resizeImage(base64, maxDim): For dimension-only resizing
 *
 * @antipattern
 * // NEVER do this for binary data - causes stack overflow on arrays >100KB:
 * btoa(String.fromCharCode(...new Uint8Array(buffer)));
 *
 * // ALWAYS do this instead:
 * import { bytesToBase64 } from './utils/image.js';
 * bytesToBase64(new Uint8Array(buffer));
 *
 * @upstream Called by: index.js (image generation, TTS), telegram/commands/voice.js
 * @downstream Calls: upng-js (PNG decoding), jpeg-js (JPEG encoding)
 *
 * Dependencies: upng-js, jpeg-js
 */

import UPNG from 'upng-js';
import jpeg from 'jpeg-js';

/**
 * @description Converts a Uint8Array to base64 string using chunked approach
 * Avoids stack overflow that occurs with spread operator on large arrays
 *
 * @param {Uint8Array} bytes - The byte array to convert
 * @returns {string} Base64 encoded string
 *
 * @example
 * // CORRECT - use this helper for any binary data (images, files, etc.)
 * const buffer = await response.arrayBuffer();
 * const base64 = bytesToBase64(new Uint8Array(buffer));
 *
 * @antipattern
 * // WRONG - spread operator causes stack overflow on large arrays (>~100KB)
 * const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
 * // This fails because Function.prototype.apply has argument limit
 *
 * @note For small strings (<100KB), the spread approach works fine.
 * Use this helper when dealing with images or any potentially large binary data.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * @description Compress a PNG base64 image to JPEG with reduced dimensions
 *
 * Uses UPNG.js for PNG decoding and jpeg-js for JPEG encoding.
 * Works in Cloudflare Workers environment (pure JS, no native deps).
 * This is critical for staying under D1's ~900KB row size limit.
 *
 * @upstream Called by: generateImage (for Cloudflare AI images), /save-art endpoint
 * @downstream Calls: UPNG.decode, UPNG.toRGBA8, jpeg.encode
 *
 * @param {string} pngBase64 - Base64 PNG data (with or without data URL prefix)
 * @param {number} [maxDimension=768] - Max width/height for output
 * @param {number} [quality=80] - JPEG quality 1-100
 * @returns {{base64: string, originalSizeKB: number, compressedSizeKB: number, width: number, height: number, error?: string}}
 *
 * @example
 * const result = compressPngToJpeg(pngBase64, 768, 80);
 * // result.base64 = "data:image/jpeg;base64,..."
 * // result.originalSizeKB = 2500, result.compressedSizeKB = 85
 *
 * @note Typical compression: 2.5MB PNG → 75-120KB JPEG
 * @note Returns original image with error property if compression fails
 */
export function compressPngToJpeg(pngBase64: string, maxDimension = 768, quality = 80): { base64: string; originalSizeKB: number; compressedSizeKB: number; width?: number; height?: number; error?: string } {
  try {
    // Strip data URL prefix if present
    const base64Data = pngBase64.replace(/^data:image\/\w+;base64,/, '');
    const pngBuffer = Buffer.from(base64Data, 'base64');
    const originalSizeKB = Math.round(pngBuffer.length / 1024);

    // Decode PNG using UPNG.js
    const png = UPNG.decode(pngBuffer);
    const width = png.width;
    const height = png.height;

    // Convert to RGBA8 format (UPNG.toRGBA8 returns array of frames, we want first frame)
    const frames = UPNG.toRGBA8(png);
    const rgbaData = new Uint8Array(frames[0]);

    // Calculate scale if needed
    let scale = 1;
    if (width > maxDimension || height > maxDimension) {
      scale = maxDimension / Math.max(width, height);
    }

    // If we need to resize, do simple nearest-neighbor scaling
    const outputWidth = Math.round(width * scale);
    const outputHeight = Math.round(height * scale);
    let outputData;

    if (scale < 1) {
      // Simple resize - sample pixels
      outputData = Buffer.alloc(outputWidth * outputHeight * 4);
      for (let y = 0; y < outputHeight; y++) {
        for (let x = 0; x < outputWidth; x++) {
          const srcX = Math.floor(x / scale);
          const srcY = Math.floor(y / scale);
          const srcIdx = (srcY * width + srcX) * 4;
          const dstIdx = (y * outputWidth + x) * 4;
          outputData[dstIdx] = rgbaData[srcIdx];       // R
          outputData[dstIdx + 1] = rgbaData[srcIdx + 1]; // G
          outputData[dstIdx + 2] = rgbaData[srcIdx + 2]; // B
          outputData[dstIdx + 3] = 255;                  // A (opaque for JPEG)
        }
      }
    } else {
      // No resize needed, just copy data
      outputData = Buffer.from(rgbaData);
    }

    // Encode as JPEG using jpeg-js
    const jpegImageData = {
      data: outputData,
      width: outputWidth,
      height: outputHeight
    };
    const jpegBuffer = jpeg.encode(jpegImageData, quality);
    const compressedBase64 = `data:image/jpeg;base64,${jpegBuffer.data.toString('base64')}`;
    const compressedSizeKB = Math.round(jpegBuffer.data.length / 1024);

    console.log(`Image compression: ${originalSizeKB}KB PNG → ${compressedSizeKB}KB JPEG (${outputWidth}x${outputHeight}, q${quality})`);

    return {
      base64: compressedBase64,
      originalSizeKB,
      compressedSizeKB,
      width: outputWidth,
      height: outputHeight
    };
  } catch (e) {
    console.error('Image compression failed:', e);
    // Return original if compression fails
    return {
      base64: pngBase64.startsWith('data:') ? pngBase64 : `data:image/png;base64,${pngBase64}`,
      originalSizeKB: Math.round(pngBase64.length / 1024),
      compressedSizeKB: Math.round(pngBase64.length / 1024),
      error: (e as Error).message
    };
  }
}

/**
 * @description Resize any image (PNG or JPEG) to a smaller thumbnail size
 *
 * Works in Cloudflare Workers environment (pure JS, no native deps).
 * Primarily used for creating profile picture thumbnails and gallery previews.
 * Always outputs JPEG regardless of input format for consistent sizing.
 *
 * @upstream Called by: /profile-pic endpoint, gallery thumbnail generation
 * @downstream Calls: UPNG.decode, jpeg.decode, jpeg.encode
 *
 * @param {string} imageBase64 - Base64 image data (must have data URL prefix like "data:image/png;base64,...")
 * @param {number} [maxDimension=256] - Max width/height for output thumbnail
 * @param {number} [quality=70] - JPEG quality 1-100
 * @returns {{base64: string, width: number, height: number, error?: string}} Resized JPEG base64 data URL
 *
 * @example
 * const result = resizeImage(fullSizeImage, 256, 70);
 * // result.base64 = "data:image/jpeg;base64,..."
 * // result.width = 256, result.height = 192 (maintains aspect ratio)
 *
 * @note Input MUST have data URL prefix - returns error object if missing
 * @note Supports PNG and JPEG input formats only
 */
export function resizeImage(imageBase64: string, maxDimension = 256, quality = 70): { base64: string; width: number; height: number; error?: string } {
  try {
    // Detect image type from data URL prefix
    const match = imageBase64.match(/^data:image\/([^;]+);base64,(.+)$/);
    if (!match) {
      return { base64: imageBase64, width: 0, height: 0, error: 'Invalid base64 format' };
    }

    const imageType = match[1].toLowerCase();
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');

    let width, height, rgbaData;

    if (imageType === 'png') {
      // Decode PNG using UPNG.js
      const png = UPNG.decode(buffer);
      width = png.width;
      height = png.height;
      const frames = UPNG.toRGBA8(png);
      rgbaData = new Uint8Array(frames[0]);
    } else if (imageType === 'jpeg' || imageType === 'jpg') {
      // Decode JPEG using jpeg-js
      const jpegData = jpeg.decode(buffer);
      width = jpegData.width;
      height = jpegData.height;
      rgbaData = jpegData.data;
    } else {
      return { base64: imageBase64, width: 0, height: 0, error: `Unsupported image type: ${imageType}` };
    }

    // Calculate scale
    let scale = 1;
    if (width > maxDimension || height > maxDimension) {
      scale = maxDimension / Math.max(width, height);
    }

    const outputWidth = Math.round(width * scale);
    const outputHeight = Math.round(height * scale);
    let outputData;

    if (scale < 1) {
      // Resize using nearest-neighbor sampling
      outputData = Buffer.alloc(outputWidth * outputHeight * 4);
      for (let y = 0; y < outputHeight; y++) {
        for (let x = 0; x < outputWidth; x++) {
          const srcX = Math.floor(x / scale);
          const srcY = Math.floor(y / scale);
          const srcIdx = (srcY * width + srcX) * 4;
          const dstIdx = (y * outputWidth + x) * 4;
          outputData[dstIdx] = rgbaData[srcIdx];       // R
          outputData[dstIdx + 1] = rgbaData[srcIdx + 1]; // G
          outputData[dstIdx + 2] = rgbaData[srcIdx + 2]; // B
          outputData[dstIdx + 3] = 255;                  // A (opaque for JPEG)
        }
      }
    } else {
      // No resize needed
      outputData = Buffer.from(rgbaData);
    }

    // Encode as JPEG
    const jpegImageData = { data: outputData, width: outputWidth, height: outputHeight };
    const jpegBuffer = jpeg.encode(jpegImageData, quality);
    const resizedBase64 = `data:image/jpeg;base64,${jpegBuffer.data.toString('base64')}`;

    console.log(`Image resize: ${width}x${height} → ${outputWidth}x${outputHeight}`);
    return { base64: resizedBase64, width: outputWidth, height: outputHeight };
  } catch (e) {
    console.error('Image resize failed:', e);
    return { base64: imageBase64, width: 0, height: 0, error: (e as Error).message };
  }
}
