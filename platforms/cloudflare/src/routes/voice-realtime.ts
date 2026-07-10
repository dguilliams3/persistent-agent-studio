/**
 * Realtime voice session routes
 *
 * @module routes/voice-realtime
 * @description HTTP handlers for realtime voice session lifecycle:
 *   - POST /voice/realtime/start
 *   - POST /voice/realtime/transcript
 *   - POST /voice/realtime/end
 *
 * WHY THESE ROUTES EXIST:
 * - Provide a stable API surface for web UI, Telegram, and automation tools.
 * - Keep realtime orchestration inside service modules instead of index.js.
 *
 * HOW TO USE:
 * - Start: POST /voice/realtime/start with provider/model options.
 * - Stream: POST /voice/realtime/transcript with role + text.
 * - End: POST /voice/realtime/end with sessionId and optional usage.
 *
 * ANTIPATTERNS:
 * - Do NOT bypass these routes and write transcripts directly to history.
 * - Do NOT mutate request bodies here; normalization belongs in service layer.
 *
 * @upstream Called by: routes/registry.js via dispatchRoute()
 * @downstream Calls: voice/realtime/service.js
 *
 * @tests tests/voice/realtime-service.test.js
 */

import {
  startRealtimeSession,
  appendRealtimeTranscript,
  endRealtimeSession
} from '../voice/realtime/index.js';
import type { Env } from '../bootstrap.js';
import type { BuildSystemPromptResult } from '../voice/realtime/seed.js';

type VoiceRealtimeRouteContext = {
  db: D1Database;
  env: Env;
  body: Record<string, unknown>;
  buildSystemPrompt: (db: D1Database, env: Env) => Promise<BuildSystemPromptResult>;
  getResponseHeaders: (path: string, method: string) => HeadersInit;
};

/**
 * @description Handle POST /voice/realtime/start
 *
 * @param {Object} ctx - Route context
 * @param {D1Database} ctx.db - Database instance
 * @param {Object} ctx.env - Environment bindings
 * @param {Object} ctx.body - Parsed JSON request body
 * @param {Function} ctx.buildSystemPrompt - Context builder dependency
 * @param {Function} ctx.getResponseHeaders - Header helper
 * @returns {Promise<Response>} JSON response with session seed
 */
export async function handleVoiceRealtimeStart(ctx: VoiceRealtimeRouteContext) {
  const result = await startRealtimeSession({
    db: ctx.db,
    env: ctx.env,
    buildSystemPrompt: ctx.buildSystemPrompt,
    options: ctx.body
  });

  const status = result.success ? 200 : 400;
  return Response.json(result, {
    status,
    headers: ctx.getResponseHeaders('/voice/realtime/start', 'POST')
  });
}

/**
 * @description Handle POST /voice/realtime/transcript
 *
 * @param {Object} ctx - Route context
 * @param {D1Database} ctx.db - Database instance
 * @param {Object} ctx.body - Parsed JSON request body
 * @param {Function} ctx.getResponseHeaders - Header helper
 * @returns {Promise<Response>} JSON response with status
 */
export async function handleVoiceRealtimeTranscript(ctx: VoiceRealtimeRouteContext) {
  const result = await appendRealtimeTranscript({
    db: ctx.db,
    payload: ctx.body
  });

  const status = result.success ? 200 : 400;
  return Response.json(result, {
    status,
    headers: ctx.getResponseHeaders('/voice/realtime/transcript', 'POST')
  });
}

/**
 * @description Handle POST /voice/realtime/end
 *
 * @param {Object} ctx - Route context
 * @param {D1Database} ctx.db - Database instance
 * @param {Object} ctx.body - Parsed JSON request body
 * @param {Function} ctx.getResponseHeaders - Header helper
 * @returns {Promise<Response>} JSON response with cost estimate (if available)
 */
export async function handleVoiceRealtimeEnd(ctx: VoiceRealtimeRouteContext) {
  const result = await endRealtimeSession({
    db: ctx.db,
    payload: ctx.body
  });

  const status = result.success ? 200 : 400;
  return Response.json(result, {
    status,
    headers: ctx.getResponseHeaders('/voice/realtime/end', 'POST')
  });
}
