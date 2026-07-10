/**
 * ElevenLabs TTS Provider
 *
 * @module @persistence/services/tts/elevenlabs
 * @description ElevenLabs text-to-speech implementation.
 *
 * Supports multiple models (v2, v3, flash, turbo) with configurable
 * voice settings. Returns MP3 audio data.
 *
 * @upstream Called by: Platform handlers via TTSService interface
 * @downstream Calls: ElevenLabs API (api.elevenlabs.io)
 */

import {
  type ServiceResult,
  failure,
  success,
  httpStatusToErrorCode,
} from '../core/types.js';
import { parseApiError } from '../core/http.js';
import type { SecretsProvider } from '@persistence/core';
import type {
  TTSService,
  TTSOptions,
  TTSResult,
  TTSModel,
  Voice,
  ElevenLabsConfig,
  ElevenLabsModelKey,
} from './types.js';
import { ELEVENLABS_MODELS } from './types.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const API_BASE = 'https://api.elevenlabs.io/v1';

/** Default voice: Bella - natural, conversational female */
const DEFAULT_VOICE_ID = '4RZ84U1b4WCqpu57LvIq';

/** Default model: v2 (stable, multilingual) */
const DEFAULT_MODEL = 'eleven_multilingual_v2';

// =============================================================================
// PROVIDER IMPLEMENTATION
// =============================================================================

/**
 * ElevenLabs TTS provider.
 *
 * Use static factory methods to create instances:
 * - `create()` for production (async, uses SecretsProvider)
 * - `fromCredentials()` for testing (sync, direct credentials)
 *
 * @example
 * // Production usage
 * const tts = await ElevenLabsProvider.create(secrets);
 * const result = await tts.synthesize('Hello!', { model: 'v3' });
 *
 * @example
 * // Testing usage
 * const tts = ElevenLabsProvider.fromCredentials('your-api-key');
 */
export class ElevenLabsProvider implements TTSService {
  private readonly apiKey: string;
  private readonly defaultVoiceId: string;
  private readonly defaultModel: string;
  private readonly defaultVoiceSettings: {
    stability: number;
    similarityBoost: number;
    style: number;
    speed: number;
  };

  /**
   * @description Private constructor - use static factory methods instead.
   *
   * @upstream Called by: create(), fromCredentials()
   * @downstream Calls: None (initializes state)
   */
  private constructor(config: ElevenLabsConfig) {
    this.apiKey = config.apiKey;
    this.defaultVoiceId = config.defaultVoiceId ?? DEFAULT_VOICE_ID;
    this.defaultModel = this.resolveModelId(config.defaultModel) ?? DEFAULT_MODEL;
    this.defaultVoiceSettings = {
      stability: config.defaultVoiceSettings?.stability ?? 0.31,
      similarityBoost: config.defaultVoiceSettings?.similarityBoost ?? 0.75,
      style: config.defaultVoiceSettings?.style ?? 0.48,
      speed: config.defaultVoiceSettings?.speed ?? 1.0,
    };
  }

  /**
   * @description Create provider from secrets.
   *
   * Production factory method that retrieves API key from platform secrets.
   * Returns null if API key is not configured (graceful degradation).
   *
   * @upstream Called by: Platform initialization (Cloudflare Worker, server)
   * @downstream Calls: SecretsProvider.get()
   *
   * @param secrets - Platform secrets provider
   * @param options - Optional configuration overrides
   * @returns Promise<ElevenLabsProvider | null> Configured provider instance or null if API key not configured
   *
   * @example
   * const tts = await ElevenLabsProvider.create(secrets, {
   *   defaultModel: 'v3',
   *   defaultVoiceSettings: { stability: 0.5 }
   * });
   * if (tts) {
   *   const result = await tts.synthesize('Hello!');
   * }
   */
  static async create(
    secrets: SecretsProvider,
    options?: Partial<Omit<ElevenLabsConfig, 'apiKey'>>
  ): Promise<ElevenLabsProvider | null> {
    const apiKey = await secrets.get('ELEVENLABS_API_KEY');

    if (!apiKey) {
      console.info('ElevenLabsProvider: disabled (no ELEVENLABS_API_KEY configured)');
      return null;
    }

    return new ElevenLabsProvider({ apiKey, ...options });
  }

  /**
   * @description Create provider with direct credentials (for testing).
   *
   * Synchronous factory method that accepts credentials directly.
   * Maintains backward compatibility with existing test code.
   *
   * @upstream Called by: Unit tests, development scripts
   * @downstream Calls: constructor
   *
   * @param config - Full configuration or just API key string
   * @returns ElevenLabsProvider Configured provider instance
   *
   * @example
   * // Simple string
   * const tts = ElevenLabsProvider.fromCredentials('sk-...');
   *
   * @example
   * // Full config
   * const tts = ElevenLabsProvider.fromCredentials({
   *   apiKey: 'sk-...',
   *   defaultModel: 'v3'
   * });
   */
  static fromCredentials(config: ElevenLabsConfig | string): ElevenLabsProvider {
    if (typeof config === 'string') {
      return new ElevenLabsProvider({ apiKey: config });
    }
    return new ElevenLabsProvider(config);
  }

