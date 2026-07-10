/**
 * Summary Stats Module
 *
 * @module @persistence/memory/context/stats
 * @description Exports summary splitting and stats calculation functions.
 *
 * This module provides the SINGLE SOURCE OF TRUTH for:
 * - Categorizing summaries by tier and boundary
 * - Calculating token/count statistics per category
 *
 * @upstream Used by:
 *   - context/builder/build-context.ts - Context assembly
 *   - platforms/cloudflare/src/services/summary-config.js - Stats API
 */

export { splitSummariesByTierAndBoundary } from './split-summaries';
export type {
  SummarySplitResult,
  SummarySplitStats,
  SplitSummariesOptions
} from '../types';
