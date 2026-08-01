/**
 * Result from adding a transcription.
 *
 * @module @persistence/db/voice/AddTranscriptionResult
 * @upstream Called by:
 *   - voice/transcriptions.ts
 *   - voice/index.ts
 */

export interface AddTranscriptionResult {
  id: number;
  raw_transcription: string;
  history_id?: number;
  detected_emotion?: string;
  audio_duration?: number;
}
