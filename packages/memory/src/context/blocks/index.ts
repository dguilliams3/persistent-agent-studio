/**
 * Context Block Builders
 *
 * @module @persistence/memory/context/blocks
 * @description Barrel export for the 4-block context assembly system.
 *
 * The 4-block system organizes Claude's context into cache-optimized layers:
 *
 * **Block 1 (CONSTITUTION)**: Static identity and actions
 * - System prompt, cold storage, MY SPACE
 * - Cache: 1 hour TTL
 * - Changes: Never (between cycles)
 *
 * **Block 2 (PROMOTED)**: Important recurring themes
 * - Pinned/promoted summaries
 * - Cache: 1 hour TTL
 * - Changes: Rarely (weekly/monthly)
 *
 * **Block 3 (STABLE)**: Action-modifiable stable content
 * - Learned, questions, notebook, observations, summary prefix
 * - Cache: 1 hour TTL
 * - Changes: Daily (when LEARNED/NOTE/etc actions taken)
 *
 * **Block 4 (FRESH)**: Dynamic every-cycle content
 * - RAG results, summary tail, history, reminders, current state
 * - Cache: None (changes every cycle)
 * - Changes: Every cycle
 *
 * USAGE:
 * ```typescript
 * import { blocks } from '@persistence/memory/context';
 *
 * const block2 = blocks.buildBlock2({ promotedSummaries }, formatDateTime);
 * const block3 = blocks.buildBlock3(data, formatSummary, formatDateTime);
 * const block4 = blocks.buildBlock4(data, formatHistory, formatSummary, formatDateTime, formatMeters);
 * ```
 *
 * @upstream Used by:
 *   - context/builder/ - Main context assembly orchestrator
 *   - platforms/cloudflare/src/prompts/build-system-prompt.js - During migration
 * @downstream Aggregates:
 *   - blocks/types.ts - Type definitions
 *   - blocks/block2.ts - Block 2 builder
 *   - blocks/block3.ts - Block 3 builder
 *   - blocks/block4.ts - Block 4 builder
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  BlockConfig,
  Block1Data,
  Block2Data,
  Block3Data,
  Block4Data,
  BlockResult,
  FourBlockResult
} from './types';

// ============================================================================
// FUNCTION EXPORTS
// ============================================================================

export { buildBlock2 } from './block2';
export { buildBlock3 } from './block3';
export { buildBlock4 } from './block4';
