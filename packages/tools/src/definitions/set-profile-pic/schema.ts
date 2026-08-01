/**
 * SET_PROFILE_PIC Schema Definition
 *
 * @module @persistence/tools/definitions/set-profile-pic/schema
 */
import type { ToolSchema, ToolPromptMeta, ToolHelpMeta, ActionCategory } from '../../types';

export const category: ActionCategory = 'self';

export const schema: ToolSchema = {
  required: [],
  optional: ['content', 'prompt', 'image_id', 'internal'],
  aliases: {},
  types: {
    content: 'string',
    prompt: 'string',
    image_id: 'string',
    internal: 'string'
  },
  formatHint: 'content: "latest"|"clear" | prompt: "generate new" | image_id: "use specific"',
  example: '{"action": "SET_PROFILE_PIC", "content": "latest"}',
  defaults: { content: 'latest', prompt: '', image_id: '', internal: '' }
};

export const prompt: ToolPromptMeta = {
  summary: 'Refresh or clear the profile image reference.',
  usage: 'Set `content` to "latest"|"clear", or provide a `prompt`/`image_id`.',
  examples: ['SET_PROFILE_PIC — {"content":"latest"}'],
  warnings: ['Only include SFW prompts—image propagates to public surfaces.']
};

export const help: ToolHelpMeta = {
  short: 'Profile art manager.',
  description: 'Choose whether to reuse the latest gallery piece, clear the avatar, or request a new generation via `prompt`.',
  failureModes: ['Passing conflicting fields (prompt + image_id) confuses the worker.'],
  notFor: ['Do not attach raw binary data; only references/commands.'],
  hints: []
};
