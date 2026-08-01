/**
 * Audio sub-package barrel — re-exports all audio types and validators.
 *
 * Covers AudioMedia base type and domain subtypes (SynthesizedSpeech, VoiceMessage),
 * plus the validateAudio guard.
 *
 * @downstream packages/media/src/index — re-exported from the package root barrel
 * @downstream Any consumer that imports audio-specific types directly from @persistence/media
 * @upstream packages/media/src/audio/AudioMedia — base audio type
 * @upstream packages/media/src/audio/SynthesizedSpeech — TTS output subtype
 * @upstream packages/media/src/audio/VoiceMessage — user voice input subtype
 * @upstream packages/media/src/audio/validate — validateAudio guard
 * @pattern barrel — re-exports only; no logic in this file
 * @antipattern DO NOT add logic here — put it in the domain file and re-export.
 */

// Audio type hierarchy
export type { AudioMedia } from './AudioMedia';
export type { SynthesizedSpeech } from './SynthesizedSpeech';
export type { VoiceMessage } from './VoiceMessage';

// Validators
export { validateAudio } from './validate';
