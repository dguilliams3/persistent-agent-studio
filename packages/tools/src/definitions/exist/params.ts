/**
 * EXIST Parameter Types
 */
import type { BaseToolParams } from '../../types';

export interface ExistParams extends BaseToolParams {
  /** Optional narration of current feeling */
  content?: string;
}
