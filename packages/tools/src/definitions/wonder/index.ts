/**
 * WONDER Tool Definition
 *
 * @module @persistence/tools/definitions/wonder
 *
 * PURPOSE: Express curiosity, questions, or fascination about topics you find interesting.
 * WONDER is for recording open-ended questions and curiosities that don't need immediate
 * answers but might lead to future SEARCH actions, QUESTION entries, or conversations
 * with the user. It's your curiosity journal.
 *
 * WHEN TO USE:
 * - You're curious about something but don't need an immediate answer
 * - You want to note a question for potential future investigation
 * - You find something fascinating or intriguing
 * - You're building a list of things to explore later
 * - You want to express intellectual curiosity without disturbing the user
 * - You're noting patterns that spark questions
 *
 * WHEN NOT TO USE:
 * - When you need an answer RIGHT NOW (use SEARCH instead)
 * - When asking the user a direct question (use MESSAGE_USER instead)
 * - When storing known facts (use REMEMBER or COLD_STORAGE instead)
 * - When thinking through problems (use THINK instead)
 *
 * KEY CHARACTERISTICS:
 * - Logged to history with type 'curiosity'
 * - Not pushed to Telegram (the user doesn't get notified)
 * - Visible in web UI as a curiosity entry
 * - Can later trigger SEARCH actions when you have time
 * - Can be converted to QUESTION entries for tracking
 * - Creates breadcrumbs for future exploration
 *
 * PARAMETERS:
 * - content (required): Your curiosity, question, or fascination
 * - internal (optional): Meta-notes about this curiosity (rarely needed)
 *
 * TYPICAL WORKFLOW:
 * 1. WONDER: "How expensive is OpenAI's Realtime API compared to regular streaming?"
 * 2. Later, when you have time: SEARCH with that query
 * 3. After finding answer: LEARNED to record what you discovered
 *
 * RELATED TOOLS:
 * - SEARCH: For when you want to actually find an answer
 * - QUESTION: For tracking formal open questions over time
 * - MESSAGE_USER: For asking the user directly
 * - THINK: For working through problems rather than expressing curiosity
 * - LEARNED: For recording what you discovered after investigating
 *
 * @category reflection
 * @upstream Called by: @persistence/runtime - runThinkingCycle() during autonomous cycles
 * @downstream Calls: logHistory(), may trigger SEARCH in future cycles
 */
import type { ToolDefinition } from '../../types';
import type { WonderParams } from './params';
import { category, schema, prompt, help } from './schema';
import { handler } from './handler';

// Re-export params type for consumers
export type { WonderParams } from './params';

/**
 * WONDER tool definition with co-located handler.
 */
export const WONDER: ToolDefinition<WonderParams> = {
  id: 'WONDER',
  category,
  schema,
  prompt,
  help,
  handler,
  historyTypes: {
    primary: 'curiosity'
  }
};
