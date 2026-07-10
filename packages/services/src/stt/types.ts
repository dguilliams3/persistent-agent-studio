/**
 * STT Types - Speech-to-Text capability interfaces
 *
 * @module @persistence/services/stt/types
 * @description Types for speech-to-text service providers.
 *
 * Includes both basic transcription (Whisper) and prosodic annotation (Modal).
 */

import type { ServiceResult, HttpOptions } from '../core/types.js';

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

/**
 * Speech-to-Text service interface.
 *
 * All STT providers must implement this interface.
 *
 * @example
 * const stt: STTService = new CloudflareWhisperProvider(aiBinding);
 * const result = await stt.transcribe(audioBuffer);
 */
export interface STTService {
  /**
   * Transcribe audio to text.
   *
   * @param audio - Audio data as ArrayBuffer
   * @param options - Transcription options
   * @returns Transcribed text and metadata
   */
  transcribe(audio: ArrayBuffer, options?: STTOptions): Promise<ServiceResult<STTResult>>;
}

/**
 * Enhanced STT service with prosodic annotation support.
 *
 * Prosodic annotation adds stage directions like:
 * "[softly] hello [pause, 2s] how are you [rising]"
 */
export interface ProsodyService extends STTService {
  /**
   * Transcribe with prosodic annotations.
   *
   * Returns text with emotional/prosodic markers.
   */
  transcribeWithProsody(
    audio: ArrayBuffer,
    options?: ProsodyOptions
  ): Promise<ServiceResult<ProsodyResult>>;

  /**
   * Check if prosody service is available.
   */
  checkHealth(): Promise<ServiceResult<{ healthy: boolean }>>;
}

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Options for STT transcription.
 */
export interface STTOptions extends HttpOptions {
  /** Task: 'transcribe' (same language) or 'translate' (to English) */
  task?: 'transcribe' | 'translate';
  /** Audio MIME type hint */
  mimeType?: string;
  /** Language code hint (ISO 639-1) */
  language?: string;
}

/**
 * Result from STT transcription.
 */
export interface STTResult {
  /** Transcribed text */
  text: string;
  /** Detected language code */
  language?: string;
  /** Transcription confidence (0-1) */
  confidence?: number;
  /** Duration of audio in seconds */
  durationSeconds?: number;
  /** Word-level timestamps if available */
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence?: number;
  }>;
}

/**
 * Options for prosodic transcription.
 */
export interface ProsodyOptions extends STTOptions {
  /** Include raw text in addition to annotated */
  includeRaw?: boolean;
}

/**
 * Result from prosodic transcription.
 */
export interface ProsodyResult {
  /** Prosodically annotated text with stage directions */
  annotatedText: string;
  /** Raw transcribed text (no annotations) */
  rawText?: string;
  /** Word count */
  wordCount?: number;
  /** Duration in seconds */
  durationSeconds?: number;
}

// =============================================================================
// PROVIDER-SPECIFIC TYPES
// =============================================================================

/**
 * Cloudflare AI binding interface (subset needed for Whisper).
 */
export interface CloudflareAIBinding {
  run(
    model: string,
    inputs: { audio: number[]; task?: string }
  ): Promise<{ text?: string }>;
}

/**
 * Modal prosody service configuration.
 */
export interface ModalProsodyConfig {
  /** Processing endpoint URL (default: Modal deployment URL) */
  processUrl?: string;
  /** Health check endpoint URL */
  healthUrl?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
}

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
 * Default Modal prosody endpoint.
 * @note Placeholder — this Modal deployment is not public. Set MODAL_PROSODY_URL
 *   in your environment to point at your own Modal deployment before use.
 */
export const MODAL_PROSODY_URL =
  envOverride('MODAL_PROSODY_URL') ?? 'https://your-modal-endpoint.modal.run';

/**
 * Default Modal health endpoint.
 * @note Placeholder — set MODAL_PROSODY_HEALTH_URL in your environment to point
 *   at your own Modal deployment's health check before use.
 */
export const MODAL_HEALTH_URL =
  envOverride('MODAL_PROSODY_HEALTH_URL') ?? 'https://your-modal-endpoint.modal.run';
