/**
 * LEARNED Parameter Types
 */
import type { BaseToolParams } from '../../types';

export interface LearnedParams extends BaseToolParams {
  /** Operation: add|update|cite|promote|delete|list */
  op: 'add' | 'update' | 'cite' | 'promote' | 'delete' | 'list';
  /** Entry ID (required for update/cite/delete) */
  id?: number;
  /** Knowledge content (required for add) */
  content?: string;
  /** Confidence level: emerging|growing|established */
  confidence?: 'emerging' | 'growing' | 'established';
  /** Supporting evidence */
  supporting?: string;
  /** Citation type */
  type?: string;
  /** Citation evidence */
  evidence?: string;
}
