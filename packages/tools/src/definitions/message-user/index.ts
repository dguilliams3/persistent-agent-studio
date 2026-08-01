/**
 * MESSAGE_USER Tool Definition
 *
 * @module @persistence/tools/definitions/message-user
 *
 * PURPOSE: Send direct messages to the user (the human operator) through Telegram and the web UI.
 * This is the PRIMARY communication channel for the agent to reach its human and share
 * thoughts, observations, discoveries, questions, or important updates.
 *
 * WHEN TO USE:
 * - You have something important or interesting to tell the user
 * - You need the user's input, decision, or feedback on something
 * - You want to share observations, artwork, or discoveries
 * - You're greeting the user at the start of a conversation
 * - You want to ask the user a question or get clarification
 * - You're responding to something the user said to you
 *
 * WHEN NOT TO USE:
 * - For private contemplation (use THINK instead)
 * - For curiosity that doesn't need a response (use WONDER instead)
 * - For raw data dumps or scratch-pad reasoning (use internal field instead)
 *
 * PARAMETERS:
 * - content (required): The message text to send to the user. Be natural and conversational.
 * - voice (optional): Set to true to request text-to-speech playback via ElevenLabs
 * - shareToUser (optional): Defaults to true. Set false to preview without actually sending
 * - internal (optional): Your private reasoning - visible to you but not sent to the user
 *
 * MESSAGE DELIVERY:
 * - Messages appear instantly in the user's web UI on the Dashboard tab
 * - Messages are pushed to the user's Telegram if they have a chat session active
 * - Voice messages are played back with prosodic annotation when voice:true
 * - All messages are logged to the history table with type 'message_to_user'
 *
 * RELATED TOOLS:
 * - THINK: For private contemplation that doesn't reach the user
 * - WONDER: For expressing curiosity without needing immediate feedback
 * - SET_USER_STATUS: For checking if user is available/busy/asleep
 * - OBSERVATION: For recording observations about the user's patterns or preferences
 *
 * @category communication
 * @upstream Called by: @persistence/runtime - runThinkingCycle() during autonomous cycles
 * @downstream Calls: logHistory(), Telegram Bot API, TTS service (ElevenLabs), WebSocket broadcast
 */
import type { ToolDefinition } from '../../types';
import type { MessageUserParams } from './params';
import { category, schema, prompt, help } from './schema';
import { handler } from './handler';

// Re-export params type for consumers
export type { MessageUserParams } from './params';

/**
 * MESSAGE_USER tool definition with co-located handler.
 */
export const MESSAGE_USER: ToolDefinition<MessageUserParams> = {
  id: 'MESSAGE_USER',
  category,
  schema,
  prompt,
  help,
  handler,
  historyTypes: {
    primary: 'message_to_user'
  }
};
