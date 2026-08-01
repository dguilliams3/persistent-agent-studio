import type { AudioMedia } from './AudioMedia';

/**
 * AI-synthesized speech — audio generated from text via TTS.
 *
 * Intrinsic to what the artifact IS: the source text, TTS model, and voice preset
 * are properties of the speech itself, not of the client that requested it.
 *
 * @downstream apps/web — playback UI, voice settings display
 * @downstream packages/services — voice tool handler that creates and stores SynthesizedSpeech values
 * @upstream packages/media/src/audio/AudioMedia — SynthesizedSpeech extends AudioMedia
 * @pattern domain-ownership — TTS metadata (sourceText, ttsModel, voicePreset) belongs on the type itself
 * @antipattern DO NOT create new TTS output types — extend or compose this one.
 *   Import from @persistence/media for playback, voice settings display, etc.
 * @tested_by packages/media/__tests__/audio.test.ts
 * @invariant sourceText and ttsModel must be non-empty strings
 */
export interface SynthesizedSpeech extends AudioMedia {
  /** Text that was synthesized */
  sourceText: string;
  /** TTS model used */
  ttsModel: string;
  /** Voice preset name */
  voicePreset?: string;
  /** Prosody parameters */
  prosodySettings?: Record<string, unknown>;
}
