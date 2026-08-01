import { sql } from "drizzle-orm";
/**
 * Voice transcriptions schema — speech-to-text records for user voice messages.
 *
 * @module packages/db/src/schema/voice-transcriptions
 * @description Records the full transcription pipeline output for each user voice message:
 *   raw speech-to-text output, LLM-corrected text, detected emotional state, and
 *   glossary correction metadata. Linked to the history entry that was created from
 *   this transcription, enabling full traceability from audio to conversation event.
 * @upstream voice input handler — creates a transcription record for each voice message
 * @downstream history — the corrected text becomes a history entry (linked via historyId)
 * @downstream apps/web — transcription display shows raw vs corrected text
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant persona_id is always present — transcriptions are per-persona
 * @invariant rawTranscription is always set — it is the starting point of the pipeline
 * @coupling glossary.ts — glossary corrections are applied during transcription; glossaryApplied records which entries were used
 * @coupling voice-history.ts — voice-history is TTS output; voice-transcriptions is STT input
 */
import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";
import { history } from "./history";

/**
 * Voice transcriptions table — speech-to-text processing records.
 * Tracks the full pipeline from raw audio transcription through LLM correction
 * to the final text used as the entity's user message context.
 *
 * Key columns:
 * - historyId: The history entry created from this transcription (null if not yet processed)
 * - rawTranscription: Verbatim text from the STT engine before any correction
 * - correctedText: LLM-corrected version with proper nouns and grammar fixed
 * - detectedEmotion: Emotion inferred from audio prosody or content
 * - correctedEmotion: LLM-refined emotion classification
 * - audioDuration: Length of the audio clip in seconds
 * - glossaryApplied: JSON array of glossary corrections applied to this transcription
 *
 * Index strategy:
 * - history index: link transcription back to its history entry
 * - persona index: load all transcriptions for a persona
 * - created index: time-ordered transcription log
 *
 * @downstream history — historyId links to the resulting conversation entry
 * @pattern persona-scoped — transcriptions isolated by persona_id
 * @invariant rawTranscription preserves original STT output for audit and model evaluation
 */
export const voiceTranscriptions = sqliteTable(
  "voice_transcriptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personaId: integer("persona_id")
      .default(1)
      .references(() => personas.id),
    historyId: integer("history_id").references(() => history.id),
    rawTranscription: text("raw_transcription").notNull(),
    correctedText: text("corrected_text"),
    detectedEmotion: text("detected_emotion"),
    correctedEmotion: text("corrected_emotion"),
    audioDuration: real("audio_duration"),
    glossaryApplied: text("glossary_applied"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_voice_transcriptions_history").on(table.historyId),
    index("idx_voice_transcriptions_persona").on(table.personaId),
    index("idx_voice_transcriptions_created").on(table.createdAt),
  ]
);
