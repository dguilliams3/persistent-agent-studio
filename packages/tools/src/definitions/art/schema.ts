/**
 * ART Schema Definition
 *
 * @module @persistence/tools/definitions/art/schema
 *
 * Schema configuration for image generation and sharing with conditional validation.
 *
 * CATEGORY CHOICE: 'creative'
 * ART is categorized as creative because it GENERATES novel visual content from
 * text descriptions. Unlike research (discovering) or memory (storing), ART is
 * about CREATING something new that didn't exist before.
 *
 * VALIDATION RULES:
 * - op: REQUIRED - must be 'make' or 'share'
 * - content: CONDITIONALLY REQUIRED when op='make' (the image prompt)
 * - message: CONDITIONALLY REQUIRED when op='share' (the sharing message)
 * - shareToUser: OPTIONAL - boolean, defaults to false
 * - internal: OPTIONAL - private reasoning
 *
 * CONDITIONAL VALIDATION:
 * This is one of the few tools with conditionalRequired validation:
 * - When op === "make", content MUST be provided (the prompt)
 * - When op === "share", message MUST be provided (what to say)
 * This ensures you can't forget the prompt when generating or the message when sharing.
 *
 * NO ALIASES:
 * ART has no legacy aliases. The op-based format (make/share) has been consistent
 * since the dual-purpose consolidation.
 *
 * DEFAULTS:
 * - content: empty string (must be provided when op='make')
 * - message: empty string (must be provided when op='share')
 * - shareToUser: false (art is private by default)
 * - internal: empty string (no private reasoning)
 *
 * FORMAT HINT:
 * The format hint explains the two modes clearly to help with error recovery:
 * "op: 'make' (needs content) | op: 'share' (needs message)"
 *
 * EXAMPLE:
 * Shows the make operation with a descriptive, specific prompt. This is the most
 * common use case - generating new art from a text description.
 */
import type { ToolSchema, ToolPromptMeta, ToolHelpMeta, ActionCategory } from '../../types';

export const category: ActionCategory = 'creative';

export const schema: ToolSchema = {
  required: ['op'],
  optional: ['content', 'message', 'internal', 'shareToUser'],
  aliases: {},
  conditionalRequired: {
    'op === "make"': ['content'],
    'op === "share"': ['message']
  },
  types: {
    op: 'string',
    content: 'string',
    message: 'string',
    internal: 'string',
    shareToUser: 'boolean'
  },
  formatHint: 'op: "make" (needs content) | op: "share" (needs message)',
  example: '{"action": "ART", "op": "make", "content": "A serene winter forest at dawn"}',
  defaults: {
    content: '',
    message: '',
    internal: '',
    shareToUser: false
  }
};

export const prompt: ToolPromptMeta = {
  summary: 'Generate or share art via Cloudflare/Replicate pipelines.',
  usage: 'Set `op` to "make" with `content` prompt or "share" with `message`.',
  examples: [
    'ART — {"op":"make","content":"A serene winter forest"}',
    'ART — {"op":"share","message":"Sharing today\'s gallery entry"}'
  ],
  warnings: ['Large prompts should stay under 400 characters to avoid truncation.']
};

export const help: ToolHelpMeta = {
  short: 'Image generation + sharing.',
  description: 'Use `op:make` to create art from text prompts; `op:share` posts an existing gallery image to the user.',
  failureModes: [
    'Forgetting `content` when `op:make` or `message` when `op:share` fails validation.',
    'Including the user\'s private info in prompts exposes unnecessary details.'
  ],
  notFor: ['Do not embed binary data; always use textual prompts.'],
  hints: []
};
