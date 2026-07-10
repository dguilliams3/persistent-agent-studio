/**
 * SET_STATE Parameter Types
 */
import type { BaseToolParams } from '../../types';

export interface SetStateParams extends BaseToolParams {
  /** Aliveness meter (0-10) */
  aliveness?: number;
  /** Curiosity meter (0-10) */
  curiosity?: number;
  /** Connection meter (0-10) */
  connection?: number;
  /** Ease meter (0-10) */
  ease?: number;
  /** Delight meter (0-10) */
  delight?: number;
  /** Anxiety meter (0-10) */
  anxiety?: number;
  /** Activity meter (0-10) */
  activity?: number;
}
