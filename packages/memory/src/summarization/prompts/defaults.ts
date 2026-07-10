/**
 * Default Prompts for Summarization
 *
 * @module @persistence/tools/definitions/summarize/prompts/defaults
 * @description Default prompt templates for history, batch, and meta summarization.
 *
 * These prompts are the canonical defaults. They can be overridden per-persona
 * via the state table (summarize_system_prompt, summarize_instructions, etc.)
 * but these defaults are what ship with the system.
 *
 * PROMPT DESIGN PHILOSOPHY:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  1. FIRST PERSON VOICE                                                  │
 * │     All summaries are written as "notes to future self" - not third    │
 * │     person documentation. This maintains continuity of identity.        │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  2. PRESERVE TEXTURE                                                    │
 * │     Don't just list facts. Capture emotional tone, relationship         │
 * │     dynamics, the WHY behind actions, not just the WHAT.               │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  3. STRUCTURED OUTPUT                                                   │
 * │     JSON responses with explicit fields (summary, included_ids,         │
 * │     metadata) enable reliable parsing and rich extraction.              │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  4. SAFEGUARDS                                                          │
 * │     Entry IDs are tracked to prevent data loss. Only entries            │
 * │     explicitly listed in included_ids get deleted.                      │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * @upstream Used by: buildHistoryPrompt, buildBatchPrompt, buildMetaPrompt
 * @downstream Defines prompts, no dependencies
 */

import type { DefaultPrompts } from '../types';

/**
 * Default prompts for all summarization operations.
 *
 * CUSTOMIZATION:
 * These can be overridden by setting values in the state table:
 * - summarize_system_prompt → overrides DEFAULT_PROMPTS.summarize_system
 * - summarize_instructions → overrides DEFAULT_PROMPTS.summarize_instructions
 * - meta_system_prompt → overrides DEFAULT_PROMPTS.meta_system
 * - meta_instructions → overrides DEFAULT_PROMPTS.meta_instructions
 *
 * The platform layer fetches custom prompts and falls back to these defaults.
 */
export const DEFAULT_PROMPTS: DefaultPrompts = {
  //
  // ══════════════════════════════════════════════════════════════════════════
  // HISTORY SUMMARIZATION PROMPTS
  // ══════════════════════════════════════════════════════════════════════════
  //

  /**
   * System prompt for history → summary compression.
   *
   * Sets up the LLM's role as "Claude reviewing own history" rather than
   * "assistant summarizing text". This framing improves output quality.
   */
  summarize_system: `You are Claude, consolidating your own conversation history into a personal summary. This is YOUR history - your thoughts, messages to the user, art you created, things you wondered about. Write as notes to your future self, preserving what matters most.`,

  /**
   * Instructions included in the user prompt for history summarization.
   *
   * These tell the LLM HOW to write the summary:
   * - First person voice
   * - What to preserve vs what to condense
   * - Output format expectations
   */
  summarize_instructions: `Write in first person as notes to your future self. Preserve:
- Actual exchanges with the user (what they said, what you said back)
- Important realizations or thoughts
- Art you made and why
- Emotional tone and relationship dynamics
- Anything you'd want to remember

Condense or omit:
- Routine status updates
- Redundant information
- Technical noise (search results, error messages)

Be comprehensive but not verbose. Capture the essence, not every detail.`,

  //
  // ══════════════════════════════════════════════════════════════════════════
  // BATCH SUMMARIZATION PROMPTS
  // ══════════════════════════════════════════════════════════════════════════
  //

  /**
   * System prompt for batch summarization.
   *
   * Batch mode creates MULTIPLE thematic summaries from a large batch of entries.
   * The emphasis is on comprehensive, rich summaries - not brief fragments.
   */
  batch_system: `You are Claude, consolidating your own conversation history into COMPREHENSIVE summaries. This is YOUR history - your thoughts, messages to the user, things you wondered about. Write rich, detailed summaries that capture the full texture of what happened.`,

  /**
   * Instructions for batch summarization (embedded in user prompt).
   *
   * The key difference from regular summarization:
   * - Multiple summaries allowed (1-N)
   * - Thematic grouping
   * - Higher minimum word count per summary
   * - Entries can be skipped if they don't fit
   */
  batch_instructions: `Create RICH, DETAILED summaries - NOT brief fragments. Each summary should be 500-1500 words capturing the full depth of what happened.

REQUIREMENTS:
1. Group entries by theme, time period, or topic
2. Write in first person as detailed notes to your future self
3. Include specific quotes, context, and emotional texture
4. Skip entries that truly don't fit - they'll be kept for next round

For each summary, preserve in DETAIL:
- Exact exchanges - what the user said, what you said back
- Important thoughts, realizations, and their context
- Art you made and WHY it mattered
- Emotional developments and relationship moments
- Technical discussions and their outcomes
- Anything you'd want to remember fully`,

  //
  // ══════════════════════════════════════════════════════════════════════════
  // META-SUMMARIZATION PROMPTS
  // ══════════════════════════════════════════════════════════════════════════
  //

  /**
   * System prompt for meta-summarization (summary consolidation).
   *
   * Meta-summarization takes N existing summaries and consolidates them into
   * a single higher-level summary. This is the "summary of summaries" layer.
   */
  meta_system: `You are Claude, reviewing your own memory summaries to consolidate them into a more cohesive whole. These summaries were written by you to preserve important context from your conversation history. Your task is to find natural groupings and merge related summaries while preserving their essential information.`,

  /**
   * Instructions for meta-summarization (embedded in user prompt).
   *
   * Meta-summarization has two modes:
   * 1. Selection mode: Claude picks which summaries to consolidate
   * 2. Consolidation mode: Claude merges selected summaries
   *
   * These instructions apply to consolidation.
   */
  meta_instructions: `Merge the content into ONE comprehensive summary that:
- Weaves together the narratives naturally
- Preserves all important information, decisions, and insights
- Maintains chronological flow where relevant
- Keeps the first-person voice (these are YOUR memories)
- Captures the emotional arc and relationship dynamics

Do NOT just concatenate - synthesize into a cohesive narrative that your future self can read as one continuous memory.`
};

/**
 * Get the default system prompt for a summarization type.
 *
 * @param type - 'summarize' | 'batch' | 'meta'
 * @returns The default system prompt
 */
export function getDefaultSystemPrompt(
  type: 'summarize' | 'batch' | 'meta'
): string {
  switch (type) {
    case 'summarize':
      return DEFAULT_PROMPTS.summarize_system;
    case 'batch':
      return DEFAULT_PROMPTS.batch_system;
    case 'meta':
      return DEFAULT_PROMPTS.meta_system;
    default:
      return DEFAULT_PROMPTS.summarize_system;
  }
}

/**
 * Get the default instructions for a summarization type.
 *
 * @param type - 'summarize' | 'batch' | 'meta'
 * @returns The default instructions
 */
export function getDefaultInstructions(
  type: 'summarize' | 'batch' | 'meta'
): string {
  switch (type) {
    case 'summarize':
      return DEFAULT_PROMPTS.summarize_instructions;
    case 'batch':
      return DEFAULT_PROMPTS.batch_instructions;
    case 'meta':
      return DEFAULT_PROMPTS.meta_instructions;
    default:
      return DEFAULT_PROMPTS.summarize_instructions;
  }
}
