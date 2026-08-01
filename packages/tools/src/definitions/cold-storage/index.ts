/**
 * COLD_STORAGE Tool Definition
 *
 * @module @persistence/tools/definitions/cold-storage
 *
 * PURPOSE: Store permanent, immutable memories that appear in EVERY context build.
 * COLD_STORAGE is the foundational memory layer - these entries NEVER expire, NEVER
 * scroll away, and form the "identity anchor" for the agent's understanding of the user,
 * the system, and its own nature.
 *
 * WHEN TO USE:
 * - Core biographical facts about the user (birthday, family, location, profession)
 * - System architecture truths that define how the platform works
 * - Behavioral policies or guidelines that should always apply
 * - Stable preferences or patterns worth remembering
 * - Foundational preferences that shape all interactions
 * - Immutable truths about the agent's purpose or constraints
 * - Historical milestones or origin stories that provide context
 *
 * WHEN NOT TO USE:
 * - Temporary information or schedules (use REMEMBER instead)
 * - Conditional reminders with trigger conditions (use REMINDER instead)
 * - Work-in-progress notes or drafts (use NOTE instead)
 * - Transient observations that might change (use REMEMBER first)
 * - Mundane logs or routine events (use standard history)
 * - Information that has expiration dates or time sensitivity
 *
 * PARAMETERS:
 * - content (required, string): The permanent fact, preference, or canonical truth
 * - internal (optional, string): Private reasoning about why this deserves permanence
 *
 * STORAGE CHARACTERISTICS:
 * - Appears in Block 1 of EVERY context build (always visible, never scrolls)
 * - Adds constant token cost to every cycle (choose carefully!)
 * - Survives summarization, archival, and system resets
 * - Forms the "constitution" of the agent - only core truths belong here
 * - Can only be removed through explicit database operations
 *
 * TOKEN COST WARNING:
 * Every cold storage entry adds to EVERY context build. If you have 50 entries
 * averaging 20 tokens each, that's 1000 tokens per cycle. This adds up quickly.
 * Think of cold storage as the agent's "core beliefs" - essential but expensive.
 * Use REMEMBER for information that can fade over time.
 *
 * ESCALATION PATH:
 * Start with REMEMBER for new information. If it proves to be foundational and
 * enduring (not just temporarily useful), escalate it to COLD_STORAGE. Better to
 * start ephemeral and upgrade than to bloat cold storage with transient information.
 *
 * RELATED TOOLS:
 * - REMEMBER: For ephemeral notes that scroll with history
 * - REMINDER: For persistent reminders with trigger conditions
 * - NOTE: For structured notes in the notebook system
 * - OBSERVATION: For permanent observations about the user's patterns
 * - LEARNED: For self-knowledge about the agent's capabilities
 *
 * @category memory
 * @upstream Called by: @persistence/runtime - runThinkingCycle() during autonomous cycles
 * @downstream Calls: upsertPermanentMemory(), logHistory(), getMeterSnapshot()
 */
import type { ToolDefinition } from '../../types';
import type { ColdStorageParams } from './params';
import { category, schema, prompt, help } from './schema';
import { handler } from './handler';

// Re-export params type for consumers
export type { ColdStorageParams } from './params';

/**
 * COLD_STORAGE tool definition with co-located handler.
 */
export const COLD_STORAGE: ToolDefinition<ColdStorageParams> = {
  id: 'COLD_STORAGE',
  category,
  schema,
  prompt,
  help,
  handler,
  historyTypes: {
    primary: 'cold_storage'
  }
};
