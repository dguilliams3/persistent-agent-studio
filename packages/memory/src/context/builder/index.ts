/**
 * Context Builder Module
 *
 * @module @persistence/memory/context/builder
 * @description Barrel export for the context builder orchestrator.
 *
 * The context builder is the main entry point for transforming raw memory data
 * into formatted system prompt blocks. It orchestrates:
 *
 * - Cache boundary calculation (stable prefix/tail splits)
 * - Block building (2: promoted, 3: stable, 4: fresh)
 * - Image collection (for vision API)
 * - Metadata aggregation (for logging/stats)
 *
 * USAGE:
 * ```typescript
 * import { buildContext, type ContextBuilderConfig, type ContextFormatters } from '@persistence/memory/context/builder';
 *
 * // Platform provides data, formatters, config
 * const result = buildContext(data, formatters, config);
 *
 * // Use result
 * const fullPrompt = block1 + '\n\n' + result.systemPrompt;
 *
 * // Persist boundary updates
 * if (result.boundaryUpdates.history.shifted) {
 *   await setState('history_prefix_boundary_id', result.boundaryUpdates.history.boundaryId);
 * }
 * ```
 *
 * @upstream Used by:
 *   - @persistence/memory/context/index.ts - Module barrel
 *   - platforms/cloudflare/src/prompts/build-system-prompt.js - Main consumer
 * @downstream Aggregates:
 *   - builder/types.ts - Type definitions
 *   - builder/build-context.ts - Main orchestrator
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  ContextBuilderConfig,
  ContextFormatters,
  BuilderResult
} from './types';

// ============================================================================
// FUNCTION EXPORTS
// ============================================================================

export { buildContext } from './build-context';
