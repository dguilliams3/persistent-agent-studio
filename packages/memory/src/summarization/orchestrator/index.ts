/**
 * Summarization Orchestrator
 *
 * @module @persistence/memory/summarization/orchestrator
 * @description Pure transformers for summarization operations.
 *
 * EXPORTS:
 * - `summarize()` - HistoryEntry[] → SummaryDraft
 * - `metaSummarize()` - Summary[] → MetaSummaryDraft
 * - All types (requests, configs, adapters, drafts, results)
 *
 * USAGE:
 * ```typescript
 * import { summarize, metaSummarize, type LLMAdapter } from '@persistence/memory/summarization/orchestrator';
 *
 * // Or via package root
 * import { summarization } from '@persistence/memory';
 * const result = await summarization.orchestrator.summarize(request, llm);
 * ```
 *
 * @upstream Used by: platform/services/summarization.js
 * @downstream Uses: formatter/, parser/, prompt-builder
 */

// ════════════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ════════════════════════════════════════════════════════════════════════════

export type {
  // Adapter interfaces (LLM-agnostic)
  LLMCompletionParams,
  LLMAdapter,
  EmbeddingAdapter,

  // Config types
  SummarizeConfig,
  MetaSummarizeConfig,

  // Request types
  SummarizeRequest,
  MetaSummarizeRequest,

  // Draft types (output, ready for DB)
  SummaryDraft,
  MetaSummaryDraft,

  // Result types (discriminated unions)
  SummarizeSuccess,
  SummarizeFailure,
  SummarizeResult,
  MetaSummarizeSuccess,
  MetaSummarizeFailure,
  MetaSummarizeResult,

  // Internal types
  ComputedTimeRange,
} from './types';

// ════════════════════════════════════════════════════════════════════════════
// FUNCTION EXPORTS
// ════════════════════════════════════════════════════════════════════════════

export { summarize } from './summarize';
export { metaSummarize } from './meta-summarize';

// Prompt builders (for advanced usage / testing)
export {
  buildSummarizePrompt,
  buildMetaSummarizePrompt,
  formatSummariesForMeta,
  computeTimeRangeFromSummaries,
} from './prompt-builder';
