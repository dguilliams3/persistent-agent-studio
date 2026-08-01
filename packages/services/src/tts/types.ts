/**
 * TTS Types - Text-to-Speech capability interfaces
 *
 * @module @persistence/services/tts/types
 * @description Types for text-to-speech service providers.
 *
 * Consumer code depends on `TTSService` interface, not specific providers.
 * This allows swapping ElevenLabs for another provider without changing callers.
 */

import type { ServiceResult, HttpOptions } from '../core/types.js';

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

/**
 * Text-to-Speech service interface.
 *
 * All TTS providers must implement this interface.
 *
 * @example
 * const tts: TTSService = new ElevenLabsProvider(apiKey);
 * const result = await tts.synthesize('Hello!');
 * if (result.success) {
 *   // result.data.audio is ArrayBuffer of MP3 data
 * }
 */
export interface TTSService {
  /**
   * Convert text to speech audio.
   *
   * @param text - The text to synthesize
   * @param options - Optional voice and generation settings
   * @returns Audio data and metadata
   */
  synthesize(text: string, options?: TTSOptions): Promise<ServiceResult<TTSResult>>;

  /**
   * List available voices.
   *
   * Not all providers may support this.
   */
  listVoices?(): Promise<ServiceResult<Voice[]>>;

  /**
   * Get available models for this provider.
   */
  getModels?(): TTSModel[];
}

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Options for TTS synthesis.
 */
export interface TTSOptions extends HttpOptions {
  /** Voice ID to use (provider-specific) */
  voiceId?: string;
  /** Model ID (provider-specific) */
  model?: string;
  /** Voice stability (0-1, lower = more variable) */
  stability?: number;
  /** Similarity boost (0-1, higher = closer to original voice) */
  similarityBoost?: number;
  /** Style exaggeration (0-1) */
  style?: number;
  /** Speech speed multiplier (0.7-1.2) */
  speed?: number;
  /** Use speaker boost (improves voice clarity) */
  useSpeakerBoost?: boolean;
  /** Output format preference */
  outputFormat?: 'mp3' | 'ogg' | 'wav' | 'pcm';
}

/**
 * Result from TTS synthesis.
 */
export interface TTSResult {
  /** Audio data as ArrayBuffer */
  audio: ArrayBuffer;
  /** Audio format/MIME type */
  format: string;
  /** Character count of input text */
  charCount: number;
  /** Estimated duration in milliseconds (if available) */
  durationMs?: number;
  /** Voice ID used */
  voiceId?: string;
  /** Model ID used */
  model?: string;
}

/**
 * Voice metadata.
 */
export interface Voice {
  /** Provider-specific voice ID */
  id: string;
  /** Display name */
  name: string;
  /** Voice description */
  description?: string;
  /** Language codes supported */
  languages?: string[];
  /** Voice gender if applicable */
  gender?: 'male' | 'female' | 'neutral';
  /** Preview audio URL */
  previewUrl?: string;
  /** Tags/categories */
  tags?: string[];
}

/**
 * TTS model metadata.
 */
export interface TTSModel {
  /** Model ID */
  id: string;
  /** Display name */
  name: string;
  /** Model description */
  description?: string;
  /** Supported languages */
  languages?: string[];
  /** Latency characteristics */
  latency?: 'low' | 'medium' | 'high';
}

// =============================================================================
// ELEVENLABS-SPECIFIC TYPES
// =============================================================================

/**
 * ElevenLabs-specific model IDs.
 *
 * These map to the actual API model identifiers.
 */
export const ELEVENLABS_MODELS = {
  /** Most expressive, emotion tags (alpha - limited voice support) */
  v3: 'eleven_v3',
  /** Stable, reliable, 29 languages (recommended) */
  v2: 'eleven_multilingual_v2',
  /** Ultra-low latency (<75ms) */
  flash: 'eleven_flash_v2_5',
  /** Fast, balanced */
  turbo: 'eleven_turbo_v2_5',
} as const;

export type ElevenLabsModelKey = keyof typeof ELEVENLABS_MODELS;

/**
 * ElevenLabs provider configuration.
 */
export interface ElevenLabsConfig {
  /** API key */
  apiKey: string;
  /** Default voice ID */
  defaultVoiceId?: string;
  /** Default model */
  defaultModel?: ElevenLabsModelKey | string;
  /** Default voice settings */
  defaultVoiceSettings?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speed?: number;
  };
}
