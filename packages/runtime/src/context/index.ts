/**
 * Context Assembly Module
 *
 * @module @persistence/runtime/context
 * @description Context assembly for agent cycles.
 *
 * @upstream Called by: loop/cycle.ts
 * @downstream Calls: @persistence/db, @persistence/core
 */

export {
  PERSONA_IDENTITIES,
  getDefaultIdentity,
  resolveIdentity,
  buildPersonaContext,
} from './persona';

// Cache TTL selection (pure function)
export { selectCacheTtl, SHORT_TTL_THRESHOLD, LONG_TTL_THRESHOLD } from './cacheTtl';

// System block assembly for Anthropic API
export { buildSystemBlocks } from './systemBlocks';
export type { CacheStrategy, ProfilePictureRef, SystemBlock } from './systemBlocks';

// =============================================================================
// PLACEHOLDER EXPORTS
// =============================================================================
// The full context builder (~1068 lines) is still in worker/src/prompts/build-system-prompt.js
// These stubs will be filled in as we decouple from the worker.
// =============================================================================

/**
 * @todo Migrate from worker/src/prompts/build-system-prompt.js:
 * - buildSystemPrompt() - Full context assembly (1068 lines)
 */

export const CONTEXT_MIGRATION_STATUS = {
  migrated: ['persona', 'cache'],
  pending: [
    'builder',     // buildSystemPrompt() - main context assembly
    'memories',    // Memory injection (cold storage, notebook, observations)
    'rag',         // RAG retrieval integration
  ],
} as const;
