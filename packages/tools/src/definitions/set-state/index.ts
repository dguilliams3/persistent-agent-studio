/**
 * SET_STATE Tool Definition - Meter update API.
 */
import type { ToolDefinition } from '../../types';
import type { SetStateParams } from './params';
import { category, schema, prompt, help } from './schema';
import { handler } from './handler';

export type { SetStateParams } from './params';

export const SET_STATE: ToolDefinition<SetStateParams> = {
  id: 'SET_STATE',
  category,
  schema,
  prompt,
  help,
  handler,
  historyTypes: {
    primary: 'state_update'
  }
};
