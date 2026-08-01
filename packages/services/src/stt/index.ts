/**
 * STT Capability - Speech-to-Text services
 *
 * @module @persistence/services/stt
 * @description Speech-to-text capability with Whisper and Modal providers.
 *
 * Two providers available:
 * - CloudflareWhisperProvider: Basic transcription via Cloudflare AI
 * - ModalProsodyProvider: Enhanced transcription with prosodic annotation
 *
 * @example
 * import {
 *   CloudflareWhisperProvider,
 *   ModalProsodyProvider,
 *   type STTService,
 * } from '@persistence/services/stt';
 *
 * // Basic transcription
 * const stt: STTService = new CloudflareWhisperProvider(env.AI);
 * const result = await stt.transcribe(audioBuffer);
 *
 * // With prosody
 * const prosody = new ModalProsodyProvider();
 * const annotated = await prosody.transcribeWithProsody(audioBuffer);
 */

// Types
export type {
  STTService,
  ProsodyService,
  STTOptions,
  STTResult,
  ProsodyOptions,
  ProsodyResult,
  CloudflareAIBinding,
  ModalProsodyConfig,
} from './types.js';

export { MODAL_PROSODY_URL, MODAL_HEALTH_URL } from './types.js';

// Providers
export { CloudflareWhisperProvider } from './whisper.js';
export { ModalProsodyProvider } from './modal.js';
