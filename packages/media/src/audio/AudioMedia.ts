import type { MediaBase } from '../Media';

/**
 * Audio media — OGG, MP3, WAV, or Opus.
 *
 * Base type for all audio. Domain subtypes (SynthesizedSpeech, VoiceMessage) extend this
 * to add origin-specific metadata while inheriting format and storage fields.
 *
 * @downstream packages/media/src/audio/SynthesizedSpeech — extends AudioMedia for TTS output
 * @downstream packages/media/src/audio/VoiceMessage — extends AudioMedia for user voice input
 * @upstream packages/media/src/Media — AudioMedia extends MediaBase
 * @pattern inheritance — extend to add origin-specific metadata without duplicating format/storage fields
 * @antipattern DO NOT create new audio types that don't extend this.
 *   If you need audio metadata, extend AudioMedia — don't create a parallel type.
 * @tested_by packages/media/__tests__/audio.test.ts
 */
export interface AudioMedia extends MediaBase {
  kind: 'audio';
  format: 'ogg' | 'mp3' | 'wav' | 'opus';
  /** Duration in seconds */
  durationSeconds?: number;
  /** Sample rate in Hz */
  sampleRate?: number;
  sizeBytes?: number;
}
