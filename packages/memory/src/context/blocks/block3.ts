/**
 * Block 3 Builder (STABLE Context + Summary Prefix)
 *
 * @module @persistence/memory/context/blocks/block3
 * @description Builds Block 3 of the 4-block context system.
 *
 * BLOCK 3: STABLE CONTEXT + SUMMARIES PREFIX
 * - Observations about the user
 * - Summaries prefix (older compressed history)
 *
 * NOTE: Learned, Questions, and Notebook were moved to Block 4
 * so they appear closer to history/current state and are never stale-cached.
 *
 * DESIGN:
 * - Changes infrequently (hours to days)
 * - Cache TTL: 1 hour
 * - Invalidates when Clio takes OBSERVATION actions
 * - Separate from Block 2 to allow independent cache management
 *
 * ORDERING:
 * - Observations first (user context)
 * - Summaries last (compressed history prefix)
 *
 * @upstream Used by:
 *   - context/builder/ - Main context assembly orchestrator
 *   - platforms/cloudflare/src/prompts/build-system-prompt.js - During migration
 * @downstream Calls:
 *   - ../formatters/ - Format functions for each section
 */

import type { Block3Data, BlockResult } from './types';
import { BLOCK } from '../../types';

/**
 * Build Block 3 (STABLE context + summary prefix).
 *
 * Assembles stable content that changes infrequently.
 * Cache invalidates when action-modifiable content changes
 * (OBSERVATION actions).
 *
 * NOTE: Learned, Questions, and Notebook were moved to Block 4
 * so they appear closer to history/current state and are never stale-cached.
 *
 * @description Builds Block 3 of the 4-block system with stable context (observations, summary prefix)
 * @upstream Called by: context/builder/, platforms/cloudflare/src/prompts/build-system-prompt.js
 * @downstream Calls: formatSummary() (platform-specific)
 *
 * @param {Block3Data} data - Block 3 data
 * @param {Function} formatSummary - Function to format a summary for context
 * @param {Function} formatDateTime - Function to format datetime for display
 * @returns {BlockResult} Block result with formatted text and metadata
 *
 * @example
 * import { buildBlock3 } from '@persistence/memory/context/blocks';
 * import { formatSummaryForContext } from '@persistence/memory/context/formatters';
 * import { formatEasternDateTime } from './utils';
 *
 * const result = buildBlock3(data, formatSummaryForContext, formatEasternDateTime);
 * console.log(result.text);
 */
export function buildBlock3(
  data: Block3Data,
  formatSummary: (summary: any, index: number | null, timezone?: string) => string,
  formatDateTime: (date: Date, timezone?: string) => string
): BlockResult {
  const {
    observations,
    summaryPrefix
  } = data;

  const sections: string[] = [];

  // Observations section
  if (observations.length > 0) {
    const observationsText = observations.map(o =>
      `- "${o.title}" - ${o.summary || '(no summary)'}`
    ).join('\n');

    sections.push(`MY OBSERVATIONS ABOUT THE USER (${observations.length} entries - use RETRIEVE_OBSERVATION to review):
${observationsText}`);
  }

  // Summaries prefix section
  if (summaryPrefix.length > 0) {
    const summariesText = summaryPrefix.map((s, i) =>
      formatSummary(s, i + 1)
    ).join('\n\n');

    sections.push(`SUMMARIES OF EARLIER HISTORY:
${summariesText}`);
  }

  const text = sections.length > 0
    ? `--- STABLE CONTEXT ---
${sections.join('\n\n')}`
    : '';

  const estimatedTokens = Math.ceil(text.length / 4);

  return {
    blockNumber: BLOCK.STABLE,
    text,
    estimatedTokens,
    cached: true,
    cacheTtl: '1hr',
    metadata: {
      observationsCount: observations.length,
      summaryPrefixCount: summaryPrefix.length
    }
  };
}
