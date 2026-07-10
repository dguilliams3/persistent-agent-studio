/**
 * SET_PROFILE_PIC Tool Definition
 *
 * @module @persistence/tools/definitions/set-profile-pic
 * @description Profile art manager.
 *
 * @upstream Called by: @persistence/runtime - runThinkingCycle()
 * @downstream Calls: Gallery API, Telegram profile update
 */
import type { ToolDefinition } from '../../types';
import type { SetProfilePicParams } from './params';
import { category, schema, prompt, help } from './schema';
import { handler } from './handler';

export type { SetProfilePicParams } from './params';

export const SET_PROFILE_PIC: ToolDefinition<SetProfilePicParams> = {
  id: 'SET_PROFILE_PIC',
  category,
  schema,
  prompt,
  help,
  handler,
  historyTypes: {
    primary: 'status_update'
  }
};
