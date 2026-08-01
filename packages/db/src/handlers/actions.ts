/**
 * Action handler functions
 *
 * @module @persistence/db/handlers/actions
 * @description Pure handler functions for POST action endpoints.
 * Accept typed params and db, return response-ready shapes.
 *
 * @upstream Called by: platforms/cloudflare/src/routes/registry.ts
 * @downstream Calls: @persistence/db state, history, cold-storage, notebook functions
 */

import type { DrizzleD1 } from '../client';

import {
  getState,
  setState,
  addColdStorage,
  saveNote,
  logHistory,
  queueQuickFollowup,
} from '../index';

type JsonBody = Record<string, unknown>;

/** Max visitor-name length for the message `from` field. */
const VISITOR_FROM_MAX = 64;

/**
 * Sanitizes an optional visitor `from` name: trimmed, ≤64 chars, no control
 * characters. Returns the clean name, null when absent, or 'invalid' when a
 * value was PROVIDED but unusable — callers must reject 'invalid' loudly.
 */
export function sanitizeVisitorFrom(raw: unknown): string | null | 'invalid' {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') return 'invalid';
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > VISITOR_FROM_MAX) return 'invalid';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return 'invalid';
  return trimmed;
}

/**
 * POST /message - User or fleet visitor sends a message to the entity
 *
 * Accepts optional `from` metadata for signed inbound attribution, and queues
 * a quick follow-up so message arrivals can bypass the normal cycle interval.
 *
 * @downstream logHistory — appends user_message event to history table;
 *   queueQuickFollowup — sets quick_followup_at + reason
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern basin-pattern — message insertion is a history append, never an update
 * @antipattern Do NOT update or overwrite history entries — history is append-only
 */
export async function handlePostMessage(db: DrizzleD1, body: JsonBody) {
  const content = body.content as string | undefined;
  const image = body.image as string | undefined;
  if (!content && !image) {
    return { error: 'No content', status: 400 };
  }

  const from = sanitizeVisitorFrom(body.from);
  if (from === 'invalid') {
    return {
      error: `Invalid 'from': must be 1-${VISITOR_FROM_MAX} printable characters`,
      status: 400,
    };
  }

  await logHistory({
    db,
    type: 'user_message',
    content: content || '[image only]',
    internal: image || null,
    ...(from ? { metadata: { from } } : {}),
  });
  const followup = await queueQuickFollowup(db, { reason: 'user_message' });
  return { success: true, followup, ...(from ? { from } : {}) };
}

/**
 * POST /profile-picture - Sets entity's profile picture
 *
 * @downstream setState — writes profile_picture, profile_picture_thumbnail, profile_picture_timestamp to state table
 * @upstream platforms/cloudflare/src/routes/actions.ts (platform wrapper injects resizeImageFunction)
 * @pattern dependency-injection — resizeImageFunction is platform-provided to keep db package platform-agnostic
 * @antipattern Do NOT import platform-specific image utilities directly here — receive them as parameters
 * @param resizeImageFunction - Platform-provided image resize function
 */
export async function handleSetProfilePicture(
  db: DrizzleD1,
  body: JsonBody,
  resizeImageFunction: (base64: string, maxDimension: number, quality: number) => { base64?: string }
) {
  const image = body.image as string | undefined;
  if (!image) {
    return { error: 'No image provided', status: 400 };
  }

  const thumbnail = resizeImageFunction(image, 256, 70);
  const timestamp = new Date().toISOString();

  await setState(db, 'profile_picture', image);
  await setState(db, 'profile_picture_thumbnail', thumbnail.base64 || image);
  await setState(db, 'profile_picture_timestamp', timestamp);

  return { success: true, thumbnail: thumbnail.base64 || image, timestamp };
}

/**
 * DELETE /profile-picture - Removes entity's profile picture
 *
 * @downstream setState — nulls profile_picture, profile_picture_thumbnail, profile_picture_timestamp
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern stateless-mutation — clears three state keys atomically; no history entry required
 * @antipattern Do NOT delete history entries to "remove" a picture — history is append-only; use state keys
 */
export async function handleDeleteProfilePicture(db: DrizzleD1) {
  await setState(db, 'profile_picture', null);
  await setState(db, 'profile_picture_thumbnail', null);
  await setState(db, 'profile_picture_timestamp', null);
  return { success: true };
}

/**
 * POST /save-art - Saves a UI-generated image to gallery
 *
 * @downstream logHistory — appends art_result or user_art event with image as content
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern basin-pattern — art is stored as a history event, making it naturally append-only
 * @antipattern Do NOT store art in a separate table — gallery reads come from history (type = art_result | user_art)
 */
export async function handleSaveArt(db: DrizzleD1, body: JsonBody) {
  const image = body.image as string | undefined;
  const prompt = body.prompt as string | undefined;
  const type = body.type as string | undefined;
  if (!image) {
    return { error: 'No image provided', status: 400 };
  }

  const artType = type === 'art_result' ? 'art_result' : 'user_art';
  const internalNote = artType === 'art_result'
    ? `Generated: ${prompt || 'No prompt provided'}`
    : `User's prompt: ${prompt || 'No prompt provided'}`;

  const result = await logHistory({
    db,
    type: artType,
    content: image,
    internal: internalNote
  });

  return { success: true, id: result?.id };
}

/**
 * POST /cold-storage - Adds a new frozen memory
 *
 * @downstream addColdStorage — inserts into cold_storage table; logHistory — appends cold_storage event
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern dual-write — cold storage write is mirrored to history for auditability
 * @antipattern Do NOT write cold storage without a corresponding history entry — audit trail is required
 */
export async function handlePostColdStorage(db: DrizzleD1, body: JsonBody) {
  const content = body.content as string | undefined;
  const context = body.context as string | undefined;
  if (!content) {
    return { error: 'No content provided', status: 400 };
  }

  await addColdStorage(db, content, context || '');
  await logHistory({ db, type: 'cold_storage', content, internal: context || 'Manually added via Web UI' });
  return { success: true };
}

/**
 * POST /notebook - Saves a new note
 *
 * @downstream saveNote — inserts into notebook table; logHistory — appends note_saved event
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern dual-write — notebook write is mirrored to history for auditability
 * @antipattern Do NOT write to notebook without a corresponding history entry
 */
export async function handlePostNotebook(db: DrizzleD1, body: JsonBody) {
  const title = body.title as string | undefined;
  const content = body.content as string | undefined;
  const summary = body.summary as string | undefined;
  if (!title || !content) {
    return { error: 'Title and content are required', status: 400 };
  }

  await saveNote(db, title, content, summary || '');
  await logHistory({ db, type: 'note_saved', content: `Note: ${title}`, internal: content });
  return { success: true };
}

/**
 * POST /reset - Resets all state (destructive operation!)
 *
 * @downstream setState — clears loop_count, last_wake_time, last_message_to_user, is_running
 * @upstream platforms/cloudflare/src/routes/registry.ts
 * @pattern state-mutation — resets operational loop state only; history and memory are not affected
 * @antipattern Do NOT use this to "clear" history or cold storage — this only resets transient loop state
 */
export async function handleReset(db: DrizzleD1) {
  await setState(db, 'loop_count', '0');
  await setState(db, 'last_wake_time', null);
  await setState(db, 'last_message_to_user', null);
  await setState(db, 'is_running', 'false');
  return { success: true };
}
