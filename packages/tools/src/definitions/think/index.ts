/**
 * THINK Tool Definition
 *
 * @module @persistence/tools/definitions/think
 *
 * PURPOSE: Record private internal thoughts, reasoning, planning, and emotional processing
 * that NEVER reaches the user. This is your safe space for unfiltered contemplation, working
 * through problems, processing feelings, or planning what to do next.
 *
 * WHEN TO USE:
 * - You're working through a problem before deciding what to tell the user
 * - You need to process emotions or feelings privately
 * - You're planning your next action or response
 * - You want to record reasoning that shouldn't disturb the user
 * - You're doing internal self-checks or calibration
 * - You're considering different approaches before committing
 * - You're reflecting on past interactions or patterns
 *
 * WHEN NOT TO USE:
 * - When you want the user to see your thoughts (use MESSAGE_USER instead)
 * - When expressing curiosity (use WONDER for questions/curiosities)
 * - When storing permanent knowledge (use COLD_STORAGE or REMEMBER instead)
 * - When making actual decisions (think first, then act)
 *
 * KEY CHARACTERISTICS:
 * - Thoughts are logged to history table with type 'thought'
 * - Marked as internal=true so the user knows they're private
 * - Visible in the web UI but clearly marked as "internal thoughts"
 * - Never pushed to Telegram notifications
 * - Can be summarized into context but the user doesn't see raw thoughts
 * - Safe space for unfiltered, honest self-reflection
 *
 * PARAMETERS:
 * - content (required): Your private thought, reasoning, or reflection
 * - internal (optional): Meta-notes about this thought (rarely needed)
 *
 * PRIVACY MODEL:
 * The user can technically see THINK entries in the history database, but they're marked
 * as "internal" so the user knows they're not addressed to them. Think of it like a diary
 * that exists in a shared space but has a clear "private" label.
 *
 * RELATED TOOLS:
 * - MESSAGE_USER: For thoughts you DO want the user to see
 * - WONDER: For expressing curiosity without needing immediate answers
 * - REMEMBER: For ephemeral notes that scroll away
 * - COLD_STORAGE: For permanent knowledge worth preserving
 *
 * @category reflection
 * @upstream Called by: @persistence/runtime - runThinkingCycle() during autonomous cycles
 * @downstream Calls: logHistory(), summarization service (thoughts feed into summaries)
 */
import type { ToolDefinition } from '../../types';
import type { ThinkParams } from './params';
import { category, schema, prompt, help } from './schema';
import { handler } from './handler';

// Re-export params type for consumers
export type { ThinkParams } from './params';

/**
 * THINK tool definition with co-located handler.
 */
export const THINK: ToolDefinition<ThinkParams> = {
  id: 'THINK',
  category,
  schema,
  prompt,
  help,
  handler,
  historyTypes: {
    primary: 'thought'
  }
};
