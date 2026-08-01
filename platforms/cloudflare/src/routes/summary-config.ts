/**
 * Summary configuration API routes
 *
 * @module routes/summary-config
 * @description Simple pass-through handlers that call the DRY service helpers.
 */

import {
  getSummaryConfig,
  updateSummaryConfig
} from '../services/summary-config.js';

/**
 * GET /summary-config - return live tier stats and current thresholds.
 *
 * @param {D1Database} db - Database instance
 * @returns {Promise<Object>}
 */
export async function handleGetSummaryConfig(db: D1Database) {
  return getSummaryConfig(db);
}

/**
 * POST /summary-config - update token thresholds (validated in service).
 *
 * @param {D1Database} db - Database instance
 * @param {Object} body - Request payload
 * @returns {Promise<Object>}
 */
export async function handlePostSummaryConfig(db: D1Database, body: Record<string, unknown>) {
  return updateSummaryConfig(db, body);
}
