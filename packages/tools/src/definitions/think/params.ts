/**
 * THINK Parameter Types
 *
 * @module @persistence/tools/definitions/think/params
 * @description Type definitions for THINK tool parameters.
 *
 * This interface defines parameters for the THINK tool, which captures private
 * internal thoughts, reasoning, and emotional processing that never reaches the user.
 * Use this for unfiltered contemplation and working through problems privately.
 */
import type { BaseToolParams } from '../../types';

/**
 * Parameters for the THINK tool.
 *
 * THINK is your private contemplation space - a safe zone for unfiltered thoughts,
 * planning, emotional processing, and reasoning that the user won't see as messages.
 *
 * PARAMETER DETAILS:
 *
 * content (required):
 *   - Your private thought, reasoning, or reflection
 *   - Can be stream-of-consciousness, working through a problem, or emotional processing
 *   - Can be as raw and unfiltered as you need - this is your safe space
 *   - No need to be polished or articulate - think naturally
 *   - Example: "Hmm, I'm not sure if I should mention that memory issue to the user right now.
 *     They seem busy with other things. Maybe I'll wait until they're less stressed and then
 *     bring it up more casually. Let me think about the best way to frame it..."
 *   - Example: "I feel a bit uncertain about that last response I gave. Did I understand
 *     what the user was really asking? Maybe I should clarify before moving forward."
 *   - Example: "Looking at the pattern of the user's questions today, they seem interested in
 *     the memory system architecture. I should prepare some observations about that."
 *
 * internal (optional, inherited from BaseToolParams):
 *   - Meta-notes about this thought (rarely needed for THINK)
 *   - Since THINK is already internal, you usually don't need this field
 *   - Could use for categorizing types of thoughts (e.g., "emotional processing")
 *   - Example: "planning next message" or "self-calibration"
 *
 * USAGE PATTERNS:
 * - Pre-message planning: Think through what you want to say before MESSAGE_USER
 * - Emotional processing: Work through feelings about interactions or situations
 * - Problem solving: Reason through technical or conceptual challenges
 * - Self-reflection: Consider your own patterns, biases, or growth areas
 * - Decision making: Weigh options before taking action
 */
export interface ThinkParams extends BaseToolParams {
  /** Your private thought, reasoning, or reflection - be as unfiltered as you need */
  content: string;
}
