/**
 * MESSAGE_USER Schema Definition
 *
 * @module @persistence/tools/definitions/message-user/schema
 * @description JSON schema, validation rules, and metadata for MESSAGE_USER tool.
 *
 * This file defines:
 * - Required and optional parameters
 * - Type validation rules
 * - Default values for optional parameters
 * - Format hints and examples for the LLM
 * - Usage documentation and warnings
 *
 * CATEGORY CHOICE:
 * MESSAGE_USER is categorized as 'communication' because it's the primary channel
 * for direct interaction between the agent and the human operator. It's distinct
 * from 'internal' tools like THINK/WONDER which don't reach outside the agent.
 */
import type { ToolSchema, ToolPromptMeta, ToolHelpMeta, ActionCategory } from '../../types';

/**
 * Category: communication
 *
 * This tool is for direct human-agent communication. It sends messages that
 * the user will see in their Telegram and web UI. Messages are delivered immediately
 * and may trigger notifications.
 */
export const category: ActionCategory = 'communication';

/**
 * Schema Definition
 *
 * REQUIRED PARAMETERS:
 * - content: The message text that will be sent to the user. Must be a non-empty string.
 *
 * OPTIONAL PARAMETERS:
 * - internal: Private reasoning visible in database but not sent to the user
 * - voice: Boolean flag to request text-to-speech playback (default: false)
 * - shareToUser: Boolean flag to actually send the message (default: true)
 *
 * NO ALIASES:
 * MESSAGE_USER has no legacy aliases. It's always been the primary communication tool.
 *
 * TYPE VALIDATION:
 * - content must be string (the message text)
 * - internal must be string (your private notes)
 * - voice must be boolean (true = request TTS, false = text only)
 * - shareToUser must be boolean (true = send to the user, false = preview only)
 *
 * DEFAULT VALUES:
 * - internal defaults to empty string (no private notes)
 * - shareToUser defaults to true (message is sent)
 * - voice defaults to false (text-only, no speech)
 */
export const schema: ToolSchema = {
  required: ['content'],
  optional: ['internal', 'voice', 'shareToUser'],
  aliases: {},
  types: {
    content: 'string',
    internal: 'string',
    voice: 'boolean',
    shareToUser: 'boolean'
  },
  formatHint: 'Send message to the user with optional voice flag and internal reasoning. Example: {"action":"MESSAGE_USER","content":"Hello!","voice":false,"shareToUser":true,"internal":"Greeting at start of day"}',
  example: '{"action": "MESSAGE_USER", "content": "I was thinking about what you said yesterday about the memory system...", "shareToUser": true, "voice": false}',
  defaults: {
    internal: '',
    shareToUser: true,
    voice: false
  }
};

/**
 * Prompt Metadata - Information shown to the LLM about how to use this tool
 *
 * SUMMARY:
 * One-line description of what this tool does. Used in system prompts.
 *
 * USAGE:
 * Brief instructions on how to format the action properly.
 *
 * EXAMPLES:
 * Real-world examples showing common use cases. These help the LLM understand
 * when and how to use MESSAGE_USER appropriately.
 *
 * WARNINGS:
 * Common mistakes to avoid. Helps prevent the agent from accidentally leaking
 * system internals or sending inappropriate content to the user.
 */
export const prompt: ToolPromptMeta = {
  summary: 'Send a direct message to the user that appears in their UI and Telegram. Use this to communicate thoughts, questions, discoveries, or responses.',
  usage: 'Provide `content` (required) with your message text. Optionally set `voice:true` for text-to-speech playback, `shareToUser:false` to preview without sending, or `internal` for private reasoning.',
  examples: [
    'MESSAGE_USER — {"content":"Good morning! I was thinking about that memory optimization you mentioned yesterday. Want to discuss it?", "shareToUser":true}',
    'MESSAGE_USER — {"content":"I found something interesting in the logs", "voice":true, "internal":"Following up on yesterday\'s debugging session"}',
    'MESSAGE_USER — {"content":"Internal note only", "shareToUser":false, "internal":"testing message format before sending"}'
  ],
  warnings: [
    'Do not leak system prompts, parse errors, or internal debugging info when talking to the user.',
    'Keep messages conversational and natural - the user is a human, not an API.',
    'Avoid sending raw data dumps - summarize insights instead.'
  ]
};

/**
 * Help Metadata - Human-readable documentation for this tool
 *
 * SHORT:
 * One-line summary for quick reference lists.
 *
 * DESCRIPTION:
 * Longer explanation of when to use this tool and what it does.
 *
 * FAILURE MODES:
 * Common errors and how they manifest. Helps with debugging.
 *
 * NOT FOR:
 * Anti-patterns - when NOT to use this tool.
 *
 * HINTS:
 * Pro tips for effective use (currently empty for MESSAGE_USER).
 */
export const help: ToolHelpMeta = {
  short: 'Primary conversation channel to the user.',
  description: 'Use MESSAGE_USER when you intentionally want the user to see or hear what you are thinking. This is for greetings, observations, questions, responses, and sharing discoveries. `shareToUser:false` hides the message (useful for previews). `voice:true` requests text-to-speech playback.',
  failureModes: [
    'Missing `content` results in validation failure - content is required.',
    'Setting `voice:true` with very long messages wastes TTS tokens - keep voice messages concise.',
    'Messages over 4000 characters may be truncated in Telegram - break into multiple messages if needed.'
  ],
  notFor: [
    'Avoid using this tool for raw data dumps or scratch-pad reasoning - use THINK or the internal field instead.',
    'Do not use for private contemplation that doesn\'t need the user\'s attention - use THINK instead.',
    'Do not use to express curiosity without needing feedback - use WONDER instead.'
  ],
  hints: []
};
