/**
 * SLEEP Tool Definition - Cycle pause lever.
 */
import type { ToolDefinition } from '../../types';
import type { SleepParams } from './params';
import { category, schema, prompt, help } from './schema';
import { handler } from './handler';

export type { SleepParams } from './params';

export const SLEEP: ToolDefinition<SleepParams> = {
  id: 'SLEEP',
  category,
  schema,
  prompt,
  help,
  handler,
  historyTypes: {
    primary: 'sleep'
  }
};
