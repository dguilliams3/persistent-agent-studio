/**
 * OpenAI Realtime provider adapter
 *
 * @module voice/realtime/providers/openai
 * @description Handles OpenAI realtime session creation and request shaping.
 *
 * WHY THIS EXISTS:
 * - Encapsulates OpenAI-specific HTTP payloads and endpoints so other providers
 *   can be added without touching orchestration logic.
 *
 * HOW TO USE:
 * - This adapter is called via createRealtimeProviderSession()
 *   with env.OPENAI_API_KEY and optional endpoint override.
 *
 * ANTIPATTERNS:
 * - Do NOT embed OpenAI request logic in service.js or routes.
 * - Do NOT assume response formats; always guard with response.ok.
 *
 * @upstream Called by:
 *   - voice/realtime/providers/index.js - adapter registry
 * @downstream Calls:
 *   - fetch() to OpenAI realtime sessions endpoint
 *
 * @tests tests/voice/realtime-service.test.js
 */

import { resolveRealtimeModel, resolveRealtimeProvider } from '../config.js';

export interface OpenAiRealtimeSessionParams {
  env?: {
    OPENAI_API_KEY?: string;
    OPENAI_REALTIME_ENDPOINT?: string;
  };
  model: string;
  voice?: string;
  modalities?: string[];
  instructions?: string;
  metadata?: Record<string, unknown>;
  endpoint?: string;
}

/**
 * @description Build the OpenAI realtime session payload
 *
 * WHY: keeps payload shaping isolated so we can evolve parameters without
 * touching core orchestration or UI call sites.
 *
 * @upstream Called by: createOpenAiRealtimeSession()
 * @downstream Calls: resolveRealtimeModel()
 *
 * @param {Object} params - Session parameters
 * @param {string} params.model - Model alias or id
 * @param {string} [params.voice] - Voice identifier
 * @param {Array<string>} [params.modalities] - Modalities list (audio, text)
 * @param {string} [params.instructions] - System instructions
 * @param {Object} [params.metadata] - Optional metadata
 * @returns {Object} OpenAI session payload
 */
export function buildOpenAiRealtimePayload({
  model,
  voice = 'alloy',
  modalities = ['audio', 'text'],
  instructions = '',
  metadata = {}
}: OpenAiRealtimeSessionParams) {
  const modelConfig = resolveRealtimeModel('openai', model);

  return {
    model: modelConfig.id,
    voice,
    modalities,
    instructions,
    metadata
  };
}

/**
 * @description Create a realtime session via OpenAI API
 *
 * WHY: Provides a single choke point for API keys, endpoint overrides, and
 * error normalization so other layers stay provider-agnostic.
 *
 * @upstream Called by: voice/realtime/providers/index.js
 * @downstream Calls: fetch()
 *
 * @param {Object} params - Session parameters
 * @param {Object} params.env - Environment bindings
 * @param {string} params.model - Model alias or id
 * @param {string} [params.voice] - Voice identifier
 * @param {Array<string>} [params.modalities] - Modalities list
 * @param {string} [params.instructions] - System instructions
 * @param {Object} [params.metadata] - Optional metadata
 * @param {string} [params.endpoint] - Optional override for session endpoint
 * @returns {Promise<Object>} Result with session or error
 */
export async function createOpenAiRealtimeSession(params: OpenAiRealtimeSessionParams) {
  const providerConfig = resolveRealtimeProvider('openai');
  const apiKey = params?.env?.OPENAI_API_KEY;
  const endpointOverride = params?.env?.OPENAI_REALTIME_ENDPOINT || params?.endpoint;

  if (!apiKey) {
    return { success: false, error: 'OPENAI_API_KEY not configured' };
  }

  const sessionEndpoint = endpointOverride || providerConfig?.sessionEndpoint;
  if (!sessionEndpoint) {
    return { success: false, error: 'OpenAI realtime endpoint is not configured' };
  }

  const payload = buildOpenAiRealtimePayload(params);

  try {
    const response = await fetch(sessionEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `OpenAI realtime session failed: ${response.status} ${errorText}`
      };
    }

    const session = await response.json();
    return { success: true, session };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'OpenAI realtime session error' };
  }
}
