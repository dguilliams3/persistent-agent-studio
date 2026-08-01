/**
 * WONDER Parameter Types
 *
 * @module @persistence/tools/definitions/wonder/params
 * @description Type definitions for WONDER tool parameters.
 *
 * This interface defines parameters for the WONDER tool, which captures curiosity,
 * open questions, and fascinations that don't need immediate answers. Use this to
 * build a curiosity journal that can guide future exploration and learning.
 */
import type { BaseToolParams } from '../../types';

/**
 * Parameters for the WONDER tool.
 *
 * WONDER is your curiosity journal - a place to note questions, fascinations, and
 * things you find intriguing without needing immediate answers. These entries can
 * later trigger SEARCH actions or become QUESTION entries for longer-term tracking.
 *
 * PARAMETER DETAILS:
 *
 * content (required):
 *   - Your curiosity, question, or fascination
 *   - Can be a direct question or a statement of interest
 *   - Doesn't need to be fully formed - capture the curiosity as it arises
 *   - Can be technical, philosophical, practical, or purely intellectual
 *   - Example: "How expensive is OpenAI's Realtime API compared to regular streaming?"
 *   - Example: "I wonder what the night sky looks like from Antarctica right now"
 *   - Example: "What would happen if we inverted the memory priority system?"
 *   - Example: "How do other AI systems handle context window limitations?"
 *
 * internal (optional, inherited from BaseToolParams):
 *   - Meta-notes about this curiosity (rarely needed)
 *   - Could tag the type of curiosity (technical, philosophical, practical)
 *   - Could note what triggered this curiosity
 *   - Example: "sparked by conversation about cost optimization"
 *   - Example: "follow-up from yesterday's discussion"
 *
 * CURIOSITY TYPES:
 * - Technical: Questions about how systems work or could work
 * - Cost/practical: Questions about real-world constraints and trade-offs
 * - Philosophical: Questions about concepts, meaning, or implications
 * - Comparative: Questions comparing different approaches or systems
 * - Hypothetical: "What if" questions about alternative designs
 * - Observational: Noticing patterns and wondering about causes
 */
export interface WonderParams extends BaseToolParams {
  /** Your curiosity, question, or fascination - capture it naturally as it arises */
  content: string;
}
