/**
 * Media Services - Unified export for all media operations
 *
 * @module services/media
 * @description Single import point for image generation, video conversion,
 *   audio (TTS/STT), and R2 storage operations.
 *
 * ## Usage
 * ```javascript
 * import {
 *   // Images
 *   generateImage, generateImageReplicate, generateImageFluxDev, generateImageSDXL,
 *   // Video
 *   convertVideoToGif, checkVideoHealth, validateVideoInput,
 *   // Audio (TTS)
 *   textToSpeech, TTS_MODELS,
 *   // Audio (STT)
 *   transcribeAudio, downloadTelegramFile,
 *   // Storage
 *   storeMedia, getMedia, storeGifMedia, isR2Reference, extractR2Key,
 * } from './services/media/index.js';
 * ```
 *
 * ## Modules
 * - `images.js` - Image generation (Cloudflare AI, Replicate FLUX/SDXL)
 * - `video.js` - Video-to-GIF conversion (Modal)
 * - `audio.js` - TTS (ElevenLabs) and STT (Cloudflare Whisper)
 * - `storage.js` - R2 media storage helpers
 *
 * @upstream Called by: index.js, routes/*, telegram/commands/*
 * @downstream Calls: All media submodules
 */

// =============================================================================
// IMAGE GENERATION
// =============================================================================
// Provider routing: no prefix → Cloudflare, REPLICATE: → flux-schnell,
// FLUX: → flux-dev, SDXL: → stability-ai/sdxl (most permissive)
// =============================================================================

export {
  generateImage,
  generateImageReplicate,
  generateImageFluxDev,
  generateImageSDXL,
} from './images.js';

// =============================================================================
// VIDEO CONVERSION
// =============================================================================
// Modal endpoint for video-to-GIF conversion with intelligent size cascade
// =============================================================================

export {
  convertVideoToGif,
  checkVideoHealth,
  validateVideoInput,
  createGifDataUrl,
  formatGifMetadata,
} from './video.js';

// =============================================================================
// AUDIO (TTS & STT)
// =============================================================================
// TTS: ElevenLabs API (Bella voice, multiple models)
// STT: Cloudflare AI Whisper (transcribe/translate)
// =============================================================================

export {
  // TTS
  textToSpeech,
  TTS_MODELS,
  // STT
  transcribeAudio,
  downloadTelegramFile,
} from './audio.js';

// =============================================================================
// R2 MEDIA STORAGE
// =============================================================================
// Handles storage for media exceeding D1's ~900KB row limit
// Uses r2:// prefix references stored in D1
// =============================================================================

export {
  // Core storage operations
  storeMedia,
  getMedia,
  deleteMedia,
  // Key management
  generateMediaKey,
  // Reference helpers
  isR2Reference,
  extractR2Key,
  createR2Reference,
  // High-level DRY helper
  storeGifMedia,
} from './storage.js';
