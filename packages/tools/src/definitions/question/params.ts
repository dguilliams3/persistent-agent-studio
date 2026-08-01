/**
 * QUESTION Parameter Types
 */
import type { BaseToolParams } from '../../types';

export interface QuestionParams extends BaseToolParams {
  /** Operation: add|note|resolve|dissolve|list */
  op: 'add' | 'note' | 'resolve' | 'dissolve' | 'list';
  /** Question ID (required for note/resolve/dissolve) */
  id?: number;
  /** Question content (required for add) */
  content?: string;
  /** Domain: self|world|user|technical */
  domain?: string;
  /** Progress note (required for note) */
  note?: string;
  /** Mark as actively exploring */
  set_exploring?: boolean;
  /** Resolution summary (required for resolve) */
  resolved_into?: string;
  /** Reason for dissolving (required for dissolve) */
  reason?: string;
}
