/**
 * @persistence/tools - Unified tool registry and handlers
 *
 * @description
 * Single source of truth for tool definitions, validation,
 * prompt generation, and execution handlers.
 *
 * @upstream @persistence/runtime (agent loop)
 * @downstream @persistence/db, @persistence/llm
 *
 * @example
 * // Type-safe execution (recommended)
 * import { execute, TOOLS, isValidAction } from '@persistence/tools';
 * import type { ActionName, ActionParams } from '@persistence/tools';
 *
 * // Compiler verifies params match handler signature
 * await execute('MESSAGE_USER', { content: 'Hello!' }, ctx);
 *
 * // Legacy usage (still works)
 * import { TOOL_DEFINITIONS, validateAction } from '@persistence/tools';
 */

// =============================================================================
// EXPORTS
// =============================================================================
export * from './types';
export * from './definitions';

// Type-safe registry (new) - provides compile-time type checking for action execution
export {
  TOOLS,
  ACTION_NAMES,
  execute,
  isValidAction,
  getTool,
  type ActionName,
  type ActionParams,
} from './typed-registry';

// Legacy registry (backward compatibility) - keeps TOOL_DEFINITIONS for validation/help
export * from './registry';
export * from './validation';

// =============================================================================
// MIGRATION STATUS
// =============================================================================
// Tracks what has been migrated vs still using worker/src/* bridge.
// =============================================================================

/**
 * @todo Migrate remaining tools functionality:
 * - prompt.ts - Prompt rendering for system prompt injection
 * - executor.ts - Action execution dispatch (from worker/src/services/action-executor.js)
 * - handlers/ - Individual action handlers (from worker/src/tools/actions/index.js)
 */

export const TOOLS_MIGRATION_STATUS = {
  migrated: ['registry', 'validation'],
  pending: [
    'prompt',      // Prompt rendering
    'executor',    // Action execution dispatch
    'handlers',    // Individual action implementations
  ],
} as const;
