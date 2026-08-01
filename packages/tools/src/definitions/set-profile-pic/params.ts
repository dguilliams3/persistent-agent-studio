/**
 * SET_PROFILE_PIC Parameter Types
 *
 * @module @persistence/tools/definitions/set-profile-pic/params
 */
import type { BaseToolParams } from '../../types';

/**
 * Parameters for the SET_PROFILE_PIC tool.
 * Profile art manager.
 */
export interface SetProfilePicParams extends BaseToolParams {
  /** "latest"|"clear" or omit for prompt/image_id */
  content?: string;
  /** Prompt for generating new avatar */
  prompt?: string;
  /** Use specific image from gallery */
  image_id?: string;
}
