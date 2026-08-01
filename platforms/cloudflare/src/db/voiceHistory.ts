/**
 * Voice history helpers for the Cloudflare platform.
 *
 * @module db/voiceHistory
 * @description Provides persona-scoped voice_history reads and writes using the
 * current DrizzleD1 contract. This replaces the removed generic persona helper
 * exports that older platform files still referenced.
 *
 * Upstream: `platforms/cloudflare/src/routes/registry.ts`, `platforms/cloudflare/src/tools/post-processors.ts`, `platforms/cloudflare/src/telegram/commands/operations.ts`
 * Downstream: `@persistence/db::getActivePersonaId`, `db.$client` raw D1 binding
 * Coupling: `packages/db/src/schema/voice-history.ts` - SQL column names must stay aligned with the schema
 * Do NOT: Call `.prepare()` on the Drizzle wrapper directly - always use `db.$client.prepare(...)`
 */

import { getActivePersonaId, type DrizzleD1 } from '@persistence/db';

export interface VoiceHistoryListItem {
  id: number;
  text: string;
  model: string;
  stability: number | null;
  char_count: number;
  created_at: string;
}

export interface VoiceHistoryAudioRow {
  audio_base64: string;
}

export interface VoiceHistoryIdRow {
  id: number;
}

export interface VoiceHistoryPlaceholderRow {
  id: number;
  created_at: string;
}

export interface AddVoiceHistoryInput {
  text: string;
  model: string;
  stability: number | null;
  audioBase64: string;
  charCount: number;
  createdAt?: string | null;
}

/**
 * Insert a persona-scoped voice history row.
 *
 * Created-at is optional so backfills can preserve the upstream timestamp when
 * available while ordinary runtime writes can fall back to the table default.
 */
export async function addVoiceHistory(
  db: DrizzleD1,
  input: AddVoiceHistoryInput,
): Promise<void> {
  const personaId = await getActivePersonaId(db);
  const raw = db.$client;

  if (input.createdAt) {
    await raw
      .prepare(
        `INSERT INTO voice_history (persona_id, text, model, stability, audio_base64, char_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        personaId,
        input.text,
        input.model,
        input.stability,
        input.audioBase64,
        input.charCount,
        input.createdAt,
      )
      .run();
    return;
  }

  await raw
    .prepare(
      `INSERT INTO voice_history (persona_id, text, model, stability, audio_base64, char_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      personaId,
      input.text,
      input.model,
      input.stability,
      input.audioBase64,
      input.charCount,
    )
    .run();
}

export async function listVoiceHistory(
  db: DrizzleD1,
  options: { limit: number; offset: number },
): Promise<VoiceHistoryListItem[]> {
  const personaId = await getActivePersonaId(db);
  const result = await db.$client
    .prepare(
      `SELECT id, text, model, stability, char_count, created_at
       FROM voice_history
       WHERE persona_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(personaId, options.limit, options.offset)
    .all<VoiceHistoryListItem>();

  return result.results ?? [];
}

export async function countVoiceHistory(db: DrizzleD1): Promise<number> {
  const personaId = await getActivePersonaId(db);
  const row = await db.$client
    .prepare(`SELECT COUNT(*) as total FROM voice_history WHERE persona_id = ?`)
    .bind(personaId)
    .first<{ total: number }>();

  return row?.total ?? 0;
}

export async function getVoiceHistoryAudioById(
  db: DrizzleD1,
  id: number,
): Promise<VoiceHistoryAudioRow | null> {
  const personaId = await getActivePersonaId(db);
  return (
    (await db.$client
      .prepare(
        `SELECT audio_base64 FROM voice_history WHERE persona_id = ? AND id = ?`,
      )
      .bind(personaId, id)
      .first<VoiceHistoryAudioRow>()) ?? null
  );
}

export async function findVoiceHistoryIdByText(
  db: DrizzleD1,
  text: string,
): Promise<VoiceHistoryIdRow | null> {
  const personaId = await getActivePersonaId(db);
  return (
    (await db.$client
      .prepare(
        `SELECT id FROM voice_history WHERE persona_id = ? AND text = ? LIMIT 1`,
      )
      .bind(personaId, text)
      .first<VoiceHistoryIdRow>()) ?? null
  );
}

export async function findVoiceHistoryIdByCreatedAt(
  db: DrizzleD1,
  createdAt: string,
): Promise<VoiceHistoryIdRow | null> {
  const personaId = await getActivePersonaId(db);
  return (
    (await db.$client
      .prepare(
        `SELECT id FROM voice_history WHERE persona_id = ? AND created_at = ? LIMIT 1`,
      )
      .bind(personaId, createdAt)
      .first<VoiceHistoryIdRow>()) ?? null
  );
}

export async function listVoiceHistoryPlaceholders(
  db: DrizzleD1,
): Promise<VoiceHistoryPlaceholderRow[]> {
  const personaId = await getActivePersonaId(db);
  const result = await db.$client
    .prepare(
      `SELECT id, created_at
       FROM voice_history
       WHERE persona_id = ? AND text LIKE '[Voice message%'`,
    )
    .bind(personaId)
    .all<VoiceHistoryPlaceholderRow>();

  return result.results ?? [];
}

export async function updateVoiceHistoryText(
  db: DrizzleD1,
  options: { id: number; text: string },
): Promise<void> {
  const personaId = await getActivePersonaId(db);
  await db.$client
    .prepare(
      `UPDATE voice_history
       SET text = ?, char_count = ?
       WHERE persona_id = ? AND id = ?`,
    )
    .bind(options.text, options.text.length, personaId, options.id)
    .run();
}
