/**
 * SET_USER_STATUS Parameter Types
 */
import type { BaseToolParams } from '../../types';

export interface SetUserStatusParams extends BaseToolParams {
  /** User's availability status */
  content: string;
}
