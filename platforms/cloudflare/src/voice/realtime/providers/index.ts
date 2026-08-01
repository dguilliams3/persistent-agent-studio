/**
 * Realtime voice provider adapter registry
 *
 * @module voice/realtime/providers
 * @description Provider adapter lookup for realtime session creation.
 *
 * WHY THIS EXISTS:
 * - Keeps provider-specific API calls out of orchestration logic.
 * - Makes it easy to add a new provider by registering one function.
 *
 * HOW TO EXTEND:
 * - Add a new provider adapter (e.g., providers/xyz.js)
 * - Register it in PROVIDER_CREATORS below.
 *
 * ANTIPATTERNS:
 * - Avoid branching on provider inside service.js (that defeats modularity).
 * - Avoid exposing raw provider response shapes outside adapters.
 *
 * @upstream Called by:
 *   - voice/realtime/service.js - provider session creation
 * @downstream Calls:
 *   - voice/realtime/providers/openai.js
 *
 * @tests tests/voice/realtime-service.test.js
 */

import { createOpenAiRealtimeSession, type OpenAiRealtimeSessionParams } from './openai.js';

type ProviderSessionParams = OpenAiRealtimeSessionParams;

interface ProviderSessionResult {
  success: boolean;
  session?: unknown;
  error?: string;
}

const PROVIDER_CREATORS = {
  openai: createOpenAiRealtimeSession
};

/**
 * @description Create a provider-specific realtime session
 *
 * WHY: isolates vendor-specific API calls from orchestration logic so
 * higher-level flows stay stable even as providers change endpoints.
 *
 * @upstream Called by: voice/realtime/service.js
 * @downstream Calls: provider adapter functions (OpenAI, etc.)
 *
 * @param {string} providerId - Provider identifier
 * @param {Object} params - Provider session parameters
 * @returns {Promise<Object>} { success, session, error }
 */
export async function createRealtimeProviderSession(providerId: string, params: ProviderSessionParams): Promise<ProviderSessionResult> {
  const creator = PROVIDER_CREATORS[providerId as keyof typeof PROVIDER_CREATORS];
  if (!creator) {
    return { success: false, error: `Unknown realtime provider: ${providerId}` };
  }

  return creator(params);
}
