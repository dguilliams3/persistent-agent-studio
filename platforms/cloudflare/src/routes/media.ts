/**
 * Media processing routes
 *
 * @module routes/media
 * @description POST endpoints for media conversion and processing.
 *
 * Handles:
 * - Video to GIF conversion for Claude vision
 * - R2 media storage and retrieval
 *
 * Note: Image generation (/imagine) remains in index.js due to complex dependencies.
 *
 * @upstream Called by: handleRequest() in index.js
 * @downstream Calls: services/media/ for Modal integration and R2 storage
 */

import {
  convertVideoToGif,
  validateVideoInput,
  createGifDataUrl,
  formatGifMetadata,
  getMedia,
  extractR2Key
} from '../services/media/index.js';
import type { Env } from '../bootstrap.js';

/**
 * @description POST /video-to-gif - Convert video to optimized animated GIF
 *
 * Accepts raw video bytes, sends to Modal for ffmpeg 2-pass conversion,
 * returns base64 GIF suitable for Claude vision API or storage.
 *
 * Uses automatic size optimization cascade to fit under 800KB:
 * 1. Try 10fps, 480px width
 * 2. If too large: 8fps, 400px
 * 3. If still too large: 6fps, 320px
 * 4. If still too large: 5fps, 256px
 *
 * @upstream Called by: Web UI video upload, potentially other clients
 * @downstream Calls: services/video.js convertVideoToGif() → Modal endpoint
 *
 * @param {Request} request - Raw request with video bytes in body
 * @param {D1Database} db - Database instance (for potential future logging)
 * @returns {Promise<Object>} Conversion result with gifBase64 or error
 *
 * @example
 *   // From frontend:
 *   const response = await fetch('/video-to-gif', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'video/mp4' },
 *     body: videoArrayBuffer
 *   });
 *   const result = await response.json();
 *   // result: { success: true, gifBase64: "...", gifSizeBytes: 312000, ... }
 */
export async function handleVideoToGif(request: Request, db: D1Database) {
  const contentType = request.headers.get('Content-Type') || '';
  const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);

  // Validate input
  const validationError = validateVideoInput(contentLength, contentType);
  if (validationError) {
    return { error: validationError, status: 400 };
  }

  // Read video bytes from request body
  let videoBytes;
  try {
    videoBytes = await request.arrayBuffer();
  } catch (err: unknown) {
    return { error: `Failed to read video data: ${err instanceof Error ? err.message : String(err)}`, status: 400 };
  }

  if (!videoBytes || videoBytes.byteLength === 0) {
    return { error: 'No video data received', status: 400 };
  }

  // Get optional parameters from headers (frontend can customize)
  const maxDuration = parseInt(request.headers.get('X-Max-Duration') || '15', 10);

  // Convert via Modal
  const result = await convertVideoToGif(videoBytes, { maxDuration });

  if (!result.success) {
    return { error: result.error, status: 422 }; // Unprocessable Entity
  }

  // Return full result with formatted metadata
  return {
    success: true,
    gifBase64: result.gifBase64,
    gifDataUrl: createGifDataUrl(result.gifBase64 ?? ''),
    gifSizeBytes: result.gifSizeBytes,
    inputDuration: result.inputDuration,
    frameCount: result.frameCount,
    dimensions: result.dimensions,
    qualityPreset: result.qualityPreset,
    metadata: formatGifMetadata(result)
  };
}

/**
 * @description GET /media/* - Serve media from R2 storage
 *
 * Retrieves media files stored in R2 bucket. Used by frontend to display
 * GIFs and images that exceeded D1's row size limit.
 *
 * @upstream Called by: Frontend img src, fetch requests
 * @downstream Calls: services/media-storage.js getMedia() → R2 bucket
 *
 * @param {Request} request - Request with path like /media/gif/abc123.gif
 * @param {Object} env - Environment with MEDIA_BUCKET binding
 * @returns {Promise<Response>} Media file or error response
 *
 * @example
 *   // Frontend: for history entries with internal = 'r2://gif/abc123.gif'
 *   <img src="/media/gif/abc123.gif" />
 */
export async function handleMediaGet(request: Request, env: Env) {
  const url = new URL(request.url);
  // Extract key from path: /media/gif/abc123.gif -> gif/abc123.gif
  const key = url.pathname.replace(/^\/media\//, '');

  if (!key) {
    return new Response(JSON.stringify({ error: 'Missing media key' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const result = await getMedia(env.MEDIA_BUCKET as R2Bucket, key);

  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.error === 'Not found' ? 404 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Return media with appropriate headers
  return new Response(result.data, {
    status: 200,
    headers: {
      'Content-Type': result.contentType ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable', // Cache forever (content-addressed)
      'Access-Control-Allow-Origin': '*',
    }
  });
}


