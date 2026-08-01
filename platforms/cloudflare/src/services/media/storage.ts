/**
 * R2 Media Storage Service
 *
 * @module services/media/storage
 * @description Handles storage and retrieval of media files (GIFs, images) in R2.
 *   Used when media exceeds D1's row size limit (~900KB).
 *
 * @upstream Called by:
 *   - index.js - when storing video GIFs
 *   - routes/media.js - when serving stored media
 * @downstream Calls:
 *   - Cloudflare R2 bucket (env.MEDIA_BUCKET)
 */

/**
 * @description Generate a unique key for media storage.
 *
 * @param {string} type - Media type (e.g., 'gif', 'image')
 * @param {string} [extension='gif'] - File extension
 * @returns {string} Unique key like 'gif/20260119-223045-abc123.gif'
 */
export function generateMediaKey(type: string, extension = 'gif'): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const random = Math.random().toString(36).substring(2, 8);
  return `${type}/${timestamp}-${random}.${extension}`;
}

/**
 * @description Store media bytes in R2 bucket.
 *
 * @upstream Called by: Telegram video handler, /video-to-gif endpoint
 * @downstream Calls: R2 bucket put()
 *
 * @param {R2Bucket} bucket - R2 bucket binding (env.MEDIA_BUCKET)
 * @param {string} key - Storage key (use generateMediaKey())
 * @param {ArrayBuffer|Uint8Array} data - Media bytes
 * @param {Object} [metadata={}] - Optional metadata to store with file
 * @returns {Promise<{success: boolean, key?: string, error?: string}>}
 *
 * @example
 *   const key = generateMediaKey('gif');
 *   const result = await storeMedia(env.MEDIA_BUCKET, key, gifBytes, {
 *     duration: '4.2s',
 *     source: 'telegram'
 *   });
 *   // Store key in D1: internal = `r2://${key}`
 */
export async function storeMedia(
  bucket: R2Bucket,
  key: string,
  data: ArrayBuffer | Uint8Array,
  metadata: Record<string, string> = {}
) {
  try {
    await bucket.put(key, data, {
      httpMetadata: {
        contentType: key.endsWith('.gif') ? 'image/gif' : 'application/octet-stream',
      },
      customMetadata: metadata,
    });

    return { success: true, key };
  } catch (err) {
    console.error('R2 store error:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * @description Retrieve media from R2 bucket.
 *
 * @upstream Called by: /media/:key endpoint, frontend media fetcher
 * @downstream Calls: R2 bucket get()
 *
 * @param {R2Bucket} bucket - R2 bucket binding (env.MEDIA_BUCKET)
 * @param {string} key - Storage key (without r2:// prefix)
 * @returns {Promise<{success: boolean, data?: ArrayBuffer, contentType?: string, metadata?: Object, error?: string}>}
 *
 * @example
 *   const result = await getMedia(env.MEDIA_BUCKET, 'gif/20260119-223045-abc123.gif');
 *   if (result.success) {
 *     return new Response(result.data, {
 *       headers: { 'Content-Type': result.contentType }
 *     });
 *   }
 */
export async function getMedia(bucket: R2Bucket, key: string) {
  try {
    const object = await bucket.get(key);

    if (!object) {
      return { success: false, error: 'Not found' };
    }

    const data = await object.arrayBuffer();

    return {
      success: true,
      data,
      contentType: object.httpMetadata?.contentType || 'application/octet-stream',
      metadata: object.customMetadata || {},
    };
  } catch (err) {
    console.error('R2 get error:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * @description Delete media from R2 bucket.
 *
 * @upstream Called by: cleanup routines, admin endpoints
 * @downstream Calls: R2 bucket delete()
 *
 * @param {R2Bucket} bucket - R2 bucket binding (env.MEDIA_BUCKET)
 * @param {string} key - Storage key (without r2:// prefix)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteMedia(bucket: R2Bucket, key: string) {
  try {
    await bucket.delete(key);
    return { success: true };
  } catch (err) {
    console.error('R2 delete error:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * @description Check if an internal value is an R2 reference.
 *
 * @param {string} internal - The internal field value from history
 * @returns {boolean} True if it's an R2 reference (starts with 'r2://')
 */
export function isR2Reference(internal: string | null | undefined): boolean {
  return internal?.startsWith('r2://') ?? false;
}

/**
 * @description Extract R2 key from internal reference.
 *
 * @param {string} internal - The internal field value (e.g., 'r2://gif/abc123.gif')
 * @returns {string} The key without prefix (e.g., 'gif/abc123.gif')
 */
export function extractR2Key(internal: string | null | undefined): string | null {
  if (!isR2Reference(internal)) {
    return null;
  }
  return (internal as string).slice(5); // Remove 'r2://'
}

/**
 * @description Create an R2 reference string for storage in D1.
 *
 * @param {string} key - The R2 storage key
 * @returns {string} Reference string like 'r2://gif/abc123.gif'
 */
export function createR2Reference(key: string): string {
  return `r2://${key}`;
}

/**
 * @description Store GIF media with appropriate strategy (R2 for large, base64 for small).
 *   This is the DRY helper that replaces inline R2 code throughout the codebase.
 *
 * @upstream Called by:
 *   - index.js - Telegram video/animation handling
 *   - routes/media.js - /video-to-gif endpoint
 * @downstream Calls:
 *   - storeMedia() - R2 storage
 *   - createR2Reference() - reference generation
 *
 * @param {R2Bucket} bucket - R2 bucket binding (env.MEDIA_BUCKET)
 * @param {string} gifBase64 - Base64-encoded GIF data (from Modal or other source)
 * @param {Object} [options={}] - Metadata options
 * @param {string} [options.source] - Source identifier ('telegram-video', 'telegram-animation', 'web-upload')
 * @param {number|string} [options.duration] - Video/GIF duration in seconds
 * @param {string} [options.quality] - Quality preset used ('high', 'medium', 'low', etc.)
 * @returns {Promise<{success: boolean, reference?: string, sizeBytes?: number, error?: string}>}
 *
 * @example
 *   const result = await storeGifMedia(env.MEDIA_BUCKET, gifBase64, {
 *     source: 'telegram-video',
 *     duration: 4.2,
 *     quality: 'medium'
 *   });
 *   if (result.success) {
 *     // Store result.reference in D1 (e.g., 'r2://gif/20260119-223045-abc123.gif')
 *     internalValue = result.reference;
 *   }
 */
export async function storeGifMedia(
  bucket: R2Bucket,
  gifBase64: string,
  options: { source?: string; duration?: number | string; quality?: string } = {}
) {
  const { source = 'unknown', duration, quality } = options;

  try {
    // Decode base64 to bytes
    const gifBytes = Uint8Array.from(atob(gifBase64), c => c.charCodeAt(0));

    // Generate unique key
    const key = generateMediaKey('gif');

    // Build metadata
    const metadata: Record<string, string> = {
      source,
    };
    if (duration !== undefined) {
      metadata.duration = String(duration);
    }
    if (quality) {
      metadata.quality = quality;
    }

    // Store in R2
    const result = await storeMedia(bucket, key, gifBytes, metadata);

    if (!result.success || !result.key) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      reference: createR2Reference(result.key),
      sizeBytes: gifBytes.length,
    };
  } catch (err) {
    console.error('storeGifMedia error:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
