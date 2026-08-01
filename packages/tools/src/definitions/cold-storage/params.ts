/**
 * COLD_STORAGE Parameter Types
 *
 * @module @persistence/tools/definitions/cold-storage/params
 *
 * Defines the parameters for PERMANENT memory storage. These entries NEVER expire,
 * NEVER scroll away, and appear in EVERY context build (Block 1). Use this for
 * immutable truths, core facts, stable preferences, and foundational knowledge.
 *
 * PARAMETER DETAILS:
 *
 * content (required, string):
 *   The permanent fact, preference, or canonical truth to freeze in memory. This should
 *   be a complete, human-readable statement that will remain meaningful indefinitely.
 *
 *   Examples of GOOD cold storage:
 *   - "The user's timezone is UTC-5"
 *   - "The user prefers concise, technical explanations"
 *   - "Never suggest deleting user data without explicit permission"
 *   - "The user prefers technical depth over simplified explanations"
 *   - "The system runs on Cloudflare Workers with D1 database"
 *
 *   Examples of BAD cold storage (use REMEMBER instead):
 *   - "The user has a meeting at 3pm" (temporary schedule)
 *   - "Check back tomorrow on that bug" (temporary TODO)
 *   - "Currently debugging the image system" (transient state)
 *
 *   Best for:
 *   - Core biographical facts about the user
 *   - System architecture truths that define how things work
 *   - Behavioral policies or guidelines that should always apply
 *   - Stable preferences or patterns worth remembering
 *   - Foundational preferences that shape all interactions
 *
 *   NOT for:
 *   - Temporary information (use REMEMBER)
 *   - Scheduled events (use REMINDER)
 *   - Work-in-progress notes (use NOTE)
 *   - Transient observations (use REMEMBER or OBSERVATION)
 *
 * internal (optional, string):
 *   Private reasoning about why this fact deserves permanent storage. Visible to
 *   you but not included in the cold storage entry itself.
 *
 *   Example: "Storing this because it explains his communication style preferences"
 *
 * STORAGE CHARACTERISTICS:
 * - Appears in Block 1 of EVERY context build (always visible)
 * - Never expires or scrolls away
 * - Survives summarization, archival, and branch operations
 * - Forms the "identity anchor" for the agent's understanding of the user and itself
 */
import type { BaseToolParams } from '../../types';

/**
 * Parameters for the COLD_STORAGE tool.
 * Permanent memory store for immutable truths.
 */
export interface ColdStorageParams extends BaseToolParams {
  /** Human-readable fact, preference, or canonical statement (required) */
  content: string;
}
