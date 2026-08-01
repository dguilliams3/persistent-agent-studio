/**
 * Memory Types — Barrel Export
 *
 * One type per file. This barrel re-exports everything for clean
 * consumer imports from '@persistence/memory'.
 *
 * @antipattern Do NOT add type definitions to this file — create a new .ts file.
 */

// ════════════════════════════════════════════════════════════════════════════
// BRANDED TYPES
// ════════════════════════════════════════════════════════════════════════════

export type { Brand } from './Brand';
export type { HistoryId } from './HistoryId';
export type { SummaryId } from './SummaryId';
export type { PersonaId } from './PersonaId';
export type { CycleId } from './CycleId';
export type { ISOTimestamp } from './ISOTimestamp';
export type { TimeRangeDescription } from './TimeRangeDescription';

// ════════════════════════════════════════════════════════════════════════════
// HISTORY
// ════════════════════════════════════════════════════════════════════════════

export type { HistoryType } from './HistoryType';
export type { HistoryEntry } from './HistoryEntry';

// History type definitions (per-file registry)
export {
  HISTORY_TYPE_REGISTRY,
  HISTORY_TYPE_ICONS,
  isHistoryType,
} from './history-types';

export type {
  HistoryTypeDefinition,
  HistoryCategory,
} from './history-types';

// ════════════════════════════════════════════════════════════════════════════
// CACHE BLOCK SYSTEM
// ════════════════════════════════════════════════════════════════════════════

export { BLOCK, isInContext } from './ContextBlock';
export type { ContextBlock, SummaryContextBlock } from './ContextBlock';

// ════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ════════════════════════════════════════════════════════════════════════════

export type { SummaryTier } from './SummaryTier';
export { TIER_SORT_ORDER } from './SummaryTier';

export type { SummarySourceType } from './SummarySourceType';

export type { SummaryMetadata } from './SummaryMetadata';
export { DEFAULT_METADATA } from './SummaryMetadata';

export type { Summary } from './Summary';

export type { MetaSummary } from './MetaSummary';
export { isMetaSummary } from './MetaSummary';

// ════════════════════════════════════════════════════════════════════════════
// STATE TRANSITIONS
// ════════════════════════════════════════════════════════════════════════════

export type { TierTransition } from './TierTransition';
export { VALID_TRANSITIONS, isValidTransition } from './TierTransition';

export type { SummaryLifecycleState } from './SummaryLifecycleState';
export { getSummaryLifecycleState } from './SummaryLifecycleState';
