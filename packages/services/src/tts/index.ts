/**
 * TTS Capability - Text-to-Speech services
 *
 * @module @persistence/services/tts
 * @description Text-to-speech capability with ElevenLabs provider.
 *
 * @example
 * import { ElevenLabsProvider, type TTSService } from '@persistence/services/tts';
 *
 * const tts: TTSService = new ElevenLabsProvider(apiKey);
 * const result = await tts.synthesize('Hello!');
 */

// Types
export type {
  TTSService,
  TTSOptions,
  TTSResult,
  Voice,
  TTSModel,
  ElevenLabsConfig,
  ElevenLabsModelKey,
} from './types.js';

export { ELEVENLABS_MODELS } from './types.js';

// Providers
export { ElevenLabsProvider } from './elevenlabs.js';
