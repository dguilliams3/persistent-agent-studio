/**
 * Input data for adding a new voice transcription.
 *
 * @module @persistence/db/voice/VoiceTranscriptionInput
 * @upstream Called by:
 *   - voice/transcriptions.ts
 *   - voice/index.ts
 */

export interface VoiceTranscriptionInput {
  rawTranscription: string;
  historyId?: number;
  detectedEmotion?: string;
  audioDuration?: number;
  glossaryApplied?: string;  // JSON string of applied glossary IDs
}
