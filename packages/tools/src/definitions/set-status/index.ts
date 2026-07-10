/**
 * SET_STATUS Tool Definition
 *
 * @module @persistence/tools/definitions/set-status
 * @description Self status indicator.
 *
 * This tool updates Clio's status line that appears in dashboards and Telegram.
 *
 * @upstream Called by: @persistence/runtime - runThinkingCycle()
 * @downstream Calls: setState()
 */
import type { ToolDefinition } from '../../types';
import type { SetStatusParams } from './params';
import { category, schema, prompt, help } from './schema';
import { handler } from './handler';

// Re-export params type for consumers
export type { SetStatusParams } from './params';

/**
 * SET_STATUS tool definition with co-located handler.
 */
export const SET_STATUS: ToolDefinition<SetStatusParams> = {
  id: 'SET_STATUS',
  category,
  schema,
  prompt,
  help,
  handler,
  historyTypes: {
    primary: 'status_update'
  }
};
