/**
 * Context Formatters
 *
 * @module @persistence/memory/context/formatters
 * @description Barrel export for all context section formatters.
 *
 * The formatters transform raw database records into text sections suitable for
 * Claude's system prompt. They handle:
 *
 * - Type-based formatting (different entry types get different icons/formatting)
 * - Timestamp formatting in Eastern Time
 * - Image handling (base64 → placeholder + separate image arrays)
 * - Section headers and structure
 * - Token estimation
 *
 * USAGE:
 * ```typescript
 * import {
 *   formatHistorySection,
 *   formatNotebookSection,
 *   formatSummaryForContext
 * } from '@persistence/memory/context/formatters';
 *
 * const historyResult = formatHistorySection(entries, { recentImageThreshold: 10 });
 * const notebookText = formatNotebookSection(notebookEntries);
 * ```
 *
 * @upstream Used by:
 *   - context/builder/ - Uses these to assemble context blocks
 *   - platforms/cloudflare/src/prompts/build-system-prompt.js - Direct usage during migration
 * @downstream Aggregates:
 *   - formatters/history.ts
 *   - formatters/notebook.ts
 *   - formatters/observations.ts
 *   - formatters/summaries.ts
 *   - formatters/reminders.ts
 *   - formatters/learned.ts
 *   - formatters/cold-storage.ts
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  HistoryFormatOptions,
  HistoryFormatResult,
  SummaryFormatOptions,
  ReminderFormatOptions,
  LearnedFormatOptions,
  QuestionsFormatOptions,
  SectionFormatter
} from './types';

export { CONTEXT_TYPE_ICONS, getTypeIcon } from './types';

// ============================================================================
// HISTORY FORMATTING
// ============================================================================

export {
  formatTimeForContext,
  formatDateTimeForContext,
  formatHistoryEntry,
  formatHistorySection,
  formatHistorySectionWithHeader
} from './history';

// ============================================================================
// NOTEBOOK FORMATTING
// ============================================================================

export {
  formatNotebookEntry,
  formatNotebookSection
} from './notebook';

// ============================================================================
// OBSERVATIONS FORMATTING
// ============================================================================

export {
  formatObservationEntry,
  formatObservationsSection
} from './observations';

// ============================================================================
// SUMMARIES FORMATTING
// ============================================================================

export {
  formatSummaryForContext,
  formatSummariesPrefixSection,
  formatSummariesTailSection,
  formatPromotedSummariesSection
} from './summaries';

// ============================================================================
// REMINDERS FORMATTING
// ============================================================================

export {
  formatReminderEntry,
  formatRemindersSection
} from './reminders';

// ============================================================================
// LEARNED & QUESTIONS FORMATTING
// ============================================================================

export {
  formatLearnedEntry,
  formatLearnedSection,
  formatQuestionEntry,
  formatQuestionsSection
} from './learned';

// ============================================================================
// COLD STORAGE FORMATTING
// ============================================================================

export {
  formatColdStorageEntry,
  formatColdStorageSection
} from './cold-storage';
