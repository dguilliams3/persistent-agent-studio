/**
 * Prosody Service (Platform Compatibility Layer)
 *
 * @module services/prosody
 * @description Compatibility layer for prosody functions using ModalProsodyProvider.
 *
 * MIGRATION NOTE (2026-01-30):
 * @persistence/voice was consolidated. Prosody API calls now use ModalProsodyProvider
 * from @persistence/services/stt. This file wraps the provider to maintain backward
 * compatibility with the function-based API used by telegram/commands/voice.js.
 *
 * @upstream Called by: telegram/commands/voice.js
 * @downstream Calls: @persistence/services/stt ModalProsodyProvider
 */

import {
  MODAL_PROSODY_URL,
  MODAL_HEALTH_URL,
  ModalProsodyProvider,
} from '@persistence/services/stt';

// Re-export constants
export { MODAL_PROSODY_URL, MODAL_HEALTH_URL };

// Singleton provider instance
const prosodyProvider = new ModalProsodyProvider();

type ProsodyOptions = {
  contentType?: string;
  timeout?: number;
};

/**
 * Get prosodic annotation for audio bytes.
 *
 * Sends audio to the Modal prosody service for transcription and
 * prosodic annotation. Returns text with stage directions.
 *
 * @param {ArrayBuffer} audioBytes - Raw audio data (OGG/Opus from Telegram)
 * @param {Object} options - Processing options
 * @param {string} [options.contentType='audio/ogg'] - Audio content type
 * @param {number} [options.timeout=30000] - Request timeout in ms
 * @returns {Promise<{success: boolean, annotated_text?: string, raw_text?: string, error?: string}>}
 */
export async function getProsodyAnnotation(audioBytes: ArrayBuffer, options: ProsodyOptions = {}) {
  const result = await prosodyProvider.transcribeWithProsody(audioBytes, {
    mimeType: options.contentType ?? 'audio/ogg',
    timeout: options.timeout,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error?.message ?? 'Unknown error',
    };
  }

  return {
    success: true,
    annotated_text: result.data.annotatedText,
    raw_text: result.data.rawText,
    word_count: result.data.wordCount,
    duration_seconds: result.data.durationSeconds,
  };
}

/**
 * Check if Modal prosody service is healthy.
 *
 * @returns {Promise<{healthy: boolean, error?: string}>}
 */
export async function checkProsodyHealth() {
  const result = await prosodyProvider.checkHealth();

  if (!result.success) {
    return {
      healthy: false,
      error: result.error?.message ?? 'Unknown error',
    };
  }

  return { healthy: result.data.healthy };
}
