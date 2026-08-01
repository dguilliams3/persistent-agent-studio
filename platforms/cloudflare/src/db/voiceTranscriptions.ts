/**
 * Voice Transcriptions (Platform Re-export)
 *
 * @module db/voiceTranscriptions
 * @description Re-exports voice transcription functions from @persistence/db package.
 *
 * MIGRATION NOTE (2026-01-30):
 * Implementation consolidated from @persistence/voice into @persistence/db/voice.
 * This file now serves as a re-export barrel for backward compatibility.
 *
 * @upstream Called by: routes/voiceTranscriptions.js, telegram/commands/voice.js
 * @downstream Re-exports from @persistence/db/voice
 */

// Use workspace package - relative paths don't resolve correctly with wrangler bundling
export {
  addVoiceTranscription,
  getVoiceTranscriptions,
  getVoiceTranscription,
  updateTranscriptionCorrection,
  deleteVoiceTranscription,
} from '@persistence/db';
