/**
 * Voice Transcriptions API Routes
 *
 * @description REST endpoints for managing voice transcription corrections.
 *   Tracks the user's voice messages for STT training data.
 *
 * @upstream Called by: index.js handleRequest()
 * @downstream Calls: db/voiceTranscriptions.js functions
 *
 * Endpoints:
 *   GET  /voice-transcriptions           - List transcriptions with pagination
 *   GET  /voice-transcriptions/:id       - Get single transcription
 *   PUT  /voice-transcriptions/:id       - Update with corrections
 *   DELETE /voice-transcriptions/:id     - Delete entry (requires password)
 */

import {
  getVoiceTranscriptions,
  getVoiceTranscription,
  updateTranscriptionCorrection,
  deleteVoiceTranscription
} from '../db/index.js';

type VoiceCorrectionBody = {
  corrected_text?: string;
  corrected_emotion?: string;
  password?: string;
};

/**
 * @description Handle GET /voice-transcriptions - list with pagination
 *
 * @param {D1Database} db - D1 database instance
 * @param {URL} url - Request URL for query params
 * @returns {Response} JSON { items: Array, total: number }
 *
 * @example
 * GET /voice-transcriptions?limit=20&offset=0
 * GET /voice-transcriptions?needsCorrection=true
 */
export async function handleGetVoiceTranscriptions(db: D1Database, url: URL) {
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const needsCorrection = url.searchParams.get('needsCorrection') === 'true';

  const result = await getVoiceTranscriptions(db, {
    limit,
    offset,
    needsCorrection,
  });

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * @description Handle GET /voice-transcriptions/:id - get single transcription
 *
 * @param {D1Database} db - D1 database instance
 * @param {string} id - Transcription ID from URL
 * @returns {Response} Single transcription or 404
 */
export async function handleGetVoiceTranscription(db: D1Database, id: string) {
  const entry = await getVoiceTranscription(db, parseInt(id));

  if (!entry) {
    return new Response(
      JSON.stringify({ error: 'Transcription not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify(entry), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * @description Handle PUT /voice-transcriptions/:id - update with corrections
 *
 * @param {D1Database} db - D1 database instance
 * @param {string} id - Transcription ID from URL
 * @param {Request} request - Request with JSON body
 * @returns {Response} Success or error
 *
 * @example
 * PUT /voice-transcriptions/1
 * Body: { "corrected_text": "I saw Kasey today", "corrected_emotion": "happy" }
 */
export async function handlePutVoiceTranscription(db: D1Database, id: string, request: Request) {
  const body = await request.json() as VoiceCorrectionBody;

  const success = await updateTranscriptionCorrection(db, parseInt(id), {
    correctedText: body.corrected_text,
    correctedEmotion: body.corrected_emotion,
  });

  if (!success) {
    return new Response(
      JSON.stringify({ error: 'Transcription not found or no changes made' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * @description Handle DELETE /voice-transcriptions/:id (requires password)
 *
 * @param {D1Database} db - D1 database instance
 * @param {string} id - Transcription ID from URL
 * @param {Request} request - Request with password in body
 * @param {string} adminPassword - Expected admin password
 * @returns {Response} Success or error
 */
export async function handleDeleteVoiceTranscription(db: D1Database, id: string, request: Request, adminPassword: string) {
  const body = await request.json() as VoiceCorrectionBody;

  if (body.password !== adminPassword) {
    return new Response(
      JSON.stringify({ error: 'Invalid password' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const success = await deleteVoiceTranscription(db, parseInt(id));

  if (!success) {
    return new Response(
      JSON.stringify({ error: 'Transcription not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
