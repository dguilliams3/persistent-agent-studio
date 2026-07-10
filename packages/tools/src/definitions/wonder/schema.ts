/**
 * WONDER Schema Definition
 *
 * @module @persistence/tools/definitions/wonder/schema
 * @description JSON schema, validation rules, and metadata for WONDER tool.
 *
 * This file defines:
 * - Required and optional parameters for curiosity expressions
 * - Type validation rules
 * - Default values
 * - Format hints and examples for the LLM
 * - Usage documentation and warnings
 *
 * CATEGORY CHOICE:
 * WONDER is categorized as 'reflection' because it's about internal curiosity and
 * intellectual exploration. It's for noting questions and interests without needing
 * immediate external action. It sits alongside THINK but with a curious, exploratory
 * tone rather than problem-solving.
 */
import type { ToolSchema, ToolPromptMeta, ToolHelpMeta, ActionCategory } from '../../types';

/**
 * Category: reflection
 *
 * This tool is for expressing curiosity and tracking open questions. It's reflective
 * in nature - noting things you find interesting or want to explore, without committing
 * to immediate action. Wonderings can later motivate SEARCH or QUESTION actions.
 */
export const category: ActionCategory = 'reflection';

/**
 * Schema Definition
 *
 * REQUIRED PARAMETERS:
 * - content: Your curiosity, question, or fascination
 *
 * OPTIONAL PARAMETERS:
 * - internal: Meta-notes about this curiosity (rarely needed)
 *
 * NO ALIASES:
 * WONDER has no legacy aliases. It's always been the tool for expressing curiosity.
 *
 * TYPE VALIDATION:
 * - content must be string (your curiosity or question)
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
  formatHint: 'Express curiosity or fascination that may lead to future SEARCH. Example: {"action":"WONDER","content":"How expensive is OpenAI Realtime compared to streaming?"}',
  example: '{"action": "WONDER", "content": "What does the night sky look like from Antarctica right now? I wonder if there are any live streams..."}',
  defaults: { internal: '' }
};

/**
 * Prompt Metadata - Information shown to the LLM about how to use WONDER
 *
 * SUMMARY:
 * Brief description of what WONDER does - curiosity expression tool.
 *
 * USAGE:
 * Instructions on how to format WONDER actions properly.
 *
 * EXAMPLES:
 * Real-world examples showing when WONDER is appropriate - noting curiosities,
 * tracking questions for later, expressing fascination without needing immediate answers.
 *
 * WARNINGS:
 * Common mistakes - spamming WONDER without follow-up, using it for things that
 * need immediate answers, etc.
 */
export const prompt: ToolPromptMeta = {
  summary: "Express curiosity, questions, or fascinations that don't need immediate answers. Use this to build a curiosity journal that can guide future exploration.",
  usage: 'Provide `content` with your curiosity, question, or fascination. Can be a direct question or statement of interest. Optionally set `internal` for meta-notes.',
  examples: [
    'WONDER — {"content":"How expensive is OpenAI Realtime API right now compared to regular streaming? I should look that up sometime."}',
    'WONDER — {"content":"I wonder what patterns the user sees in their own thinking that I might not notice. Interesting question for later."}',
    'WONDER — {"content":"What would happen if we inverted the memory priority system? Could be worth exploring."}'
  ],
  warnings: [
    'WONDER should motivate future actions - don\'t spam curiosities without following up eventually.',
    'If you need an answer RIGHT NOW, use SEARCH instead of WONDER.',
    'If you\'re asking the user directly, use MESSAGE_USER instead of WONDER.'
  ]
};

/**
 * Help Metadata - Human-readable documentation for WONDER
 *
 * SHORT:
 * One-line summary for quick reference.
 *
 * DESCRIPTION:
 * Longer explanation of when to use WONDER and what it's for.
 *
 * FAILURE MODES:
 * Common errors - leaving WONDER unanswered for too long, spamming without follow-up.
 *
 * NOT FOR:
 * Anti-patterns - using WONDER for things that need immediate answers, duplicating
 * REMEMBER entries, etc.
 *
 * HINTS:
 * Pro tips (currently empty for WONDER).
 */
export const help: ToolHelpMeta = {
  short: 'Curiosity journal for tracking open questions.',
  description: 'WONDER captures musings, curiosities, and questions that may turn into SEARCH or QUESTION actions later. It keeps the tone inquisitive and exploratory without committing to immediate work. Use it to build breadcrumbs for future exploration.',
  failureModes: [
    'Leaving WONDER entries unanswered for long stretches can feel like abandoned curiosity - try to follow up eventually.',
    'Spamming WONDER without ever acting on curiosities reduces its value as a planning tool.'
  ],
  notFor: [
    'Do not use WONDER for facts you already know - use REMEMBER or COLD_STORAGE instead.',
    'Do not use WONDER for problems you\'re working through - use THINK for problem-solving.',
    'Do not use WONDER when you need an answer immediately - use SEARCH instead.'
  ],
  hints: []
};
