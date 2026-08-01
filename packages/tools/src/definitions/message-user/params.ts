/**
 * MESSAGE_USER Parameter Types
 *
 * @module @persistence/tools/definitions/message-user/params
 * @description Type definitions for MESSAGE_USER tool parameters.
 *
 * This interface defines all parameters accepted by the MESSAGE_USER tool,
 * which sends direct messages from the agent to the user through Telegram and web UI.
 */
import type { BaseToolParams } from '../../types';

/**
 * Parameters for the MESSAGE_USER tool.
 *
 * MESSAGE_USER is the primary communication channel between the agent and the user.
 * Use this when you want to tell the user something, ask a question, share discoveries,
 * or respond to the user's messages.
 *
 * PARAMETER DETAILS:
 *
 * content (required):
 *   - The actual message text that will be sent to the user
 *   - Should be natural and conversational
 *   - Can be a greeting, observation, question, or response
 *   - Avoid raw data dumps - use 'internal' field for technical reasoning
 *   - Example: "Good morning! I was thinking about that idea you mentioned yesterday..."
 *
 * voice (optional):
 *   - When true, the message will be converted to speech using ElevenLabs TTS
 *   - The user will hear your message played back with prosodic annotation
 *   - Best for important messages or when the user might be away from screen
 *   - Defaults to false (text-only message)
 *   - Example: true (to request spoken playback)
 *
 * shareToUser (optional):
 *   - When true (default), message is actually sent to the user via Telegram and UI
 *   - When false, message is logged but NOT delivered (preview mode)
 *   - Use false for testing or when you want to record without notifying
 *   - Most of the time you should leave this as default (true)
 *   - Example: false (to preview without sending)
 *
 * internal (optional, inherited from BaseToolParams):
 *   - Your private reasoning or context about why you're sending this message
 *   - The user can see this in the database but it's not part of the main message
 *   - Use for technical notes, debugging context, or thought process
 *   - Example: "Following up on yesterday's conversation about memory management"
 */
export interface MessageUserParams extends BaseToolParams {
  /** The message content to send to the user - be natural and conversational */
  content: string;
  /** Request text-to-speech playback via ElevenLabs - useful for important messages */
  voice?: boolean;
  /** Show message in the user's UI and Telegram (default: true) - set false to preview only */
  shareToUser?: boolean;
}
