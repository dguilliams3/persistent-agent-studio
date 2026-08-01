/**
 * Modal Prosody STT Provider
 *
 * @module @persistence/services/stt/modal
 * @description Modal prosodic annotation service implementation.
 *
 * Uses WhisperX + Parselmouth for:
 * - Transcription with word-level timestamps
 * - Pitch and intensity analysis
 * - Pause detection and annotation
 * - Emotional/prosodic annotations
 *
 * Returns annotated text like: "[softly] hello [pause, 2s] how are you"
 *
 * @upstream Called by: Platform handlers via ProsodyService interface
 * @downstream Calls: Modal endpoint (configured via MODAL_PROSODY_URL /
 *   MODAL_PROSODY_HEALTH_URL — see stt/types.ts)
 *
 * @note Cold starts take 5-15 seconds. Subsequent requests are faster (~2-5s).
 * @note Free tier: $30/month compute credits (~1500 min voice processing)
 */

import {
  type ServiceResult,
  failure,
  success,
} from '../core/types.js';
import type {
  STTService,
  ProsodyService,
  STTOptions,
  STTResult,
  ProsodyOptions,
  ProsodyResult,
  ModalProsodyConfig,
} from './types.js';
import { MODAL_PROSODY_URL, MODAL_HEALTH_URL } from './types.js';

// =============================================================================
// PROVIDER IMPLEMENTATION
// =============================================================================

/**
 * Modal prosody STT provider.
 *
 * Provides enhanced transcription with prosodic annotations.
 *
 * @example
 * const stt = new ModalProsodyProvider();
 * const result = await stt.transcribeWithProsody(audioBuffer);
 * // result.data.annotatedText = "[softly] hello [pause, 2s]"
 */
export class ModalProsodyProvider implements STTService, ProsodyService {
  private readonly processUrl: string;
  private readonly healthUrl: string;
  private readonly timeout: number;

  constructor(config: ModalProsodyConfig = {}) {
    this.processUrl = config.processUrl ?? MODAL_PROSODY_URL;
    this.healthUrl = config.healthUrl ?? MODAL_HEALTH_URL;
    this.timeout = config.timeout ?? 30000;
  }

  /**
   * Basic transcription (returns raw text without prosody).
   *
   * For full prosodic annotation, use transcribeWithProsody().
   */
  async transcribe(
    audio: ArrayBuffer,
    options: STTOptions = {}
  ): Promise<ServiceResult<STTResult>> {
    const prosodyResult = await this.transcribeWithProsody(audio, {
      ...options,
      includeRaw: true,
    });

    if (!prosodyResult.success) {
      return prosodyResult;
    }

    return success({
      text: prosodyResult.data.rawText ?? prosodyResult.data.annotatedText,
      durationSeconds: prosodyResult.data.durationSeconds,
    });
  }

  /**
   * Transcribe audio with prosodic annotations.
   *
   * Returns text with stage directions indicating tone, pauses,
   * and other prosodic features.
   *
   * @param audio - Raw audio data (OGG/Opus from Telegram)
   * @param options - Processing options
   * @returns Annotated text with prosodic markers
   *
   * @example
   * const result = await provider.transcribeWithProsody(audioBuffer);
   * // result.data.annotatedText = "[softly] I don't know... [pause, 2.1s]"
   */
  async transcribeWithProsody(
    audio: ArrayBuffer,
    options: ProsodyOptions = {}
  ): Promise<ServiceResult<ProsodyResult>> {
    const contentType = options.mimeType ?? 'audio/ogg';
    const timeout = options.timeout ?? this.timeout;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(this.processUrl, {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
        },
        body: audio,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        return failure(
          'SERVICE_ERROR',
          `Modal returned ${response.status}: ${errorText}`,
          { statusCode: response.status }
        );
      }

      const result = await response.json() as {
        annotated_text?: string;
        raw_text?: string;
        word_count?: number;
        duration_seconds?: number;
        error?: string;
      };

      // Check for processing errors
      if (result.error) {
        return failure('SERVICE_ERROR', result.error);
      }

      if (!result.annotated_text) {
        return failure('SERVICE_ERROR', 'No annotated text in response');
      }

      return success({
        annotatedText: result.annotated_text,
        rawText: result.raw_text,
        wordCount: result.word_count,
        durationSeconds: result.duration_seconds,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return failure('TIMEOUT', `Request timed out after ${timeout}ms`);
      }
      return failure(
        'NETWORK_ERROR',
        `Prosody service error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Check if Modal prosody service is healthy.
   *
   * Use before processing to verify service availability.
   */
  async checkHealth(): Promise<ServiceResult<{ healthy: boolean }>> {
    try {
      const response = await fetch(this.healthUrl, {
        method: 'GET',
      });

      if (!response.ok) {
        return success({ healthy: false });
      }

      const result = await response.json() as { status?: string };
      return success({ healthy: result.status === 'ok' });
    } catch (err) {
      return success({ healthy: false });
    }
  }
}
