/**
 * Block 2 Builder (PROMOTED Summaries)
 *
 * @module @persistence/memory/context/blocks/block2
 * @description Builds Block 2 of the 4-block context system.
 *
 * BLOCK 2: PROMOTED SUMMARIES
 * - Pinned/promoted summaries that bypass normal rotation
 * - Changes rarely (manually promoted by user or important themes)
 * - Cache TTL: 1 hour
 * - Small block (typically 0-3 summaries)
 *
 * DESIGN:
 * - Promoted summaries are marked with tier = BLOCK.PROMOTED (2)
 * - They stay in this block indefinitely until demoted
 * - Separate from the normal summary buffer rotation
 * - Provides stable cache block for important recurring themes
 *
 * @upstream Used by:
 *   - context/builder/ - Main context assembly orchestrator
 *   - platforms/cloudflare/src/prompts/build-system-prompt.js - During migration
 * @downstream Calls:
 *   - ../formatters/summaries - formatSummaryForContext
 *   - formatEasternDateTime from utils (platform-specific)
 */

import type { Block2Data, BlockResult } from './types';
import { BLOCK } from '../../types';

import { parseDbTimestamp } from '@persistence/db';
/**
 * Build Block 2 (PROMOTED summaries).
 *
 * Formats promoted/pinned summaries into a stable cache block.
 * These are summaries that have been manually promoted or represent
 * important recurring themes.
 *
 * @description Builds Block 2 of the 4-block system with promoted/pinned summaries
 * @upstream Called by: context/builder/, platforms/cloudflare/src/prompts/build-system-prompt.js
 * @downstream Calls: formatDateTime() (platform-specific)
 *
 * @param {Block2Data} data - Block 2 data (promoted summaries)
 * @param {Function} formatDateTime - Function to format datetime for display (platform-specific)
 * @returns {BlockResult} Block result with formatted text and metadata
 *
 * @example
 * import { buildBlock2 } from '@persistence/memory/context/blocks';
 * import { formatEasternDateTime } from './utils';
 *
 * const result = buildBlock2({ promotedSummaries }, formatEasternDateTime);
 * console.log(result.text);  // Formatted block text
 * console.log(result.estimatedTokens);  // Token estimate
 */
export function buildBlock2(
  data: Block2Data,
  formatDateTime: (date: Date, timezone?: string) => string
): BlockResult {
  const { promotedSummaries } = data;

  if (promotedSummaries.length === 0) {
    return {
      blockNumber: BLOCK.PROMOTED,
      text: '',
      estimatedTokens: 0,
      cached: true,
      cacheTtl: '1hr',
      metadata: {
        promotedCount: 0
      }
    };
  }

  // Format promoted summaries section
  const formattedSummaries = promotedSummaries.map(s => {
    const timestamp = formatDateTime(parseDbTimestamp(s.created_at));
    return `[${timestamp}] ${s.summary}`;
  }).join('\n\n');

  const text = `--- PROMOTED SUMMARIES ---

PROMOTED SUMMARIES (pinned to stable context):
${formattedSummaries}`;

  // Estimate tokens (~4 chars per token)
  const estimatedTokens = Math.ceil(text.length / 4);

  return {
    blockNumber: BLOCK.PROMOTED,
    text,
    estimatedTokens,
    cached: true,
    cacheTtl: '1hr',
    metadata: {
      promotedCount: promotedSummaries.length
    }
  };
}
