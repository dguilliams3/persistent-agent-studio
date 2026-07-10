/**
 * Utility functions barrel export
 *
 * This module re-exports utility functions from their specialized modules
 * for convenient importing elsewhere in the codebase.
 *
 * MODULES RE-EXPORTED:
 * - time.js: Eastern timezone formatting (toEastern, formatEasternTime, etc.)
 * - image.js: Image generation and compression (generateImage, etc.)
 * - normalize.js: Input normalization for graceful parameter handling
 * - history-logger.js: logHistory() for unified history entry creation
 * - @persistence/db: Internal state meters (METERS, setMeterValue, decay functions, etc.)
 *
 * NOT RE-EXPORTED (import directly from module if needed):
 * - tokens.js: Token counting - use services/tokenizer.js or @persistence/memory
 * - ../config/index.js: Import from constants.js instead
 *
 * NOTE: Summarization parsing moved to @persistence/memory package (2026-01-28)
 * NOTE: Meters moved to @persistence/db package (2026-01-28)
 *
 * @module utils
 *
 * @example
 * import { normalizeId, toEastern, logHistory, METERS } from './utils/index.js';
 */

export * from './time.js';
export * from './image.js';
export * from './normalize.js';
export {
  logHistory
} from './history-logger.js';
export {
  METERS,
  METER_EMOJI,
  DEFAULT_METER_VALUE,
  MAX_HISTORY_LENGTH,
  DEFAULT_DECAY_CONFIG,
  getMeterValues,
  setMeterValue,
  getMeterHistory,
  getAllMeterHistories,
  getMeterState,
  getAllMeterStates,
  setMeterState,
  applyDecayToAllMeters,
  migrateAllMetersToUnified,
  formatMeterBar,
  formatMeterCompact,
  formatHistoryTrend,
  formatMetersSection,
  getDecayInfo,
  // Involuntary meters (user-controlled, Clio reads only)
  getInvoluntaryMeterDisplays
} from '@persistence/db';
