/**
 * SUMMARIZE Parameter Types
 *
 * @module @persistence/tools/definitions/summarize/params
 */
import type { BaseToolParams } from '../../types';

/**
 * Parameters for the SUMMARIZE tool.
 * History compression.
 */
export interface SummarizeParams extends BaseToolParams {
  /** Starting index for summarization */
  start?: number;
  /** Number of entries to summarize */
  count?: number;
  /** If true, compresses summaries instead of history */
  meta?: boolean;
}
