/**
 * Correction data for updating a transcription.
 *
 * @module @persistence/db/voice/TranscriptionCorrection
 * @upstream Called by:
 *   - voice/transcriptions.ts
 *   - voice/index.ts
 */

export interface TranscriptionCorrection {
  correctedText?: string;
  correctedEmotion?: string;
}
