import { sql } from "drizzle-orm";
/**
 * Voice history schema — log of all text-to-speech audio generated for the entity.
 *
 * @module packages/db/src/schema/voice-history
 * @description Records every TTS audio generation event: the text spoken, the voice
 *   model used, prosody settings, and the resulting audio encoded as base64.
 *   This is the entity's "spoken output" log — separate from history (text events)
 *   because audio content has distinct storage and retrieval requirements.
 * @upstream voice synthesis service — inserts a record for each TTS call
 * @downstream apps/web — audio playback queries this table for cached audio
 * @downstream Telegram bot — voice response delivery uses cached audio
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant persona_id is always present — voice output is per-persona
 * @invariant audioBase64 is always set — audio is stored inline (no R2 for voice)
 * @coupling voice-transcriptions.ts — transcriptions are speech-to-text; this is text-to-speech
 */
import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";

/**
 * Voice history table — log of all TTS audio generations.
 * Caches generated audio to avoid redundant synthesis calls for repeated phrases
 * and preserves the audio record for replay and export.
 *
 * Key columns:
 * - text: The input text that was synthesized
 * - model: The TTS model version used (e.g., "v2")
 * - stability: Voice stability parameter (0.0–1.0, affects consistency vs expressiveness)
 * - audioBase64: The generated audio encoded as a base64 string
 * - charCount: Length of the input text — used for cost estimation
 *
 * Index strategy:
 * - created index: time-ordered retrieval of recent audio
 * - persona+created composite: load voice output history per persona
 *
 * @downstream apps/web audio player — fetches audio by id for playback
 * @pattern persona-scoped — voice output isolated by persona_id
 * @invariant audioBase64 is never null — audio is always stored inline
 */
export const voiceHistory = sqliteTable(
  "voice_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personaId: integer("persona_id")
      .notNull()
      .default(1)
      .references(() => personas.id),
    text: text("text").notNull(),
    model: text("model").notNull().default("v2"),
    stability: real("stability"),
    audioBase64: text("audio_base64").notNull(),
    charCount: integer("char_count").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_voice_history_created").on(table.createdAt),
    index("idx_voice_history_persona").on(table.personaId, table.createdAt),
  ]
);
