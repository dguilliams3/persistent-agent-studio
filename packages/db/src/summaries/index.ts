/**
 * Summaries table operations barrel file
 *
 * @module @persistence/db/summaries
 * @description Centralized exports for all summary-related database operations.
 *
 * Summaries are compressed batches of history entries. When history grows too large,
 * older entries are compressed into summaries to preserve context while reducing
 * token usage. Meta-summaries consolidate multiple summaries into one, creating a
 * hierarchical compression.
 *
 * The three-tier system (v25):
 * - **cached**: Pinned to stable context block (Anthropic cache-friendly)
 * - **tail**: Dynamic context, most recent summaries
 * - **archived**: Not in direct context, available via RAG
 *
 * Re-exports all summary functions from individual modules for convenient importing:
 *   import { getActiveSummaries, addSummary, setSummaryTier } from '@persistence/db/summaries';
 *
 * Or import from specific modules for clarity:
 *   import { getActiveSummaries } from '@persistence/db/summaries/retrieval';
 *
 * @upstream Called by:
 *   - packages/db/src/index.ts - Main barrel file re-exports
 *   - platforms/cloudflare/src/ - Routes, services, and context assembly
 *   - packages/memory/src/summarization/ - Summary creation
 */

// =============================================================================
// CRUD OPERATIONS
// =============================================================================
// Basic create, read, update, archive operations for the summaries table.
// Handles summary creation from history or other summaries, metadata updates,
// and bulk archival with lineage tracking.
//
// @upstream: Summary creation, route handlers
// @downstream: D1 queries on summaries table
// =============================================================================
export {
  getSummaries,
  getAllSummaries,
  getSummaryById,
  addSummary,
  archiveSummaries,
  updateSummaryEmbedding,
  updateSummaryMetadata,
} from './crud';

// =============================================================================
// RETRIEVAL OPERATIONS
// =============================================================================
// Query functions for retrieving summaries by various criteria.
// Handles context building (active summaries), tier-based retrieval,
// and promoted summary access.
//
// @upstream: Context building, status commands, API endpoints
// @downstream: D1 queries with tier-aware sorting
// =============================================================================
export {
  getActiveSummaries,
  getContextSummaries,
  getBufferSummaries,
  getActiveCount,
  getPromotedSummaries,
  // RAG retrieval
  getSummariesWithEmbeddings,
  type GetSummariesWithEmbeddingsOptions,
} from './retrieval';

// Re-export SummaryRow type for RAG retrieval consumers
export type { SummaryRow } from './mappers';

// =============================================================================
// TIER MANAGEMENT
// =============================================================================
// v25 tier system: cached, tail, archived. Functions for moving summaries
// between tiers, promoting/demoting, and activating/archiving.
//
// @upstream: Tier management endpoints, UI controls
// @downstream: D1 UPDATE queries
// =============================================================================
export {
  setSummaryTier,
  setSummaryTierPosition,
  moveSummary,
  promoteSummary,
  demoteSummary,
  activateSummary,
  archiveSummaryById,
} from './tiers';

// =============================================================================
// STATISTICS
// =============================================================================
// Aggregation and analytics functions for dashboard displays.
//
// @upstream: Stats endpoints, monitoring
// @downstream: D1 aggregate queries
// =============================================================================
export {
  getSummaryStats,
} from './stats';

// =============================================================================
// LIFECYCLE AND POSITIONING
// =============================================================================
// Sort position management and covered_start backfill operations.
// Includes date parsing utilities for covered_range strings.
//
// @upstream: Position endpoints, migration scripts
// @downstream: D1 UPDATE queries
// =============================================================================
export {
  parseCoveredRangeStartDate,
  setSummaryPosition,
  batchSummaryPositions,
  setCoveredStart,
  backfillCoveredStart,
} from './lifecycle';
