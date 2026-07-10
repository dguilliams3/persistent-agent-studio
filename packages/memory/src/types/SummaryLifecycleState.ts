/**
 * Lifecycle states for a summary (derived from fields).
 */
import type { Summary } from './Summary';

export type SummaryLifecycleState =
  | 'active'      // archived_at is null, replaced_by_id is null
  | 'soft_deleted' // archived_at is set
  | 'superseded'  // replaced_by_id is set
  | 'deleted_and_superseded'; // both set

/**
 * Get the lifecycle state of a summary.
 *
 * @param summary - Summary to check
 * @returns Lifecycle state
 */
export function getSummaryLifecycleState(summary: Summary): SummaryLifecycleState {
  const isArchived = summary.archived_at !== null;
  const isReplaced = summary.replaced_by_id !== null;

  if (isArchived && isReplaced) return 'deleted_and_superseded';
  if (isArchived) return 'soft_deleted';
  if (isReplaced) return 'superseded';
  return 'active';
}
