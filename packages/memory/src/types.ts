/**
 * Memory Types — Re-export Bridge
 *
 * This file exists solely to maintain backward compatibility with existing
 * imports from './types'. All type definitions now live in './types/' (one per file).
 *
 * New code should import from './types/' or '@persistence/memory'.
 *
 * @deprecated Import from './types/' directory instead.
 */
export {
  // Branded types
  type Brand,
  type HistoryId,
  type SummaryId,
  type PersonaId,
  type CycleId,
  type ISOTimestamp,
  type TimeRangeDescription,

  // History
  type HistoryType,
  type HistoryEntry,
  HISTORY_TYPE_ICONS,
  isHistoryType,

  // History type definitions
  type HistoryTypeDefinition,
  type HistoryCategory,
  HISTORY_TYPE_REGISTRY,

  // Cache block system
  BLOCK,
  isInContext,
  type ContextBlock,
  type SummaryContextBlock,

  // Summary
  type SummaryTier,
  TIER_SORT_ORDER,
  type SummarySourceType,
  type SummaryMetadata,
  DEFAULT_METADATA,
  type Summary,
  type MetaSummary,
  isMetaSummary,

  // State transitions
  type TierTransition,
  VALID_TRANSITIONS,
  isValidTransition,
  type SummaryLifecycleState,
  getSummaryLifecycleState,
} from './types/index';
