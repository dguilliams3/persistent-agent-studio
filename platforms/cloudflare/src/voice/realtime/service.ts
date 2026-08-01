/**
 * Realtime voice orchestration service
 *
 * @module voice/realtime/service
 * @description Core realtime session orchestration for start, transcript logging,
 * and end-of-call processing with provider adapter support.
 *
 * WHY THIS EXISTS:
 * - We need a single place that turns "realtime session lifecycle" into
 *   persistent history entries so context is preserved across interfaces.
 * - Centralizing orchestration prevents drift between API, Telegram, and UI flows.
 *
 * HOW IT FITS THE VISION:
 * - Supports long-running, identity-preserving voice calls.
 * - Keeps providers swappable while maintaining consistent memory persistence.
 *
 * ANTIPATTERNS:
 * - Do NOT log transcripts directly from routes; always use this service so
 *   metadata is consistent and cost tracking remains centralized.
 * - Do NOT attempt to compute costs without usage data; this service explicitly
 *   returns null when pricing or usage is unknown.
 *
 * @upstream Called by:
 *   - routes/voice-realtime.js - HTTP endpoints
 *   - telegram/commands/realtime-voice.js - Telegram control commands
 * @downstream Calls:
 *   - voice/realtime/seed.js buildRealtimeSeed()
 *   - voice/realtime/providers createRealtimeProviderSession()
 *   - voice/realtime/costs estimateRealtimeCostUsd()
 *   - utils/history-logger.js logHistory()
 *   - db/index.js getActivePersonaId()
 *
 * @tests tests/voice/realtime-service.test.js
 */

import { logHistory } from '../../utils/history-logger.js';
import { buildRealtimeSeed, type BuildSystemPromptResult } from './seed.js';
import { createRealtimeProviderSession } from './providers/index.js';
import { estimateRealtimeCostUsd } from './costs.js';
import {
  DEFAULT_REALTIME_MODEL,
  DEFAULT_REALTIME_PROVIDER,
  resolveRealtimeProvider,
  resolveRealtimeModel
} from './config.js';
import type { Env } from '../../bootstrap.js';

interface RealtimeSessionOptions {
  provider?: string;
  model?: string;
  voice?: string;
  modalities?: string[];
  seedMode?: 'full' | 'compact';
  includeSystemPrompt?: boolean;
  includeBlocks?: boolean;
  sessionLabel?: string;
  createProviderSession?: boolean;
}

interface StartRealtimeSessionParams {
  db: D1Database;
  env: Env;
  buildSystemPrompt: (db: D1Database, env: Env) => Promise<any>;
  options?: RealtimeSessionOptions;
}

interface TranscriptPayload {
  sessionId?: string;
  role?: string;
  text?: string;
  timestamp?: string | null;
  isFinal?: boolean;
  metadata?: Record<string, unknown> | null;
}

interface EndSessionPayload {
  sessionId?: string;
  provider?: string;
  model?: string;
  reason?: string;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    audioSeconds?: number;
  } | null;
}

/**
 * @description Normalize transcript role to history type
 *
 * WHY: Keeps the history table semantics aligned with the rest of the system
 * (user_message vs message_to_user) while allowing provider-specific roles.
 *
 * ANTIPATTERN: writing raw role names directly into history makes downstream
 * filtering harder and pollutes UI expectations.
 *
 * @param {string} role - Transcript role (user, assistant, system, etc.)
 * @returns {string} History type
 *
 * @tests tests/voice/realtime-service.test.js
 */
export function mapTranscriptRoleToHistoryType(role: string) {
  if (role === 'assistant') return 'message_to_user';
  if (role === 'user') return 'user_message';
  return 'voice_realtime_event';
}

/**
 * @description Start a realtime voice session
 *
 * WHY: This function stitches together the seed builder, provider adapter,
 * and history logging so the session can be resumed or audited later.
 *
 * @param {Object} params - Start parameters
 * @param {D1Database} params.db - Database instance
 * @param {Object} params.env - Environment bindings
 * @param {Function} params.buildSystemPrompt - buildSystemPrompt dependency
 * @param {Object} params.options - Session options
 * @returns {Promise<Object>} Session start result
 *
 * @tests tests/voice/realtime-service.test.js
 */
