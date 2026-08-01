/**
 * Video-to-GIF Service - Modal Integration
 *
 * @module services/media/video
 * @description Calls Modal endpoint to convert video to optimized GIF.
 *   Handles the video-to-GIF conversion for both Telegram and Web UI uploads.
 *   Uses intelligent size optimization cascade to fit within D1 limits.
 *
 * @upstream Called by:
 *   - index.js - when video message received via Telegram
 *   - routes/media.js - when video uploaded via /video-to-gif endpoint
 * @downstream Calls:
 *   - Modal endpoint (configured via MODAL_VIDEO_URL / MODAL_VIDEO_HEALTH_URL)
 */

/**
 * @description Read an environment override without requiring `@types/node`.
 *   Works under both Node and Cloudflare Workers (`nodejs_compat` exposes
 *   `globalThis.process.env`).
 */
function envOverride(key: string): string | undefined {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
    key
  ];
}

/**
 * Modal endpoint URLs for video-to-gif conversion.
 * @note Placeholders — this Modal deployment is not public. Set MODAL_VIDEO_URL
 *   and MODAL_VIDEO_HEALTH_URL in your environment to point at your own Modal
 *   deployment before use.
 */
const MODAL_CONVERT_URL = envOverride('MODAL_VIDEO_URL') ?? 'https://your-modal-endpoint.modal.run';
const MODAL_HEALTH_URL =
  envOverride('MODAL_VIDEO_HEALTH_URL') ?? 'https://your-modal-endpoint.modal.run';

/**
 * Default conversion options.
 * Note: maxDuration here is a fallback - actual value comes from VIDEO_CONFIG or state.
 * fps/width can be null to let Modal use its automatic cascade.
 */
const DEFAULT_OPTIONS = {
  maxDuration: 15, // seconds (configurable 3-15, see VIDEO_CONFIG)
  fps: null,       // null = let Modal cascade through presets
  width: null,     // null = let Modal cascade through presets
  maxOutputBytes: null, // null = use Modal's default (5MB)
};

/**
 * @description Convert video bytes to optimized GIF via Modal service.
 *
 * @upstream Called by:
 *   - index.js handleTelegramWebhook() - for video messages
 *   - routes/media.js - for /video-to-gif API endpoint
 * @downstream Calls: Modal video-to-gif-convert endpoint
 *
 * @param {ArrayBuffer|Uint8Array} videoBytes - Raw video data
 * @param {Object} options - Conversion options
 * @param {number} options.maxDuration - Maximum video duration in seconds (3-15)
 * @param {number} options.fps - Target frames per second (default: 10)
 * @param {number} options.width - Target width in pixels (default: 480)
 *
 * @returns {Promise<{
 *   success: boolean,
 *   gifBase64?: string,
 *   gifSizeBytes?: number,
 *   inputDuration?: number,
 *   frameCount?: number,
 *   qualityPreset?: string,
 *   error?: string
 * }>}
 *
 * @example
 *   const result = await convertVideoToGif(videoBuffer, { maxDuration: 10 });
 *   if (result.success) {
 *     const dataUrl = `data:image/gif;base64,${result.gifBase64}`;
 *     console.log(`GIF ready: ${result.gifSizeBytes} bytes, ${result.frameCount} frames`);
 *   }
 *
 * @note Cold starts take ~5 seconds. Modal spins down after inactivity.
 * @note Automatic size optimization: tries progressively lower quality until under limit.
 */
interface ConvertOptions {
  maxDuration?: number;
  fps?: number | null;
  width?: number | null;
  maxOutputBytes?: number | null;
}

interface ModalConvertResponse {
  success: boolean;
  gif_base64?: string;
  gif_size_bytes?: number;
  input_duration_seconds?: number;
  frame_count?: number;
  dimensions?: string;
  quality_preset?: string;
  error?: string;
}

interface ModalHealthResponse {
  status: string;
  version?: string;
  capabilities?: string[];
  ffmpeg_available?: boolean;
  max_output_kb?: number;
  presets?: Record<string, unknown>;
}

