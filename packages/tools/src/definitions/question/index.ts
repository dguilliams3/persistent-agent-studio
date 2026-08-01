/**
 * QUESTION Tool Definition - Inquiry tracker.
 */
import type { ToolDefinition } from '../../types';
import type { QuestionParams } from './params';
import { category, schema, prompt, help } from './schema';
import { handler } from './handler';

export type { QuestionParams } from './params';

export const QUESTION: ToolDefinition<QuestionParams> = {
  id: 'QUESTION',
  category,
  schema,
  prompt,
  help,
  handler,
  historyTypes: {
    primary: {
      add: 'question_add',
      note: null,
      resolve: 'question_resolve',
      dissolve: null,
      list: null
    }
  }
};
