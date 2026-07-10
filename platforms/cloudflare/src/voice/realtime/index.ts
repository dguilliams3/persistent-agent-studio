/**
 * Realtime voice module barrel
 *
 * @module voice/realtime
 * @description Central exports for realtime voice orchestration.
 *
 * WHY THIS EXISTS:
 * - Provides a single import surface for realtime voice components so
 *   call sites don't need to know internal file layout.
 * - Reduces boilerplate and keeps usage consistent across routes/Telegram/UI.
 *
 * WHAT IT PROVIDES:
 * - Session orchestration (start/transcript/end)
 * - Provider/model configuration
 * - Cost estimation utilities
 *
 * ANTIPATTERN:
 * - Avoid re-exporting provider-specific helpers here unless they are
 *   intentionally part of the public interface. Keep the surface small.
 *
 * @upstream Called by:
 *   - routes/voice-realtime.js - HTTP endpoints
 *   - telegram/commands/realtime-voice.js - Telegram commands
 * @downstream Calls:
 *   - voice/realtime/service.js
 *   - voice/realtime/costs.js
 *   - voice/realtime/config.js
 */

// =============================================================================
// SERVICE ORCHESTRATION
// =============================================================================
export {
  startRealtimeSession,
  appendRealtimeTranscript,
  endRealtimeSession,
  mapTranscriptRoleToHistoryType
} from './service.js';

// =============================================================================
// COST ESTIMATION
// =============================================================================
export { estimateRealtimeCostUsd } from './costs.js';

// =============================================================================
// CONFIG + MODEL REGISTRY
// =============================================================================
export {
  REALTIME_PROVIDERS,
  REALTIME_MODELS,
  DEFAULT_REALTIME_PROVIDER,
  DEFAULT_REALTIME_MODEL,
  resolveRealtimeProvider,
  resolveRealtimeModel
} from './config.js';
