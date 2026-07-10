/**
 * LEARNED Tool Definition - Knowledge ledger.
 */
import type { ToolDefinition } from '../../types';
import type { LearnedParams } from './params';
import { category, schema, prompt, help } from './schema';
import { handler } from './handler';

export type { LearnedParams } from './params';

export const LEARNED: ToolDefinition<LearnedParams> = {
  id: 'LEARNED',
  category,
  schema,
  prompt,
  help,
  handler,
  historyTypes: {
    primary: {
      add: 'learned_add',
      update: null,
      cite: null,
      promote: 'cold_storage',
      delete: null,
      list: null
    }
  }
};
