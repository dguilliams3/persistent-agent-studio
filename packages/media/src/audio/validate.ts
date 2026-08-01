import type { AudioMedia } from './AudioMedia';
import { isValidBase64 } from '../encoding';

const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
const VALID_AUDIO_FORMATS = ['ogg', 'mp3', 'wav', 'opus'] as const;

/**
 * Validate audio media against format, size, and data constraints.
 * Returns an empty array if valid, or an array of error messages.
 *
 * @downstream Any handler that accepts audio uploads — call before persisting to R2
 * @upstream packages/media/src/audio/AudioMedia — accepts AudioMedia values (and subtypes)
 * @pattern guard-at-boundary — validate on ingress; types are trusted after this point
 * @antipattern DO NOT validate audio inline in upload handlers — use this function.
 *   Centralises the 25MB limit, format rules, and sample rate checks in one place.
 * @tested_by packages/media/__tests__/validate.test.ts
 * @invariant Returns [] on valid input; never throws; durationSeconds must be non-negative; sampleRate must be positive
 */
export function validateAudio(audio: AudioMedia): string[] {
  const errors: string[] = [];
  if (audio.sizeBytes && audio.sizeBytes > MAX_AUDIO_SIZE_BYTES) {
    errors.push(`Audio exceeds ${MAX_AUDIO_SIZE_BYTES} byte limit: ${audio.sizeBytes}`);
  }
  if (!VALID_AUDIO_FORMATS.includes(audio.format)) {
    errors.push(`Invalid format: ${audio.format}`);
  }
  if (audio.durationSeconds !== undefined && audio.durationSeconds < 0) {
    errors.push(`Duration cannot be negative: ${audio.durationSeconds}`);
  }
  if (audio.sampleRate !== undefined && audio.sampleRate <= 0) {
    errors.push(`Sample rate must be positive: ${audio.sampleRate}`);
  }
  if (audio.data !== undefined && !isValidBase64(audio.data)) {
    errors.push('Audio data contains invalid base64 characters');
  }
  return errors;
}
