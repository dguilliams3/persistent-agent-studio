/**
 * REMEMBER Tool Definition
 *
 * @module @persistence/tools/definitions/remember
 *
 * PURPOSE: Store ephemeral notes that ride along with scrolling history. REMEMBER
 * entries are designed for SHORT-TERM information that's relevant for hours or days,
 * not weeks or months. Unlike COLD_STORAGE (permanent) or REMINDER (conditional),
 * REMEMBER entries naturally fade as history scrolls and gets summarized.
 *
 * WHEN TO USE:
 * - Quick notes during conversations that provide context for upcoming cycles
 * - Near-term reminders like "User mentioned meeting at 3pm today"
 * - Temporary observations that don't need permanent storage
 * - Context breadcrumbs that help connect related conversation threads
 * - Short-term TODOs like "check back on that error tomorrow"
 * - User preferences that might be temporary or experimental
 *
 * WHEN NOT TO USE:
 * - Permanent facts about the user (use COLD_STORAGE instead)
 * - Core system knowledge that should never fade (use COLD_STORAGE)
 * - Persistent reminders with conditions (use REMINDER instead)
 * - Long-term commitments or promises (use COLD_STORAGE or REMINDER)
 * - Information needed indefinitely (use COLD_STORAGE)
 *
 * PARAMETERS:
 * - content (required, string): The note or observation to remember temporarily
 * - internal (optional, string): Private reasoning about why you're noting this
 *
 * LIFECYCLE:
 * REMEMBER entries follow the same lifecycle as normal history:
 * 1. Fresh: Fully visible in rolling history window (immediate context)
 * 2. Summarized: Compressed into summary when token thresholds hit
 * 3. Archived: Moved to RAG archive if not semantically relevant to recent activity
 * 4. Eventually: Falls completely out of context as new activity accumulates
 *
 * This natural fade is a FEATURE - it prevents context bloat from accumulating
 * transient information that was only relevant for a short time.
 *
 * ESCALATION PATH:
 * If you later realize a REMEMBER note contains important permanent information,
 * escalate it to COLD_STORAGE before it ages out. Watch for insights that prove
 * to be core truths rather than temporary context.
 *
 * RELATED TOOLS:
 * - COLD_STORAGE: For permanent memories that should never fade
 * - REMINDER: For persistent reminders with trigger conditions
 * - THINK: For private reasoning that doesn't need storage
 * - NOTE: For structured notes in the notebook system
 * - OBSERVATION: For permanent observations about the user's patterns
 *
 * @category memory
 * @upstream Called by: @persistence/runtime - runThinkingCycle() during autonomous cycles
 * @downstream Calls: logHistory(), summarizer (indirect), getMeterSnapshot()
 */
import type { ToolDefinition } from '../../types';
import type { RememberParams } from './params';
import { category, schema, prompt, help } from './schema';
import { handler } from './handler';

// Re-export params type for consumers
export type { RememberParams } from './params';

/**
 * REMEMBER tool definition with co-located handler.
 */
export const REMEMBER: ToolDefinition<RememberParams> = {
  id: 'REMEMBER',
  category,
  schema,
  prompt,
  help,
  handler,
  historyTypes: {
    primary: 'remember'
  }
};
