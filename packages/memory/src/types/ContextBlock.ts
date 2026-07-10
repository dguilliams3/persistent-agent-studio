/**
 * Named constants for cache block identification.
 *
 * BLOCK.CONSTITUTION (1): Static content — system prompt, cold storage, MY SPACE
 * BLOCK.PROMOTED (2):     Rarely changes — pinned/promoted summaries
 * BLOCK.STABLE (3):       Daily changes — learned, notebook, MOST SUMMARIES
 * BLOCK.FRESH (4):        Every cycle — RAG results, history tail, reminders
 *
 * @example
 * summary.tier = BLOCK.STABLE;  // Clear intent
 * summary.tier = 3;             // Same effect, less clear
 */
export const BLOCK = {
  CONSTITUTION: 1,
  PROMOTED: 2,
  STABLE: 3,
  FRESH: 4,
} as const;

/**
 * All context blocks (1-4).
 * Block 1 = Constitution (static), not used for summaries.
 */
export type ContextBlock = 1 | 2 | 3 | 4;

/**
 * Blocks where summaries can live (2-4, excludes Block 1 Constitution).
 * Use this type when narrowing from SummaryTier.
 */
export type SummaryContextBlock = 2 | 3 | 4;

/**
 * Type guard to check if a tier is an in-context block (not archived).
 *
 * @param tier - Tier to check
 * @returns True if tier is a numeric block (2-4), false if 'archived'
 */
import type { SummaryTier } from './SummaryTier';

export function isInContext(tier: SummaryTier): tier is SummaryContextBlock {
  return typeof tier === 'number';
}
