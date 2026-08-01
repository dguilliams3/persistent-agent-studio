/**
 * Realtime voice cost estimation helpers
 *
 * @module voice/realtime/costs
 * @description Computes cost estimates for realtime sessions using optional
 * provider pricing metadata. Returns null when pricing is unknown.
 *
 * WHY THIS EXISTS:
 * - We want cost visibility without coupling to a single provider API response.
 * - Estimates can be computed at session start (seed cost) or end (usage cost).
 *
 * HOW TO USE:
 * - Provide tokens + audio seconds when you have usage data.
 * - If usage data is missing, pass zeros or omit the call entirely.
 *
 * ANTIPATTERNS:
 * - Do NOT return fabricated costs when pricing is missing. Returning null
 *   is safer than misleading users or making budgeting decisions impossible.
 * - Do NOT mix pricing sources across providers; model metadata should remain
 *   centralized in config.js.
 *
 * @upstream Called by:
 *   - voice/realtime/service.js - session start/end cost breakdown
 * @downstream Calls:
 *   - None (pure calculation)
 *
 * @tests tests/voice/realtime-service.test.js
 */

import { resolveRealtimeModel } from './config.js';

const TOKENS_PER_MILLION = 1_000_000;

interface EstimateRealtimeCostParams {
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  audioSeconds?: number;
}

/**
 * @description Estimate realtime costs in USD
 *
 * When pricing metadata is unavailable, returns null to avoid misleading numbers.
 *
 * WHY: Token and audio usage are often partial or delayed, so this helper is
 * intentionally conservative and avoids "guessing" unknown pricing.
 *
 * @upstream Called by: voice/realtime/service.js
 * @downstream Calls: resolveRealtimeModel()
 *
 * @param {Object} params - Cost estimation parameters
 * @param {string} params.provider - Provider id (e.g., "openai")
 * @param {string} params.model - Model id or alias
 * @param {number} params.inputTokens - Input token count
 * @param {number} params.outputTokens - Output token count
 * @param {number} params.audioSeconds - Audio duration in seconds
 * @returns {Object|null} Cost breakdown or null if pricing unavailable
 *
 * @tests tests/voice/realtime-service.test.js
 */
export function estimateRealtimeCostUsd({
  provider,
  model,
  inputTokens = 0,
  outputTokens = 0,
  audioSeconds = 0
}: EstimateRealtimeCostParams) {
  const modelConfig = resolveRealtimeModel(provider, model);
  if (!modelConfig?.pricing) {
    return null;
  }

  const inputCost = (inputTokens / TOKENS_PER_MILLION) * (modelConfig.pricing.inputPerMTokUsd || 0);
  const outputCost = (outputTokens / TOKENS_PER_MILLION) * (modelConfig.pricing.outputPerMTokUsd || 0);
  const audioCost = (audioSeconds / 60) * (modelConfig.pricing.audioPerMinuteUsd || 0);
  const totalUsd = inputCost + outputCost + audioCost;

  return {
    totalUsd,
    breakdown: {
      inputUsd: inputCost,
      outputUsd: outputCost,
      audioUsd: audioCost
    }
  };
}
