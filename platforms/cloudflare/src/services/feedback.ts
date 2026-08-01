/**
 * @module services/feedback
 * @description Re-exports from @persistence/services/feedback package.
 *
 * All feedback logic has been migrated to the package layer.
 * This file exists only for import compatibility during transition.
 *
 * @upstream Called by: executeBatchAction(), streaming action execution in index.js
 * @downstream Calls: @persistence/services/feedback
 */

export {
  transformLegacyAction,
  normalizeAction,
  FEEDBACK_TYPES,
  addFeedback,
  getFeedbackAndClear,
  formatFeedbackForContext,
} from '@persistence/services/feedback';
