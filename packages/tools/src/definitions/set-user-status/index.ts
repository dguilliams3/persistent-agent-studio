/**
 * SET_USER_STATUS Tool Definition — User availability tracker.
 */
import type { ToolDefinition } from '../../types';
import type { SetUserStatusParams } from './params';
import { category, schema, prompt, help } from './schema';
import { handler } from './handler';

export type { SetUserStatusParams } from './params';

export const SET_USER_STATUS: ToolDefinition<SetUserStatusParams> = {
  id: 'SET_USER_STATUS',
  category,
  schema,
  prompt,
  help,
  handler,
  historyTypes: {
    primary: 'user_status_update'
  }
};