export async function startRealtimeSession({ db, env, buildSystemPrompt, options }: StartRealtimeSessionParams): Promise<Record<string, unknown>> {
  const sessionId = crypto.randomUUID();
  const provider = options?.provider || DEFAULT_REALTIME_PROVIDER;
  const model = options?.model || DEFAULT_REALTIME_MODEL;
  const providerConfig = resolveRealtimeProvider(provider);
  const modelConfig = resolveRealtimeModel(provider, model);

  if (!providerConfig) {
    return { success: false, error: `Unknown provider: ${provider}` };
  }

  const seedResult = await buildRealtimeSeed({
    db,
    env,
    buildSystemPrompt,
    options
  });

  const providerSession = options?.createProviderSession !== false
    ? await createRealtimeProviderSession(provider, {
      env: env as any,
      model: modelConfig.id,
      voice: options?.voice,
      modalities: options?.modalities || ['audio', 'text'],
      instructions: seedResult.seed.systemPrompt || '',
      metadata: {
        sessionId,
        personaId: seedResult.personaId,
        seedMode: options?.seedMode || 'full'
      }
    })
    : null;

  if (providerSession && !providerSession.success) {
    await logHistory({
      db,
      type: 'voice_realtime_error',
      content: `Realtime provider session failed (${sessionId})`,
      internal: JSON.stringify({
        sessionId,
        provider,
        model: modelConfig.id,
        error: providerSession.error,
        source: 'realtime_voice'
      })
    });

    return { success: false, error: providerSession.error };
  }

  const inputTokens = seedResult.tokenCounts.systemPromptTokens + seedResult.tokenCounts.blockTokens;
  const costEstimate = estimateRealtimeCostUsd({
    provider,
    model: modelConfig.id,
    inputTokens,
    outputTokens: 0,
    audioSeconds: 0
  });

  await logHistory({
    db,
    type: 'voice_realtime_start',
    content: `Realtime voice session started (${sessionId})`,
    internal: JSON.stringify({
      sessionId,
      provider,
      model: modelConfig.id,
      seedMode: options?.seedMode || 'full',
      includeSystemPrompt: options?.includeSystemPrompt ?? true,
      includeBlocks: options?.includeBlocks ?? true,
      sessionLabel: options?.sessionLabel || null,
      costEstimate,
      source: 'realtime_voice'
    })
  });

  return {
    success: true,
    sessionId,
    provider,
    model: modelConfig.id,
    personaId: seedResult.personaId,
    seed: seedResult.seed,
    stats: seedResult.stats,
    tokenCounts: seedResult.tokenCounts,
    costEstimate,
    providerSession
  };
}

/**
 * @description Append a transcript segment to history
 *
 * WHY: Transcript streaming is the lifeblood of context continuity.
 * This ensures every segment is captured with consistent metadata.
 *
 * @param {Object} params - Transcript parameters
 * @param {D1Database} params.db - Database instance
 * @param {Object} params.payload - Transcript payload
 * @returns {Promise<Object>} Result
 *
 * @tests tests/voice/realtime-service.test.js
 */
export async function appendRealtimeTranscript({ db, payload }: { db: D1Database; payload?: TranscriptPayload }) {
  const {
    sessionId,
    role,
    text,
    timestamp = null,
    isFinal = true,
    metadata = null
  } = payload || {};

  if (!sessionId || !role || !text) {
    return {
      success: false,
      error: 'Missing required fields: sessionId, role, text'
    };
  }

  const historyType = mapTranscriptRoleToHistoryType(role);

  await logHistory({
    db,
    type: historyType,
    content: text,
    internal: JSON.stringify({
      sessionId,
      role,
      timestamp,
      isFinal,
      metadata,
      source: 'realtime_voice'
    })
  });

  return { success: true, historyType };
}

/**
 * @description End a realtime voice session and log optional cost summary
 *
 * WHY: The end event is where we can attach final usage + cost metadata
 * without blocking the realtime streaming path.
 *
 * @param {Object} params - End parameters
 * @param {D1Database} params.db - Database instance
 * @param {Object} params.payload - End payload
 * @returns {Promise<Object>} Result
 *
 * @tests tests/voice/realtime-service.test.js
 */
export async function endRealtimeSession({ db, payload }: { db: D1Database; payload?: EndSessionPayload }) {
  const {
    sessionId,
    provider = DEFAULT_REALTIME_PROVIDER,
    model = DEFAULT_REALTIME_MODEL,
    reason = 'completed',
    summary = null,
    metadata = null,
    usage = null
  } = payload || {};

  if (!sessionId) {
    return { success: false, error: 'Missing required field: sessionId' };
  }

  const costEstimate = usage
    ? estimateRealtimeCostUsd({
      provider,
      model,
      inputTokens: usage.inputTokens || 0,
      outputTokens: usage.outputTokens || 0,
      audioSeconds: usage.audioSeconds || 0
    })
    : null;

  await logHistory({
    db,
    type: 'voice_realtime_end',
    content: summary || `Realtime voice session ended (${sessionId})`,
    internal: JSON.stringify({
      sessionId,
      provider,
      model,
      reason,
      summary,
      metadata,
      usage,
      costEstimate,
      source: 'realtime_voice'
    })
  });

  if (costEstimate) {
    await logHistory({
      db,
      type: 'voice_realtime_cost',
      content: `Realtime voice cost: $${costEstimate.totalUsd.toFixed(4)}`,
      internal: JSON.stringify({
        sessionId,
        provider,
        model,
        usage,
        costEstimate,
        source: 'realtime_voice'
      })
    });
  }

  return { success: true, costEstimate };
}
