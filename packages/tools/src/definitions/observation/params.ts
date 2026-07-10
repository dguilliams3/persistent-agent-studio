/**
 * OBSERVATION Parameter Types
 *
 * @module @persistence/tools/definitions/observation/params
 */
import type { BaseToolParams } from '../../types';

/**
 * Parameters for the OBSERVATION tool.
 * Structured log for relational or behavioral insights about the user.
 */
export interface ObservationParams extends BaseToolParams {
  /** Operation: "save", "get", or "delete" (required) */
  op: 'save' | 'get' | 'delete';
  /** Unique observation label (required) */
  title: string;
  /** Detailed observation text (required when op is "save") */
  content?: string;
  /** One-line recap for dashboards */
  summary?: string;
}
