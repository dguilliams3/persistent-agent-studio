/**
 * EXIST Tool Definition - Mindfulness ping.
 */
import type { ToolDefinition } from '../../types';
import type { ExistParams } from './params';
import { category, schema, prompt, help } from './schema';
import { handler } from './handler';

export type { ExistParams } from './params';

export const EXIST: ToolDefinition<ExistParams> = {
  id: 'EXIST',
  category,
  schema,
  prompt,
  help,
  handler,
  historyTypes: {
    primary: 'exist'
  }
};
