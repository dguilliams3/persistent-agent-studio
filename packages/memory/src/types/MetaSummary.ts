/**
 * A meta-summary is structurally identical to a regular summary,
 * but with source_type='summary'.
 *
 * Same table, same code paths, different interpretation.
 * The source_ids field contains SummaryId values instead of HistoryId values.
 */
import type { Summary } from './Summary';

export type MetaSummary = Summary & {
  source_type: 'summary';
};

/**
 * Type guard to check if a summary is a meta-summary.
 *
 * @param summary - Summary to check
 * @returns True if summary is a meta-summary
 */
export function isMetaSummary(summary: Summary): summary is MetaSummary {
  return summary.source_type === 'summary';
}