export async function convertVideoToGif(videoBytes: ArrayBuffer | Uint8Array, options: ConvertOptions = {}) {
  const { maxDuration, fps, width, maxOutputBytes } = { ...DEFAULT_OPTIONS, ...options };

  // Build headers - only include overrides if they're set (non-null)
  const headers: Record<string, string> = {
    'Content-Type': 'video/mp4',
    'X-Max-Duration': String(maxDuration),
  };

  // Only send fps/width if explicitly set - otherwise let Modal cascade
  if (fps !== null && fps !== undefined) {
    headers['X-Target-FPS'] = String(fps);
  }
  if (width !== null && width !== undefined) {
    headers['X-Target-Width'] = String(width);
  }
  if (maxOutputBytes !== null && maxOutputBytes !== undefined) {
    headers['X-Max-Output-Bytes'] = String(maxOutputBytes);
  }

  try {
    const response = await fetch(MODAL_CONVERT_URL, {
      method: 'POST',
      headers,
      body: videoBytes as BodyInit,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Modal returned ${response.status}: ${errorText}`,
      };
    }

    const result = await response.json() as ModalConvertResponse;

    // Check for processing errors
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Unknown conversion error',
      };
    }

    return {
      success: true,
      gifBase64: result.gif_base64,
      gifSizeBytes: result.gif_size_bytes,
      inputDuration: result.input_duration_seconds,
      frameCount: result.frame_count,
      dimensions: result.dimensions,
      qualityPreset: result.quality_preset,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: `Video conversion error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * @description Check if Modal video-to-gif service is healthy.
 *
 * @upstream Called by: diagnostic endpoints, monitoring
 * @downstream Calls: Modal health endpoint
 *
 * @returns {Promise<{healthy: boolean, error?: string, details?: Object}>}
 */
export async function checkVideoHealth() {
  try {
    const response = await fetch(MODAL_HEALTH_URL, {
      method: 'GET',
    });

    if (!response.ok) {
      return { healthy: false, error: `Status ${response.status}` };
    }

    const result = await response.json() as ModalHealthResponse;
    return {
      healthy: result.status === 'ok',
      details: {
        version: result.version,
        capabilities: result.capabilities,
        ffmpegAvailable: result.ffmpeg_available,
        maxOutputKb: result.max_output_kb,
        presets: result.presets,
      },
    };
  } catch (err: unknown) {
    return { healthy: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * @description Validate video input before sending to Modal.
 *   Checks file size and type. Returns error message or null if valid.
 *
 * @upstream Called by: routes/media.js, telegram handlers
 * @downstream None (pure validation)
 *
 * @param {number} fileSize - Size in bytes
 * @param {string} mimeType - MIME type (e.g., "video/mp4")
 * @returns {string|null} Error message or null if valid
 */
export function validateVideoInput(fileSize: number, mimeType: string) {
  const MAX_INPUT_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-matroska',
    'video/mpeg',
    'video/avi',
  ];

  if (fileSize > MAX_INPUT_SIZE) {
    return `Video too large: ${(fileSize / 1024 / 1024).toFixed(1)}MB > 10MB max`;
  }

  // Be lenient with MIME type - ffmpeg can handle most formats
  // Only block obviously non-video types
  if (mimeType && !mimeType.startsWith('video/') && !ALLOWED_TYPES.includes(mimeType)) {
    return `Unsupported file type: ${mimeType}`;
  }

  return null;
}

/**
 * @description Create data URL from GIF base64.
 *
 * @param {string} gifBase64 - Base64-encoded GIF data
 * @returns {string} Complete data URL for embedding/storage
 */
export function createGifDataUrl(gifBase64: string) {
  return `data:image/gif;base64,${gifBase64}`;
}

/**
 * @description Format GIF metadata for display/storage.
 *
 * @param {Object} result - Conversion result from convertVideoToGif
 * @returns {string} Formatted metadata string like "[GIF: 4.2s, 312KB]"
 */
export function formatGifMetadata(result: { inputDuration?: number; gifSizeBytes?: number }) {
  const duration = result.inputDuration?.toFixed(1) || '?';
  const sizeKb = result.gifSizeBytes ? Math.round(result.gifSizeBytes / 1024) : '?';
  return `[GIF: ${duration}s, ${sizeKb}KB]`;
}