  /**
   * Convert text to speech using ElevenLabs API.
   *
   * @param text - Text to synthesize
   * @param options - Voice and generation settings
   * @returns Audio data as ArrayBuffer
   */
  async synthesize(
    text: string,
    options: TTSOptions = {}
  ): Promise<ServiceResult<TTSResult>> {
    if (!text || text.trim().length === 0) {
      return failure('INVALID_INPUT', 'Empty text provided');
    }

    const voiceId = options.voiceId ?? this.defaultVoiceId;
    const modelId = this.resolveModelId(options.model) ?? this.defaultModel;
    const stability = options.stability ?? this.defaultVoiceSettings.stability;
    const similarityBoost =
      options.similarityBoost ?? this.defaultVoiceSettings.similarityBoost;
    const style = options.style ?? this.defaultVoiceSettings.style;
    const speed = options.speed ?? this.defaultVoiceSettings.speed;

    try {
      // Build voice_settings - v3 has different requirements
      const voiceSettings: Record<string, unknown> = {
        stability,
        similarity_boost: similarityBoost,
        style,
        speed,
      };

      // v3-specific settings
      if (modelId === 'eleven_v3') {
        // v3 only accepts stability: 0.0 (Creative), 0.5 (Natural), 1.0 (Robust)
        const validV3Stability = [0.0, 0.5, 1.0];
        if (!validV3Stability.includes(stability)) {
          voiceSettings.stability = 0.5; // Natural
        }
        // use_speaker_boost is NOT supported for v3
      } else {
        voiceSettings.use_speaker_boost =
          options.useSpeakerBoost !== false;
      }

      // Create timeout abort controller
      const timeout = options.timeout ?? 30000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(
        `${API_BASE}/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: voiceSettings,
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `ElevenLabs API error: ${response.status}`;

        try {
          const errorJson = JSON.parse(errorBody);
          const parsed = parseApiError(errorJson);
          if (parsed) {
            errorMessage = parsed;
          }
          // Handle known error types
          if (errorJson.detail?.status === 'voice_not_fine_tuned_for_model') {
            errorMessage = `Voice not compatible with ${modelId}. Try v2 or flash model.`;
          }
        } catch {
          // Keep generic error message
        }

        return failure(
          httpStatusToErrorCode(response.status),
          errorMessage,
          { statusCode: response.status }
        );
      }

      const audioBuffer = await response.arrayBuffer();

      return success({
        audio: audioBuffer,
        format: 'audio/mpeg',
        charCount: text.length,
        voiceId,
        model: modelId,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return failure('TIMEOUT', 'Request timed out');
      }
      return failure(
        'NETWORK_ERROR',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  /**
   * List available voices from ElevenLabs.
   */
  async listVoices(): Promise<ServiceResult<Voice[]>> {
    try {
      const response = await fetch(`${API_BASE}/voices`, {
        headers: {
          'xi-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        return failure(
          httpStatusToErrorCode(response.status),
          `Failed to fetch voices: ${response.status}`,
          { statusCode: response.status }
        );
      }

      const data = await response.json() as {
        voices: Array<{
          voice_id: string;
          name: string;
          description?: string;
          labels?: { language?: string; gender?: string };
          preview_url?: string;
        }>;
      };

      const voices: Voice[] = data.voices.map((v) => ({
        id: v.voice_id,
        name: v.name,
        description: v.description,
        languages: v.labels?.language ? [v.labels.language] : undefined,
        gender: v.labels?.gender as Voice['gender'],
        previewUrl: v.preview_url,
      }));

      return success(voices);
    } catch (err) {
      return failure(
        'NETWORK_ERROR',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  /**
   * Get available models for ElevenLabs.
   */
  getModels(): TTSModel[] {
    return [
      {
        id: 'eleven_v3',
        name: 'v3',
        description: 'Most expressive, emotion tags (alpha)',
        latency: 'medium',
      },
      {
        id: 'eleven_multilingual_v2',
        name: 'v2',
        description: 'Stable, reliable, 29 languages (recommended)',
        languages: ['multilingual'],
        latency: 'medium',
      },
      {
        id: 'eleven_flash_v2_5',
        name: 'flash',
        description: 'Ultra-low latency (<75ms)',
        latency: 'low',
      },
      {
        id: 'eleven_turbo_v2_5',
        name: 'turbo',
        description: 'Fast, balanced',
        latency: 'low',
      },
    ];
  }

  /**
   * Resolve model shorthand to full ID.
   */
  private resolveModelId(model?: string): string | undefined {
    if (!model) return undefined;
    // Check if it's a shorthand key
    if (model in ELEVENLABS_MODELS) {
      return ELEVENLABS_MODELS[model as ElevenLabsModelKey];
    }
    // Assume it's already a full model ID
    return model;
  }
}
