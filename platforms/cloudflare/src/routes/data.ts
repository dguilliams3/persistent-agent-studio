/**
 * Data retrieval routes (platform re-export)
 *
 * @module routes/data
 * @description Re-exports data handler functions from @persistence/db/handlers/data.
 * Only handleBackfillEmbeddings needs platform-specific wrapping (env.AI binding).
 *
 * @upstream Called by: routes/index.ts, routes/registry.ts
 * @downstream Delegates to: @persistence/db/handlers/data
 */

import type { Env } from '../bootstrap.js';

// Re-export all pure handlers from package
export {
  handleGetState,
  handleGetHistory,
  handleGetColdStorage,
  handleGetNotebook,
  handleGetObservations,
  handleGetSummaries,
  handleGetReminders,
  handleGetCycles,
  handleGetGallery,
  handleGetProfilePicture,
  handlePromoteSummary,
  handleDemoteSummary,
  handleActivateSummary,
  handleArchiveSummary,
  handleGetMeters,
  handleSetMeter,
  handleSetMetersBatch,
  handleSetSummaryPosition,
  handleBackfillCoveredStart,
  handleSetSummaryTier,
  handleMoveSummary,
} from '@persistence/db/handlers/data';

import { handleBackfillEmbeddings as _handleBackfillEmbeddings } from '@persistence/db/handlers/data';

/**
 * Platform-specific wrapper for handleBackfillEmbeddings.
 * Adapts env.AI Cloudflare binding to the generic embedding provider interface.
 * Injects embeddingToBlob serializer to avoid @persistence/memory DAG violation in db package.
 */
export async function handleBackfillEmbeddings(db: D1Database, env: Env) {
  const { CloudflareEmbeddingProvider, EMBEDDING_MODEL } = await import('@persistence/services');
  const { embeddingToBlob } = await import('@persistence/memory');
  const provider = CloudflareEmbeddingProvider.fromBinding(env.AI);
  return _handleBackfillEmbeddings(db, provider, EMBEDDING_MODEL, embeddingToBlob);
}
