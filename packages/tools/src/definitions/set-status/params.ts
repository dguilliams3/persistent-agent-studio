/**
 * SET_STATUS Parameter Types
 *
 * @module @persistence/tools/definitions/set-status/params
 */
import type { BaseToolParams } from '../../types';

/**
 * Parameters for the SET_STATUS tool.
 * Self status indicator.
 */
export interface SetStatusParams extends BaseToolParams {
  /** Status line content (required) */
  content: string;
  /** Optional emoji */
  emoji?: string;
  /** Optional mood */
  mood?: string;
}
