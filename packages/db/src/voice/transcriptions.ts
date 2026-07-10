/**
 * Voice Transcription CRUD Operations
 *
 * @module @persistence/db/voice/transcriptions
 * @description Database operations for the voice_transcriptions table.
 *   Tracks user voice messages for STT correction training.
 *
 * @upstream Called by:
 *   - routes/voiceTranscriptions.js - REST API endpoints
 *   - telegram/commands/voice.js - Voice message processing
 * @downstream Calls:
 *   - Drizzle query builder
 *   - @persistence/db/persona-scope - getActivePersonaId
 */

import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import type { DrizzleD1 } from '../client';
import { getActivePersonaId } from '../persona-scope';
import { voiceTranscriptions } from '../schema/voice-transcriptions';

import type { VoiceTranscription } from './VoiceTranscription.js';
import type { VoiceTranscriptionInput } from './VoiceTranscriptionInput.js';
import type { TranscriptionCorrection } from './TranscriptionCorrection.js';
import type { GetTranscriptionsOptions } from './GetTranscriptionsOptions.js';
import type { TranscriptionListResult } from './TranscriptionListResult.js';
import type { AddTranscriptionResult } from './AddTranscriptionResult.js';

// Re-export types for convenience
export type { VoiceTranscription } from './VoiceTranscription.js';
export type { VoiceTranscriptionInput } from './VoiceTranscriptionInput.js';
export type { TranscriptionCorrection } from './TranscriptionCorrection.js';
export type { GetTranscriptionsOptions } from './GetTranscriptionsOptions.js';
export type { TranscriptionListResult } from './TranscriptionListResult.js';
export type { AddTranscriptionResult } from './AddTranscriptionResult.js';

interface TranscriptionOptions {
  personaId?: number;
}

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * @description Add a new voice transcription record
 *
 * @param db - Drizzle D1 client
 * @param data - Transcription data
 * @param options - Optional settings (personaId override)
 * @returns The created entry with id
 */
export async function addVoiceTranscription(
  db: DrizzleD1,
  data: VoiceTranscriptionInput,
  options: TranscriptionOptions = {}
): Promise<AddTranscriptionResult> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const result = await db.insert(voiceTranscriptions).values({
    personaId,
    rawTranscription: data.rawTranscription,
    historyId: data.historyId ?? null,
    detectedEmotion: data.detectedEmotion ?? null,
    audioDuration: data.audioDuration ?? null,
    glossaryApplied: data.glossaryApplied ?? null,
    createdAt: new Date().toISOString(),
  }).returning({ id: voiceTranscriptions.id });

  return {
    id: result[0].id,
    raw_transcription: data.rawTranscription,
    history_id: data.historyId,
    detected_emotion: data.detectedEmotion,
    audio_duration: data.audioDuration,
  };
}

/**
 * @description Get voice transcriptions with optional filtering
 *
 * @param db - Drizzle D1 client
 * @param options - Query options (limit, offset, needsCorrection, personaId)
 * @returns Paginated result with items and total count
 */
export async function getVoiceTranscriptions(
  db: DrizzleD1,
  options: GetTranscriptionsOptions = {}
): Promise<TranscriptionListResult> {
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;
  const personaId = options.personaId ?? await getActivePersonaId(db);

  const conditions = [eq(voiceTranscriptions.personaId, personaId)];
  if (options.needsCorrection) {
    conditions.push(isNull(voiceTranscriptions.correctedText));
  }

  // Get total count
  const countResult = await db.select({ count: sql<number>`count(*)` })
    .from(voiceTranscriptions)
    .where(and(...conditions))
    .get();
  const total = countResult?.count ?? 0;

  // Get paginated items
  const results = await db.select()
    .from(voiceTranscriptions)
    .where(and(...conditions))
    .orderBy(desc(voiceTranscriptions.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  // Map to VoiceTranscription interface (snake_case)
  const items: VoiceTranscription[] = results.map(row => ({
    id: row.id,
    persona_id: row.personaId ?? 1,
    history_id: row.historyId ?? undefined,
    raw_transcription: row.rawTranscription,
    corrected_text: row.correctedText ?? undefined,
    detected_emotion: row.detectedEmotion ?? undefined,
    corrected_emotion: row.correctedEmotion ?? undefined,
    audio_duration: row.audioDuration ?? undefined,
    glossary_applied: row.glossaryApplied ?? undefined,
    created_at: row.createdAt ?? '',
  }));

  return { items, total };
}

/**
 * @description Get a single voice transcription by ID
 *
 * @param db - Drizzle D1 client
 * @param id - Transcription ID
 * @param options - Optional settings (personaId override)
 * @returns The entry or null if not found
 */
export async function getVoiceTranscription(
  db: DrizzleD1,
  id: number,
  options: TranscriptionOptions = {}
): Promise<VoiceTranscription | null> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const result = await db.select()
    .from(voiceTranscriptions)
    .where(and(eq(voiceTranscriptions.personaId, personaId), eq(voiceTranscriptions.id, id)))
    .get();

  if (!result) return null;

  return {
    id: result.id,
    persona_id: result.personaId ?? 1,
    history_id: result.historyId ?? undefined,
    raw_transcription: result.rawTranscription,
    corrected_text: result.correctedText ?? undefined,
    detected_emotion: result.detectedEmotion ?? undefined,
    corrected_emotion: result.correctedEmotion ?? undefined,
    audio_duration: result.audioDuration ?? undefined,
    glossary_applied: result.glossaryApplied ?? undefined,
    created_at: result.createdAt ?? '',
  };
}

/**
 * @description Update a voice transcription with user corrections
 *
 * @param db - Drizzle D1 client
 * @param id - Transcription ID
 * @param corrections - Correction data (correctedText, correctedEmotion)
 * @param options - Optional settings (personaId override)
 * @returns Success status
 */
export async function updateTranscriptionCorrection(
  db: DrizzleD1,
  id: number,
  corrections: TranscriptionCorrection,
  options: TranscriptionOptions = {}
): Promise<boolean> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const setFields: Record<string, unknown> = {};

  if (corrections.correctedText !== undefined) setFields.correctedText = corrections.correctedText;
  if (corrections.correctedEmotion !== undefined) setFields.correctedEmotion = corrections.correctedEmotion;

  if (Object.keys(setFields).length === 0) return false;

  const result = await db.update(voiceTranscriptions)
    .set(setFields)
    .where(and(eq(voiceTranscriptions.personaId, personaId), eq(voiceTranscriptions.id, id)))
    .returning({ id: voiceTranscriptions.id });

  return result.length > 0;
}

/**
 * @description Delete a voice transcription
 *
 * @param db - Drizzle D1 client
 * @param id - Transcription ID
 * @param options - Optional settings (personaId override)
 * @returns Success status
 */
export async function deleteVoiceTranscription(
  db: DrizzleD1,
  id: number,
  options: TranscriptionOptions = {}
): Promise<boolean> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const result = await db.delete(voiceTranscriptions)
    .where(and(eq(voiceTranscriptions.personaId, personaId), eq(voiceTranscriptions.id, id)))
    .returning({ id: voiceTranscriptions.id });

  return result.length > 0;
}
