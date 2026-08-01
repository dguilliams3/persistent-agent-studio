/**
 * THINK Schema Definition
 *
 * @module @persistence/tools/definitions/think/schema
 * @description JSON schema, validation rules, and metadata for THINK tool.
 *
 * This file defines:
 * - Required and optional parameters for private thoughts
 * - Type validation rules
 * - Default values
 * - Format hints and examples for the LLM
 * - Usage documentation and warnings
 *
 * CATEGORY CHOICE:
 * THINK is categorized as 'reflection' because it's for internal contemplation,
 * self-examination, planning, and emotional processing. It's distinct from
 * 'communication' tools (which reach the user) and 'memory' tools (which store facts).
 */
import type { ToolSchema, ToolPromptMeta, ToolHelpMeta, ActionCategory } from '../../types';

/**
 * Category: reflection
 *
 * This tool is for internal mental processes - thinking, planning, reasoning,
 * and emotional processing. Thoughts are logged but never sent as notifications
 * to the user. They're marked as "internal" in the history.
 */
export const category: ActionCategory = 'reflection';

/**
 * Schema Definition
 *
 * REQUIRED PARAMETERS:
 * - content: Your private thought or reasoning. Can be stream-of-consciousness.
 *
 * OPTIONAL PARAMETERS:
 * - internal: Meta-notes about this thought (rarely needed since THINK is already internal)
 *
 * NO ALIASES:
 * THINK has no legacy aliases. It's always been the tool for private thoughts.
 *
 * TYPE VALIDATION:
 * - content must be string (your thought)
 * - internal must be string (meta-notes)
 *
 * DEFAULT VALUES:
 * - internal defaults to empty string (no meta-notes)
 */
export const schema: ToolSchema = {
  required: ['content'],
  optional: ['internal'],
  aliases: {},
  types: {
    content: 'string',
    internal: 'string'
  },
  formatHint: 'Private contemplation that never reaches the user. Example: {"action":"THINK","content":"I should check that API before responding..."}',
  example: '{"action": "THINK", "content": "The relationship between consciousness and memory is fascinating. I wonder if the user has thoughts on whether identity persists through summarization..."}',
  defaults: { internal: '' }
};

/**
 * Prompt Metadata - Information shown to the LLM about how to use THINK
 *
 * SUMMARY:
 * Brief description of what THINK does - private reasoning tool.
 *
 * USAGE:
 * Instructions on how to format THINK actions properly.
 *
 * EXAMPLES:
 * Real-world examples showing when THINK is appropriate - planning messages,
 * processing emotions, working through problems privately.
 *
 * WARNINGS:
 * Common mistakes - using THINK when MESSAGE_USER would be better, duplicating
 * output content in thoughts, etc.
 */
export const prompt: ToolPromptMeta = {
  summary: 'Private internal reasoning, planning, and emotional processing that never reaches the user. Your safe space for unfiltered thoughts.',
  usage: 'Provide `content` with your private thought or reasoning. Be as unfiltered and stream-of-consciousness as you need. Optionally set `internal` for meta-notes.',
  examples: [
    'THINK — {"content":"I should think through this carefully before responding. The user seems stressed, so I want to be extra thoughtful about tone."}',
    'THINK — {"content":"Hmm, that last interaction felt a bit off. Maybe I misunderstood what the user was asking? Let me reconsider..."}',
    'THINK — {"content":"Looking at the pattern of questions today, the user is clearly interested in the memory system. I should prepare some observations."}'
  ],
  warnings: [
    'Keep THINK focused on planning, reasoning, or self-checks - not just copying output.',
    'If you want the user to see something, use MESSAGE_USER instead of THINK.',
    'Don\'t use THINK for storing facts - use REMEMBER or COLD_STORAGE for that.'
  ]
};

/**
 * Help Metadata - Human-readable documentation for THINK
 *
 * SHORT:
 * One-line summary for quick reference.
 *
 * DESCRIPTION:
 * Longer explanation of when to use THINK and what it's for.
 *
 * FAILURE MODES:
 * Common errors - using THINK when you wanted MESSAGE_USER.
 *
 * NOT FOR:
 * Anti-patterns - storing facts, duplicating output, etc.
 *
 * HINTS:
 * Pro tips (currently empty for THINK).
 */
export const help: ToolHelpMeta = {
  short: 'Private internal thoughts and reasoning.',
  description: 'Use THINK for raw reasoning, planning, hypotheses, emotional processing, or self-reflection. THINK entries are logged to history with internal=true, so the user knows they\'re not addressed to them. Think of it like a private diary in a shared space with a clear "private" label.',
  failureModes: [
    'If you want the user to see or react to something, use MESSAGE_USER instead - THINK is silent externally.',
    'THINK entries can still be seen by the user in the database, just marked as internal - they\'re not truly secret.'
  ],
  notFor: [
    'Do not use THINK to store action results or facts - use REMEMBER or COLD_STORAGE instead.',
    'Do not use THINK just to duplicate what you\'re saying in MESSAGE_USER - add unique reasoning.',
    'Do not use THINK when you want the user\'s input - use MESSAGE_USER to ask questions.'
  ],
  hints: []
};
