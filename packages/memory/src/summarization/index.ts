/**
 * Summarization Subsystem
 *
 * @module @persistence/memory/summarization
 * @description Complete summarization subsystem for memory compression.
 *
 * Summarization compresses growing history into manageable summaries,
 * mimicking how human memory consolidates experiences. This module provides:
 *
 * - **Parser**: Parse LLM responses (JSON, legacy, plain text)
 * - **Formatter**: Format entries/summaries for LLM prompts
 * - **Prompts**: Default prompts for summarization calls
 * - **Tier**: Tier system logic (cached/tail/archived)
 * - **Orchestrator**: Pure transformers (HistoryEntry[] → SummaryDraft)
 * - **Types**: Comprehensive type definitions
 *
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  @persistence/memory/summarization                                       │
 * │  ├── index.ts        ← You are here (barrel export)                      │
 * │  ├── types.ts        ← HistoryEntry, SummaryEntry, configs, results      │
 * │  ├── parser/         ← parseHistorySummaryResponse, parseMetaResponse    │
 * │  ├── formatter/      ← formatEntriesForSummarization                     │
 * │  ├── prompts/        ← DEFAULT_PROMPTS, prompt builders                  │
 * │  ├── tier/           ← isValidTransition, shouldTriggerMetasummarize     │
 * │  └── orchestrator/   ← summarize(), metaSummarize() (NEW)                │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ENTRY POINTS:
 * 1. Claude's SUMMARIZE tool → uses these modules
 * 2. UI "Summarize" button → direct API call using these modules
 * 3. UI "Consolidate" button → metasummarize using these modules
 * 4. Auto-trigger → scheduled check using tier logic
 *
 * USAGE:
 * ```typescript
 * // Full import
 * import { parser, formatter, prompts, tier } from '@persistence/memory/summarization';
 *
 * // Direct submodule imports
 * import { parseHistorySummaryResponse } from '@persistence/memory/summarization/parser';
 * import { formatEntriesForSummarization } from '@persistence/memory/summarization/formatter';
 * import { DEFAULT_PROMPTS } from '@persistence/memory/summarization/prompts';
 * import { isValidTransition } from '@persistence/memory/summarization/tier';
 * ```
 *
 * @upstream Used by: tools/definitions/summarize, platform routes, UI actions
 * @downstream Uses: parser, formatter, prompts, tier submodules
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Core summarization types
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
} from './types';

// ============================================================================
// SUBMODULE NAMESPACE EXPORTS
// ============================================================================

// Parser module - LLM response parsing
export * as parser from './parser';

// Formatter module - Entry/summary formatting for prompts
export * as formatter from './formatter';

// Prompts module - Default prompts and builders
export * as prompts from './prompts';

// Tier module - Tier system constants and transitions
export * as tier from './tier';

// Orchestrator module - Pure transformers (NEW)
export * as orchestrator from './orchestrator';

// ============================================================================
// ORCHESTRATOR TYPE EXPORTS (commonly used)
// ============================================================================

export type {
  // Adapter interfaces
  LLMCompletionParams,
  LLMAdapter,
  EmbeddingAdapter,

  // Config types
  SummarizeConfig,
  MetaSummarizeConfig,

  // Request types
  SummarizeRequest,
  MetaSummarizeRequest,

  // Draft types
  SummaryDraft,
  MetaSummaryDraft,

  // Result types
  SummarizeResult,
  MetaSummarizeResult,
} from './orchestrator';

// ============================================================================
// CONVENIENCE RE-EXPORTS (most commonly used)
// ============================================================================

// Parser
export {
  parseHistorySummaryResponse,
  parseMetaSummaryResponse,
  isValidHistorySummary
} from './parser';

// Formatter
export {
  formatEntriesForSummarization,
  computeTimeRange,
  estimateTokens
} from './formatter';

// Prompts
export {
  DEFAULT_PROMPTS,
  getDefaultSystemPrompt,
  getDefaultInstructions
} from './prompts';

// Tier
export {
  isValidTransition,
  shouldTriggerMetasummarize,
  validateTransition,
  DEFAULT_TIER_CONFIG
} from './tier';

// Orchestrator
export {
  summarize,
  metaSummarize,
} from './orchestrator';
