/**
 * SUMMARIZE Tool Definition
 *
 * @module @persistence/tools/definitions/summarize
 * @description Tool definition for the SUMMARIZE action.
 *
 * The summarization LOGIC now lives in @persistence/memory/summarization.
 * This module just provides the tool definition (schema, handler, help).
 *
 * ARCHITECTURE (Basin Pattern):
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  @persistence/memory/summarization                                       │
 * │    └── Pure logic: parser, formatter, prompts, tier                     │
 * │                                                                          │
 * │  @persistence/tools/definitions/summarize                                │
 * │    └── Tool interface: schema, params, handler                          │
 * │    └── Re-exports from memory for convenience                           │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * USAGE:
 * ```typescript
 * // Tool definition
 * import { SUMMARIZE } from '@persistence/tools/definitions/summarize';
 *
 * // Summarization logic (prefer direct import from memory)
 * import { parseHistorySummaryResponse } from '@persistence/memory/summarization';
 *
 * // Or via re-export (for backward compatibility)
 * import { parser } from '@persistence/tools/definitions/summarize';
 * ```
 *
 * @upstream Called by: @persistence/runtime - runThinkingCycle()
 * @downstream Uses: @persistence/memory/summarization
 */
import type { ToolDefinition } from '../../types';
import type { SummarizeParams } from './params';
import { category, schema, prompt, help } from './schema';
import { handler } from './handler';

// ============================================================================
// TOOL DEFINITION
// ============================================================================

// Re-export params type for consumers
export type { SummarizeParams } from './params';

/**
 * SUMMARIZE tool definition with co-located handler.
 *
 * The handler is thin - it just returns `needsSummarization: true` metadata.
 * The actual summarization logic lives in @persistence/memory, but the
 * platform orchestrator uses it for parsing, formatting, and tier logic.
 */
export const SUMMARIZE: ToolDefinition<SummarizeParams> = {
  id: 'SUMMARIZE',
  category,
  schema,
  prompt,
  help,
  handler,
  historyTypes: {
    primary: null,
    postProcessed: ['summarize']
  }
};

// ============================================================================
// RE-EXPORTS FROM @persistence/memory/summarization
// ============================================================================
// These re-exports exist for backward compatibility.
// New code should import directly from @persistence/memory/summarization.

// Core types
export type {
  HistoryEntry,
  SummarizationConfig,
  MetaSummarizationConfig,
  FormattedEntry,
  PromptContext,
  SummaryMetadata,
  ParsedSummaryResponse,
  ParsedMetaResponse,
  SummaryResult,
  MetaSummaryResult,
  ParserOptions,
  ValidationResult
} from '@persistence/memory/summarization';

// Submodule namespace re-exports
// Note: These come from the summarization barrel export, not direct subpath imports
// The memory package exports namespaces: parser, formatter, prompts, tier
import {
  parser as _parser,
  formatter as _formatter,
  prompts as _prompts,
  tier as _tier
} from '@persistence/memory/summarization';

export { _parser as parser, _formatter as formatter, _prompts as prompts, _tier as tier };
