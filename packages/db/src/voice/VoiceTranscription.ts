/**
 * Voice transcription record.
 *
 * @module @persistence/db/voice/VoiceTranscription
 * @description Stores transcription results from voice messages, including
 * the raw WhisperX output and any user corrections. Used for building
 * training data and improving transcription quality over time.
 * @upstream Called by:
 *   - voice/transcriptions.ts
 *   - voice/TranscriptionListResult.ts
 *   - voice/index.ts
 */

export interface VoiceTranscription {
  id: number;
  persona_id: number;
  /** Original WhisperX transcription output */
  raw_transcription: string;
  /** User-corrected version of the transcription */
  corrected_text?: string;
  /** User-corrected emotion label (overrides detected) */
  corrected_emotion?: string;
  /** Link to history table entry (if transcription is from a message) */
  history_id?: number;
  /** Emotion detected by prosody analysis */
  detected_emotion?: string;
  /** Audio duration in seconds */
  audio_duration?: number;
  /** IDs of glossary entries that were applied during correction */
  glossary_applied?: string;
  created_at: string;
}
