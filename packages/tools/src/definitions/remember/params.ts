/**
 * REMEMBER Parameter Types
 *
 * @module @persistence/tools/definitions/remember/params
 *
 * Defines the parameters for ephemeral memory storage that travels with scrolling
 * history. These notes are designed for SHORT-TERM information that's relevant for
 * the next few cycles but doesn't need permanent storage.
 *
 * PARAMETER DETAILS:
 *
 * content (required, string):
 *   The note, observation, or reminder you want to keep handy. This stays in the
 *   rolling history buffer and gets included in context until it scrolls away or
 *   gets summarized.
 *
 *   Examples:
 *   - "The user mentioned they have a meeting at 3pm today"
 *   - "TODO: Check back on that image generation error"
 *   - "User preference: prefers technical explanations over casual"
 *
 *   Best for:
 *   - Near-term reminders (hours or days, not weeks)
 *   - Context that's temporarily important
 *   - Quick notes during conversations
 *
 *   NOT for:
 *   - Core facts about the user (use COLD_STORAGE)
 *   - Permanent system knowledge (use COLD_STORAGE)
 *   - Persistent reminders with conditions (use REMINDER)
 *
 * internal (optional, string):
 *   Private reasoning about why you're making this note. Visible to you but not
 *   included in the final history entry shown to the user.
 *
 *   Example: "Capturing this because it might explain his earlier question"
 */
import type { BaseToolParams } from '../../types';

/**
 * Parameters for the REMEMBER tool.
 * Short-lived sticky note that travels with scrolling history.
 */
export interface RememberParams extends BaseToolParams {
  /** The observation or reminder to keep temporarily (required) */
  content: string;
}
