/**
 * Cloudflare Whisper STT Provider
 *
 * @module @persistence/services/stt/whisper
 * @description Cloudflare AI Whisper speech-to-text implementation.
 *
 * Uses @cf/openai/whisper-large-v3-turbo for transcription.
 * Supports OGG, MP3, WebM, WAV formats.
 *
 * @upstream Called by: Platform handlers via STTService interface
 * @downstream Calls: Cloudflare AI binding (env.AI)
 */

import {
  type ServiceResult,
  failure,
  success,
} from '../core/types.js';
import type {
  STTService,
  STTOptions,
  STTResult,
  CloudflareAIBinding,
} from './types.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo';

// =============================================================================
// PROVIDER IMPLEMENTATION
// =============================================================================

/**
 * Cloudflare AI Whisper STT provider.
 *
 * Requires Cloudflare Workers AI binding.
 *
 * @example
 * const stt = new CloudflareWhisperProvider(env.AI);
 * const result = await stt.transcribe(audioBuffer);
 */
export class CloudflareWhisperProvider implements STTService {
  private readonly ai: CloudflareAIBinding;

  constructor(ai: CloudflareAIBinding) {
    this.ai = ai;
  }

  /**
   * Transcribe audio using Cloudflare Whisper.
   *
   * @param audio - Audio data as ArrayBuffer
   * @param options - Transcription options (task: transcribe/translate)
   * @returns Transcribed text
   */
  async transcribe(
    audio: ArrayBuffer,
    options: STTOptions = {}
  ): Promise<ServiceResult<STTResult>> {
    const { task = 'transcribe' } = options;

    try {
      // Convert ArrayBuffer to array of numbers for Cloudflare AI
      const audioArray = [...new Uint8Array(audio)];

      const result = await this.ai.run(WHISPER_MODEL, {
        audio: audioArray,
        task,
      });

      if (result && result.text !== undefined) {
        return success({
          text: result.text.trim(),
        });
      }

      return failure('SERVICE_ERROR', 'Whisper returned empty result');
    } catch (err) {
      return failure(
        'NETWORK_ERROR',
        err instanceof Error ? err.message : 'Unknown transcription error'
      );
    }
  }
}
